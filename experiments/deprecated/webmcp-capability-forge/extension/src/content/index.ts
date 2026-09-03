import {
  BridgeDirection,
  BridgeMessageType,
  FailureCode,
  InteractionEffect,
  JsonTypes,
  RiskPhase,
  SchemaCatalog,
  WorkflowAction,
  type BridgeEnvelope,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import { JsonCodec } from '../storage/json-codec'
import { ContentController } from './content-controller'
import { ManualRecorder } from './manual-recorder'
import { PageExplorer } from './page-explorer'

const dependencies = {
  now: () => Date.now(),
  createId: () => crypto.randomUUID(),
}

const controller = new ContentController(
  new ManualRecorder(dependencies, {
    async append(event) {
      await chrome.runtime.sendMessage(
        BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.PageToExtension,
          type: BridgeMessageType.SessionAppend,
          payload: { tabId: 0, event: JsonCodec.value(event) },
        }),
      )
    },
  }),
  new PageExplorer(dependencies),
  document,
)

const onPageMessage = (event: MessageEvent<JsonValue>): void => {
  if (event.source !== window) return
  const parsed = BridgeEnvelopeCodec.parse(event.data, BridgeDirection.PageToExtension)
  if (!parsed.valid) return
  void ContentRuntime.handle(parsed.value)
    .then((payload) => {
      window.postMessage(
        BridgeEnvelopeCodec.create({
          requestId: parsed.value.requestId,
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.ContentResponse,
          payload,
        }),
        window.location.origin,
      )
    })
}

