import { z } from 'zod'

import {
  BridgeDirection,
  BridgeMessageType,
  BridgeProtocol,
  FailureCode,
  JsonTypes,
  SchemaCatalog,
  ValidationIssueCode,
  type BridgeEnvelope,
  type CreateEnvelopeInput,
  type JsonValue,
  type ValidationResult,
} from 'webmcp-capability-forge-core'

const envelopeSchema = z
  .object({
    protocol: z.literal(BridgeProtocol.CapabilityForge),
    version: z.literal(1),
    requestId: z.string().min(1).max(128),
    direction: z.enum(BridgeDirection),
    type: z.enum(BridgeMessageType),
    payload: z.json(),
  })
  .strict()

const sitePagePayload = z
  .object({ url: z.url(), tabId: z.number().int().nonnegative() })
  .strict()
const pageReadyPayload = z
  .object({ url: z.url() })
  .strict()

export class BridgeEnvelopeCodec {
  static create(input: CreateEnvelopeInput): BridgeEnvelope {
    return {
      protocol: BridgeProtocol.CapabilityForge,
      version: 1,
      requestId: input.requestId,
      direction: input.direction,
      type: input.type,
      payload: structuredClone(input.payload),
    }
  }

  static parse(
    value: JsonValue,
    direction: BridgeDirection,
  ): ValidationResult<BridgeEnvelope> {
    const parsed = envelopeSchema.safeParse(value)
    if (!parsed.success || parsed.data.direction !== direction) {
      return BridgeEnvelopeCodec.invalid('Bridge envelope metadata is invalid.')
    }
    if (!BridgeEnvelopeCodec.payloadMatches(parsed.data.type, parsed.data.payload)) {
      return BridgeEnvelopeCodec.invalid('Bridge payload does not match its message type.')
    }
    return { valid: true, value: parsed.data as BridgeEnvelope }
  }