class ContentRuntime {
  static async handle(envelope: BridgeEnvelope): Promise<JsonValue> {
    if (envelope.type === BridgeMessageType.PageInspect) return JsonCodec.value(controller.inspect())
    if (envelope.type === BridgeMessageType.PageObserve) return controller.observe()
    if (envelope.type === BridgeMessageType.PageInteract) {
      if (!JsonTypes.isObject(envelope.payload) || !JsonTypes.isObject(envelope.payload.handle)) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const action = envelope.payload.action
      if (typeof action !== 'string' || !Object.values(WorkflowAction).includes(action as WorkflowAction)) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const effect = envelope.payload.effect
      if (
        effect !== undefined &&
        (typeof effect !== 'string' ||
          !Object.values(InteractionEffect).includes(effect as InteractionEffect))
      ) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const handle = envelope.payload.handle
      if (typeof handle.id !== 'string' || typeof handle.inspectionRevision !== 'number') {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const validatedAction = action as WorkflowAction
      const validatedEffect = effect as InteractionEffect | undefined
      let confirmed = false
      if (typeof envelope.payload.confirmationRequestId === 'string' && validatedEffect) {
        const confirmation = JsonCodec.value(await chrome.runtime.sendMessage(
          BridgeEnvelopeCodec.create({
            requestId: crypto.randomUUID(),
            direction: BridgeDirection.PageToExtension,
            type: BridgeMessageType.ConfirmationConsume,
            payload: {
              requestId: envelope.payload.confirmationRequestId,
              action: validatedAction,
              effect: validatedEffect,
              target: handle.id,
              origin: window.location.origin,
              path: window.location.pathname,
            },
          }),
        ))
        confirmed = JsonTypes.isObject(confirmation) && confirmation.approved === true
      }
      const result = await controller.interact({
          documentValue: document,
          handle: { id: handle.id, inspectionRevision: handle.inspectionRevision },
          action: validatedAction,
          ...(validatedEffect ? { effect: validatedEffect } : {}),
          phase: RiskPhase.Learning,
          confirmed,
          origin: window.location.origin,
          path: window.location.pathname,
          ...(typeof envelope.payload.value === 'string'
            ? { value: envelope.payload.value }
            : {}),
          ...(typeof envelope.payload.checked === 'boolean'
            ? { checked: envelope.payload.checked }
            : {}),
          ...(typeof envelope.payload.key === 'string' ? { key: envelope.payload.key } : {}),
        })
      if (result.ok && result.event) {
        await chrome.runtime.sendMessage(
          BridgeEnvelopeCodec.create({
            requestId: crypto.randomUUID(),
            direction: BridgeDirection.PageToExtension,
            type: BridgeMessageType.SessionAppend,
            payload: { tabId: 0, event: JsonCodec.value(result.event) },
          }),
        )
      }
      if (
        !result.ok && result.failure?.code === FailureCode.RiskConfirmationRequired &&
        validatedEffect
      ) {
        const confirmation = JsonCodec.value(await chrome.runtime.sendMessage(
          BridgeEnvelopeCodec.create({
            requestId: crypto.randomUUID(),
            direction: BridgeDirection.PageToExtension,
            type: BridgeMessageType.ConfirmationCreate,
            payload: {
              action: validatedAction,
              effect: validatedEffect,
              target: handle.id,
              origin: window.location.origin,
              path: window.location.pathname,
            },
          }),
        ))
        return JsonTypes.isObject(confirmation) && typeof confirmation.requestId === 'string'
          ? JsonCodec.value({ ...result, confirmationRequestId: confirmation.requestId })
          : JsonCodec.value(result)
      }
      return JsonCodec.value(result)
    }
    const response = await chrome.runtime.sendMessage(envelope)
    return JsonCodec.value(response)
  }
}

window.addEventListener('message', onPageMessage)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const value = JsonCodec.value(message)
  const parsed = BridgeEnvelopeCodec.parse(value, BridgeDirection.ExtensionToPage)
  if (!parsed.valid) return false
  if (parsed.value.type === BridgeMessageType.ManualStart) {
    const session = ContentController.sessionFromPayload(parsed.value.payload)
    sendResponse(session ? controller.startManual(session) : { ok: false, code: FailureCode.BridgeInvalid })
    return false
  }
  if (
    parsed.value.type === BridgeMessageType.ManualStop ||
    parsed.value.type === BridgeMessageType.SessionStop
  ) {
    void controller.stopManual().then((session) => {
      sendResponse({ ok: true, session: JsonCodec.value(session) })
    }).catch(() => sendResponse({
      ok: false,
      code: FailureCode.InvalidSessionTransition,
      message: 'Manual recording is not active in this document.',
    }))
    return true
  }
  if (parsed.value.type === BridgeMessageType.RuntimeExecute) {
    if (!JsonTypes.isObject(parsed.value.payload)) {
      sendResponse({ ok: false, code: FailureCode.BridgeInvalid })
      return false
    }
    const definition = parsed.value.payload.definition
    const input = parsed.value.payload.input
    const executionId = parsed.value.payload.executionId
    if (
      definition === undefined ||
      !JsonTypes.isObject(input) ||
      typeof executionId !== 'string'
    ) {
      sendResponse({ ok: false, code: FailureCode.BridgeInvalid })
      return false
    }
    const validated = SchemaCatalog.parseCapability(definition)
    if (!validated.valid) {
      sendResponse({ ok: false, code: FailureCode.BridgeInvalid })
      return false
    }
    const confirmed = Array.isArray(parsed.value.payload.confirmedStepIds)
      ? parsed.value.payload.confirmedStepIds.filter(
          (value): value is string => typeof value === 'string',
        )
      : []
    void controller.execute({
      executionId,
      definition: validated.value,
      input,
      documentValue: document,
      confirmedStepIds: confirmed,
      ...(typeof parsed.value.payload.startStep === 'number'
        ? { startStep: parsed.value.payload.startStep }
        : {}),
    }).then((outcome) => sendResponse(JsonCodec.value(outcome)))
    return true
  }
  if (parsed.value.type === BridgeMessageType.RuntimePreflight) {
    if (!JsonTypes.isObject(parsed.value.payload) || parsed.value.payload.definition === undefined) {
      sendResponse({ ok: false, code: FailureCode.BridgeInvalid })
      return false
    }
    const validated = SchemaCatalog.parseCapability(parsed.value.payload.definition)
    sendResponse(validated.valid
      ? JsonCodec.value(controller.preflight(validated.value))
      : { ok: false, code: FailureCode.BridgeInvalid })
    return false
  }
  window.postMessage(parsed.value, window.location.origin)
  sendResponse({ ok: true })
  return false
})

void chrome.runtime.sendMessage(
  BridgeEnvelopeCodec.create({
    requestId: crypto.randomUUID(),
    direction: BridgeDirection.PageToExtension,
    type: BridgeMessageType.PageReady,
    payload: { url: window.location.href },
  }),
)
window.addEventListener('pagehide', () => {
  window.removeEventListener('message', onPageMessage)
  controller.dispose()
}, { once: true })