  private static payloadMatches(type: BridgeMessageType, payload: JsonValue): boolean {
    if (
      type === BridgeMessageType.SiteEnable ||
      type === BridgeMessageType.SiteDisable ||
      type === BridgeMessageType.SiteStatus
    ) {
      return sitePagePayload.safeParse(payload).success
    }
    if (type === BridgeMessageType.PageReady) return pageReadyPayload.safeParse(payload).success
    if (type === BridgeMessageType.ContentResponse) return true
    const object = JsonTypes.isObject(payload) ? payload : null
    if (!object) return false
    if (
      type === BridgeMessageType.PageInspect ||
      type === BridgeMessageType.PageObserve ||
      type === BridgeMessageType.WorkflowPropose
    ) return Object.keys(object).length === 0
    if (type === BridgeMessageType.SessionGet) {
      return BridgeEnvelopeCodec.fields(object, ['tabId'], []) &&
        (object.tabId === undefined || typeof object.tabId === 'number')
    }
    if (type === BridgeMessageType.SessionAppend) {
      if (!BridgeEnvelopeCodec.fields(object, ['tabId', 'event'], ['tabId', 'event']) || typeof object.tabId !== 'number') return false
      return object.event !== undefined && SchemaCatalog.parseTraceEvent(object.event).valid
    }
    if (type === BridgeMessageType.SessionStop) {
      return BridgeEnvelopeCodec.fields(object, ['tabId'], ['tabId']) && typeof object.tabId === 'number'
    }
    if (type === BridgeMessageType.ManualStop) {
      return BridgeEnvelopeCodec.fields(object, ['tabId'], []) &&
        (object.tabId === undefined || typeof object.tabId === 'number')
    }
    if (type === BridgeMessageType.ManualStart) {
      return BridgeEnvelopeCodec.fields(object, ['session'], ['session']) &&
        object.session !== undefined && SchemaCatalog.parseSession(object.session).valid
    }
    if (type === BridgeMessageType.RuntimePreflight) {
      return BridgeEnvelopeCodec.fields(object, ['definition'], ['definition']) &&
        object.definition !== undefined && SchemaCatalog.parseCapability(object.definition).valid
    }
    if (type === BridgeMessageType.RuntimeExecute) {
      const trusted = BridgeEnvelopeCodec.fields(
        object,
        ['executionId', 'definition', 'input', 'confirmedStepIds', 'startStep'],
        ['executionId', 'definition', 'input', 'confirmedStepIds'],
      ) && typeof object.executionId === 'string' && object.definition !== undefined &&
        SchemaCatalog.parseCapability(object.definition).valid && JsonTypes.isObject(object.input) &&
        Array.isArray(object.confirmedStepIds) && object.confirmedStepIds.every((value) => typeof value === 'string') &&
        (object.startStep === undefined || typeof object.startStep === 'number')
      const agent = BridgeEnvelopeCodec.fields(object, ['toolName', 'input'], ['toolName', 'input']) &&
        typeof object.toolName === 'string' && JsonTypes.isObject(object.input)
      return trusted || agent
    }
    if (type === BridgeMessageType.RuntimeSync) {
      return BridgeEnvelopeCodec.fields(object, ['session', 'tools'], []) &&
        (object.session !== undefined || object.tools !== undefined) &&
        (object.session === undefined || SchemaCatalog.parseSession(object.session).valid) &&
        (object.tools === undefined || Array.isArray(object.tools))
    }
    if (type === BridgeMessageType.SessionStateChanged) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'session', 'proposals'], ['tabId', 'session', 'proposals']) &&
        typeof object.tabId === 'number' && object.session !== undefined &&
        SchemaCatalog.parseSession(object.session).valid && Array.isArray(object.proposals)
    }
    if (type === BridgeMessageType.ConfirmationStateChanged) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'confirmations'], ['tabId', 'confirmations']) &&
        typeof object.tabId === 'number' && Array.isArray(object.confirmations)
    }
    if (type === BridgeMessageType.SessionBegin) {
      const manual = BridgeEnvelopeCodec.fields(object, ['tabId', 'origin', 'path', 'goal', 'mode'], ['tabId', 'origin', 'path', 'goal', 'mode']) &&
        typeof object.tabId === 'number' && typeof object.origin === 'string' &&
        typeof object.path === 'string' && typeof object.goal === 'string' && typeof object.mode === 'string'
      const agent = BridgeEnvelopeCodec.fields(object, ['operation', 'goal'], ['operation', 'goal']) &&
        typeof object.operation === 'string' && typeof object.goal === 'string'
      return manual || agent
    }
    if (type === BridgeMessageType.SessionJoin) {
      return BridgeEnvelopeCodec.fields(object, ['operation', 'sessionId'], ['operation', 'sessionId']) &&
        typeof object.operation === 'string' && typeof object.sessionId === 'string'
    }
    if (type === BridgeMessageType.ProtocolInspect) {
      return BridgeEnvelopeCodec.fields(object, ['operation'], ['operation']) && typeof object.operation === 'string'
    }
    if (type === BridgeMessageType.CapabilitiesList) {
      const ui = BridgeEnvelopeCodec.fields(object, ['tabId', 'origin', 'path'], ['origin']) &&
        typeof object.origin === 'string' && (object.tabId === undefined || typeof object.tabId === 'number') &&
        (object.path === undefined || typeof object.path === 'string')
      const agent = BridgeEnvelopeCodec.fields(object, ['operation'], ['operation']) && typeof object.operation === 'string'
      return ui || agent
    }
    if (type === BridgeMessageType.PageInteract) {
      return BridgeEnvelopeCodec.fields(object, ['action', 'handle', 'effect', 'value', 'checked', 'key', 'confirmed', 'confirmationRequestId'], ['action', 'handle']) &&
        typeof object.action === 'string' && JsonTypes.isObject(object.handle) &&
        typeof object.handle.id === 'string' && typeof object.handle.inspectionRevision === 'number'
    }
    if (type === BridgeMessageType.FailureReport) {
      return BridgeEnvelopeCodec.fields(object, ['operation', 'toolName', 'failureCode', 'failureMessage'], ['operation', 'toolName', 'failureCode', 'failureMessage']) &&
        typeof object.toolName === 'string' && typeof object.failureCode === 'string' && typeof object.failureMessage === 'string'
    }
    if (type === BridgeMessageType.RepairRequest) {
      return BridgeEnvelopeCodec.fields(object, ['operation', 'toolName'], ['operation', 'toolName']) && typeof object.toolName === 'string'
    }
    if (type === BridgeMessageType.ProposalResolve || type === BridgeMessageType.ConfirmationResolve) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'requestId', 'approved'], ['requestId', 'approved']) &&
        (object.tabId === undefined || typeof object.tabId === 'number') &&
        typeof object.requestId === 'string' && typeof object.approved === 'boolean'
    }
    if (type === BridgeMessageType.ConfirmationCreate) {
      return BridgeEnvelopeCodec.confirmationFields(object, false)
    }
    if (type === BridgeMessageType.ConfirmationConsume) {
      return BridgeEnvelopeCodec.confirmationFields(object, true)
    }
    if (type === BridgeMessageType.CapabilitySetStatus) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'origin', 'name', 'revision', 'status'], ['tabId', 'origin', 'name', 'revision', 'status']) &&
        typeof object.tabId === 'number' && typeof object.origin === 'string' &&
        typeof object.name === 'string' && typeof object.revision === 'number' && typeof object.status === 'string'
    }
    if (type === BridgeMessageType.CapabilityDelete) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'origin', 'name', 'revision'], ['tabId', 'origin', 'name', 'revision']) &&
        typeof object.tabId === 'number' && typeof object.origin === 'string' &&
        typeof object.name === 'string' && typeof object.revision === 'number'
    }
    if (type === BridgeMessageType.ToolPackExport) {
      return BridgeEnvelopeCodec.fields(object, ['origin', 'names'], ['origin', 'names']) &&
        typeof object.origin === 'string' && Array.isArray(object.names) && object.names.every((value) => typeof value === 'string')
    }
    if (type === BridgeMessageType.ToolPackImport) {
      return BridgeEnvelopeCodec.fields(object, ['tabId', 'origin', 'path', 'pack'], ['tabId', 'origin', 'path', 'pack']) &&
        typeof object.tabId === 'number' && typeof object.origin === 'string' && typeof object.path === 'string'
    }
    return false
  }

  private static confirmationFields(payload: import('webmcp-capability-forge-core').JsonObject, consume: boolean): boolean {
    const allowed = ['requestId', 'action', 'effect', 'target', 'origin', 'path']
    const required = consume ? allowed : allowed.filter((field) => field !== 'requestId')
    return BridgeEnvelopeCodec.fields(payload, allowed, required) &&
      (!consume || typeof payload.requestId === 'string') && typeof payload.action === 'string' &&
      typeof payload.effect === 'string' && typeof payload.target === 'string' &&
      typeof payload.origin === 'string' && typeof payload.path === 'string'
  }

  private static fields(
    payload: import('webmcp-capability-forge-core').JsonObject,
    allowed: readonly string[],
    required: readonly string[],
  ): boolean {
    return Object.keys(payload).every((field) => allowed.includes(field)) &&
      required.every((field) => payload[field] !== undefined)
  }

  private static invalid(message: string): ValidationResult<never> {
    return {
      valid: false,
      failure: FailureCode.BridgeInvalid,
      issues: [
        {
          path: 'bridge',
          code: ValidationIssueCode.BridgeInvalid,
          message,
        },
      ],
    }
  }
}
