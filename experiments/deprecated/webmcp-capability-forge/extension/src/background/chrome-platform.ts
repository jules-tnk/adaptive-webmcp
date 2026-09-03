import {
  BridgeDirection,
  BridgeMessageType,
  LearningMode,
  ProtocolBuilder,
  SchemaCatalog,
  SessionActor,
  SessionMachine,
  SessionStatus,
  TraceSource,
  TraceCompiler,
  WorkflowAction,
  InteractionEffect,
  type LearningSession,
  type TraceEvent,
  FailureCode,
  JsonTypes,
  type BridgeEnvelope,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import { BridgeReplayGuard } from '../bridge/bridge-replay-guard'
import { JsonCodec } from '../storage/json-codec'
import {
  CapabilityHealth,
  CapabilityRevisionStatus,
  CapabilityRepository,
} from '../storage/capability-repository'
import { ContinuationRepository } from '../storage/continuation-repository'
import { SessionRepository } from '../storage/session-repository'
import {
  SitePermissions,
  type ContentRegistration,
  type SitePermissionPlatform,
} from './site-permissions'

export class ChromeSitePermissionPlatform implements SitePermissionPlatform {
  request(pattern: string): Promise<boolean> {
    return chrome.permissions.request({ origins: [pattern] })
  }

  async register(registration: ContentRegistration): Promise<void> {
    await chrome.scripting.registerContentScripts([
      {
        id: registration.id,
        matches: [...registration.matches],
        js: [...registration.js],
        persistAcrossSessions: registration.persistAcrossSessions,
        runAt: registration.runAt,
        world: registration.world,
      },
    ])
  }

  unregister(id: string): Promise<void> {
    return chrome.scripting.unregisterContentScripts({ ids: [id] })
  }

  remove(pattern: string): Promise<boolean> {
    return chrome.permissions.remove({ origins: [pattern] })
  }

  contains(pattern: string): Promise<boolean> {
    return chrome.permissions.contains({ origins: [pattern] })
  }

  async registered(id: string): Promise<boolean> {
    const registrations = await chrome.scripting.getRegisteredContentScripts({ ids: [id] })
    return registrations.length === 1
  }
}

export class ChromePlatform {
  private readonly permissions: SitePermissions
  private readonly replayGuard = new BridgeReplayGuard()
  private readonly services: BackgroundServices | null

  constructor(permissions: SitePermissions, services: BackgroundServices | null = null) {
    this.permissions = permissions
    this.services = services
  }

  async handle<T>(message: T, senderTabId = 0, senderUrl = ''): Promise<JsonValue> {
    const value = JsonCodec.value(message)
    const envelope = ChromePlatform.parseEnvelope(value)
    if (!envelope) return { ok: false, code: FailureCode.BridgeInvalid }
    const accepted = this.replayGuard.accept(envelope)
    if (!accepted.valid) return { ok: false, code: accepted.failure ?? FailureCode.BridgeReplay }

    const payload = ChromePlatform.asObject(envelope.payload)
    if (envelope.type === BridgeMessageType.SiteEnable) {
      if (!payload || typeof payload.url !== 'string') return { ok: false, code: FailureCode.BridgeInvalid }
      const result = await this.permissions.enable(payload.url)
      if (result.enabled && this.services && typeof payload.tabId === 'number') {
        await this.services.injectContent(payload.tabId)
      }
      return JsonCodec.object(result)
    }
    if (envelope.type === BridgeMessageType.SiteDisable) {
      if (!payload || typeof payload.url !== 'string') return { ok: false, code: FailureCode.BridgeInvalid }
      return JsonCodec.object(await this.permissions.disable(payload.url))
    }
    if (envelope.type === BridgeMessageType.SiteStatus) {
      if (!payload || typeof payload.url !== 'string') return { ok: false, code: FailureCode.BridgeInvalid }
      const result = await this.permissions.status(payload.url)
      if (
        result.enabled && result.registrationChanged && this.services &&
        typeof payload.tabId === 'number'
      ) {
        await this.services.injectContent(payload.tabId)
      }
      return JsonCodec.object(result)
    }
    if (!this.services || !payload) return { ok: false, code: FailureCode.BridgeInvalid }
    if (envelope.type === BridgeMessageType.PageReady) {
      if (senderTabId <= 0) return { ok: false, code: FailureCode.BridgeInvalid }
      const page = ChromePlatform.page(senderUrl)
      if (page) await this.services.resumePage({
        tabId: senderTabId,
        origin: page.origin,
        path: page.path,
        timestamp: Date.now(),
      })
      await this.services.injectMainWorld(senderTabId)
      const current = await this.services.sessions.get(senderTabId)
      if (
        page && current && current.origin === page.origin &&
        current.status === SessionStatus.Collecting &&
        (current.mode === LearningMode.Manual || current.mode === LearningMode.Hybrid)
      ) {
        let restored = current
        if (current.currentPath !== page.path) {
          const route = SessionMachine.append(current, {
            id: crypto.randomUUID(),
            source: TraceSource.Human,
            action: WorkflowAction.WaitForUrl,
            origin: page.origin,
            path: page.path,
            timestamp: Date.now(),
          })
          if (route.valid) {
            restored = route.value
            await this.services.sessions.save(senderTabId, restored)
          }
        }
        await this.services.notifyTab(senderTabId, BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.ManualStart,
          payload: { session: JsonCodec.value(restored) },
        }))
        await this.services.notifyUi(BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.BackgroundToUi,
          type: BridgeMessageType.SessionStateChanged,
          payload: { tabId: senderTabId, session: JsonCodec.value(restored), proposals: [] },
        }))
      }
      return { ok: true }
    }
    if (envelope.type === BridgeMessageType.SessionBegin) {
      const trustedPage = ChromePlatform.page(senderUrl)
      const session = envelope.direction === BridgeDirection.PageToExtension
        ? ChromePlatform.createAgentSession(payload, trustedPage)
        : ChromePlatform.createSession(payload)
      if (!session) return { ok: false, code: FailureCode.BridgeInvalid }
      const tabId = typeof payload.tabId === 'number' && payload.tabId > 0 ? payload.tabId : senderTabId
      const existing = await this.services.sessions.get(tabId)
      if (existing && existing.status === SessionStatus.Collecting) {
        return { ok: false, code: FailureCode.InvalidSessionTransition, session: JsonCodec.value(existing) }
      }
      await this.services.sessions.save(tabId, session)
      await this.services.notifyUi(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.SessionStateChanged,
        payload: { tabId, session: JsonCodec.value(session), proposals: [] },
      }))
      if (session.mode === LearningMode.Manual || session.mode === LearningMode.Hybrid) {
        await this.services.notifyTab(tabId, BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.ManualStart,
          payload: { session: JsonCodec.value(session) },
        }))
      }
      if (session.mode === LearningMode.Automatic || session.mode === LearningMode.Hybrid) {
        await this.services.notifyTab(tabId, BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.RuntimeSync,
          payload: { session: JsonCodec.value(session) },
        }))
      }
      return { ok: true, session: JsonCodec.value(session) }
    }
    if (envelope.type === BridgeMessageType.SessionJoin) {
      const tabId = senderTabId
      const session = await this.services.sessions.get(tabId)
      if (!session || typeof payload.sessionId !== 'string' || payload.sessionId !== session.id) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const joined = SessionMachine.handoff(session, SessionActor.Agent)
      if (!joined.valid) return { ok: false, code: joined.failure ?? FailureCode.InvalidSessionTransition }
      await this.services.sessions.save(tabId, joined.value)
      await this.services.notifyUi(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.SessionStateChanged,
        payload: { tabId, session: JsonCodec.value(joined.value), proposals: [] },
      }))
      await this.services.notifyTab(tabId, BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.RuntimeSync,
        payload: { session: JsonCodec.value(joined.value) },
      }))
      return { ok: true, session: JsonCodec.value(joined.value) }
    }
    if (envelope.type === BridgeMessageType.SessionGet) {
      const tabId = typeof payload.tabId === 'number' ? payload.tabId : senderTabId
      const session = await this.services.sessions.get(tabId)
      return { ok: true, session: session ? JsonCodec.value(session) : null }
    }
    if (envelope.type === BridgeMessageType.SessionAppend) {
      const tabId = typeof payload.tabId === 'number' && payload.tabId > 0 ? payload.tabId : senderTabId
      if (tabId <= 0 || payload.event === undefined) return { ok: false, code: FailureCode.BridgeInvalid }
      const event = SchemaCatalog.parseTraceEvent(payload.event)
      const session = await this.services.sessions.get(tabId)
      if (!event.valid || !session) return { ok: false, code: FailureCode.BridgeInvalid }
      const normalizedEvent = ChromePlatform.normalizeAgentInput(session, event.value)
      const appended = SessionMachine.append(session, normalizedEvent)
      if (!appended.valid) return { ok: false, code: appended.failure ?? FailureCode.InvalidSessionTransition }
      await this.services.sessions.save(tabId, appended.value)
      await this.services.notifyUi(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.SessionStateChanged,
        payload: { tabId, session: JsonCodec.value(appended.value), proposals: [] },
      }))
      return { ok: true, session: JsonCodec.value(appended.value) }
    }
    if (
      envelope.type === BridgeMessageType.ManualStop ||
      envelope.type === BridgeMessageType.SessionStop
    ) {
      const tabId = typeof payload.tabId === 'number' ? payload.tabId : senderTabId
      return this.finalizeSession(tabId, true)
    }
    if (envelope.type === BridgeMessageType.CapabilitiesList) {
      const origin = typeof payload.origin === 'string' ? payload.origin : ChromePlatform.page(senderUrl)?.origin
      if (!origin) return { ok: false, code: FailureCode.BridgeInvalid }
      const tabId = typeof payload.tabId === 'number' ? payload.tabId : senderTabId
      return {
        ok: true,
        tools: JsonCodec.value(await this.services.capabilities.listOrigin(origin)),
        proposals: JsonCodec.value(await this.services.listProposals(origin)),
        confirmations: JsonCodec.value(await this.services.listConfirmations(origin)),
        evidence: {
          proposals: JsonCodec.value(await this.services.listProposalHistory(origin)),
          confirmations: JsonCodec.value(await this.services.listConfirmationHistory(origin)),
          recentOutcome: JsonCodec.value(await this.services.continuations.getRecentOutcome(tabId)),
        },
      }
    }
    if (envelope.type === BridgeMessageType.CapabilitySetStatus) {
      if (
        typeof payload.tabId !== 'number' || typeof payload.origin !== 'string' ||
        typeof payload.name !== 'string' || typeof payload.revision !== 'number' ||
        typeof payload.status !== 'string' ||
        (payload.status !== CapabilityRevisionStatus.Active && payload.status !== CapabilityRevisionStatus.Disabled)
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      return this.services.setCapabilityStatus(
        payload.tabId, payload.origin, payload.name, payload.revision,
        payload.status as CapabilityRevisionStatus,
      )
    }
    if (envelope.type === BridgeMessageType.CapabilityDelete) {
      if (
        typeof payload.tabId !== 'number' || typeof payload.origin !== 'string' ||
        typeof payload.name !== 'string' || typeof payload.revision !== 'number'
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      return this.services.deleteCapability(payload.tabId, payload.origin, payload.name, payload.revision)
    }
    if (envelope.type === BridgeMessageType.ToolPackExport) {
      if (typeof payload.origin !== 'string' || !Array.isArray(payload.names)) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const names = payload.names.filter((value): value is string => typeof value === 'string')
      return this.services.exportToolPack(payload.origin, names)
    }
    if (envelope.type === BridgeMessageType.ToolPackImport) {
      if (
        typeof payload.tabId !== 'number' || typeof payload.origin !== 'string' ||
        typeof payload.path !== 'string' || payload.pack === undefined
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      return this.services.importToolPack(
        payload.tabId, { origin: payload.origin, path: payload.path }, payload.pack,
      )
    }
    if (envelope.type === BridgeMessageType.WorkflowPropose) {
      const page = ChromePlatform.page(senderUrl)
      if (!page) return { ok: false, code: FailureCode.BridgeInvalid }
      const session = await this.services.sessions.get(senderTabId)
      if (!session) return { ok: false, code: FailureCode.BridgeInvalid }
      return this.finalizeSession(senderTabId, session.mode !== LearningMode.Automatic)
    }
    if (envelope.type === BridgeMessageType.FailureReport) {
      const page = ChromePlatform.page(senderUrl)
      if (
        !page || typeof payload.toolName !== 'string' ||
        typeof payload.failureCode !== 'string' ||
        !Object.values(FailureCode).includes(payload.failureCode as FailureCode) ||
        typeof payload.failureMessage !== 'string'
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      const definition = await this.services.capabilities.getActive(page.origin, payload.toolName)
      if (!definition) return { ok: false, code: FailureCode.TargetMissing }
      await this.services.capabilities.recordFailure(
        page.origin,
        definition.name,
        definition.revision,
        { code: payload.failureCode as FailureCode, message: payload.failureMessage },
      )
      return { ok: true }
    }
    if (envelope.type === BridgeMessageType.RepairRequest) {
      const page = ChromePlatform.page(senderUrl)
      if (!page || typeof payload.toolName !== 'string') return { ok: false, code: FailureCode.BridgeInvalid }
      const definition = await this.services.capabilities.getActive(page.origin, payload.toolName)
      if (!definition) return { ok: false, code: FailureCode.TargetMissing }
      const session = SessionMachine.start({
        goal: definition.title,
        origin: page.origin,
        path: page.path,
        mode: LearningMode.Automatic,
        actor: SessionActor.Agent,
      }, { now: () => Date.now(), createId: () => crypto.randomUUID() })
      await this.services.sessions.save(senderTabId, session)
      const sync = BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.RuntimeSync,
        payload: { session: JsonCodec.value(session), tools: [] },
      })
      await this.services.notifyTab(senderTabId, sync)
      await this.services.notifyUi(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.SessionStateChanged,
        payload: { tabId: senderTabId, session: JsonCodec.value(session), proposals: [] },
      }))
      return { ok: true, session: JsonCodec.value(session) }
    }
    if (envelope.type === BridgeMessageType.ProposalResolve) {
      if (typeof payload.requestId !== 'string' || typeof payload.approved !== 'boolean') {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const tabId = typeof payload.tabId === 'number' ? payload.tabId : senderTabId
      return this.services.resolveProposal(tabId, payload.requestId, payload.approved)
    }
    if (envelope.type === BridgeMessageType.RuntimeExecute) {
      const page = ChromePlatform.page(senderUrl)
      if (!page || typeof payload.toolName !== 'string' || !JsonTypes.isObject(payload.input)) {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      return this.services.executeLearnedTool({
        tabId: senderTabId,
        origin: page.origin,
        path: page.path,
        toolName: payload.toolName,
        input: payload.input,
      })
    }
    if (envelope.type === BridgeMessageType.ConfirmationCreate) {
      const page = ChromePlatform.page(senderUrl)
      if (
        !page || typeof payload.action !== 'string' ||
        !Object.values(WorkflowAction).includes(payload.action as WorkflowAction) ||
        typeof payload.effect !== 'string' ||
        !Object.values(InteractionEffect).includes(payload.effect as InteractionEffect) ||
        typeof payload.target !== 'string'
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      const record = await this.services.createConfirmation({
        tabId: senderTabId,
        origin: page.origin,
        path: page.path,
        action: payload.action as WorkflowAction,
        effect: payload.effect as InteractionEffect,
        target: payload.target,
      })
      await this.services.notifyUi(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.ConfirmationStateChanged,
        payload: { tabId: senderTabId, confirmations: [JsonCodec.value(record)] },
      }))
      return JsonCodec.value(record)
    }
    if (envelope.type === BridgeMessageType.ConfirmationConsume) {
      const page = ChromePlatform.page(senderUrl)
      if (
        !page || typeof payload.requestId !== 'string' ||
        typeof payload.action !== 'string' ||
        !Object.values(WorkflowAction).includes(payload.action as WorkflowAction) ||
        typeof payload.effect !== 'string' ||
        !Object.values(InteractionEffect).includes(payload.effect as InteractionEffect) ||
        typeof payload.target !== 'string'
      ) return { ok: false, code: FailureCode.BridgeInvalid }
      const approved = await this.services.consumeConfirmation({
        requestId: payload.requestId,
        tabId: senderTabId,
        origin: page.origin,
        path: page.path,
        action: payload.action as WorkflowAction,
        effect: payload.effect as InteractionEffect,
        target: payload.target,
      })
      return { ok: true, approved }
    }
    if (envelope.type === BridgeMessageType.ConfirmationResolve) {
      if (typeof payload.requestId !== 'string' || typeof payload.approved !== 'boolean') {
        return { ok: false, code: FailureCode.BridgeInvalid }
      }
      const record = await this.services.resolveConfirmation(payload.requestId, payload.approved)
      return { ok: true, record: JsonCodec.value(record) }
    }
    if (envelope.type === BridgeMessageType.ProtocolInspect) {
      const page = ChromePlatform.page(senderUrl)
      if (!page) return { ok: false, code: FailureCode.BridgeInvalid }
      const session = await this.services.sessions.get(senderTabId)
      const records = await this.services.capabilities.listOrigin(page.origin)
      const outcome = await this.services.continuations.getRecentOutcome(senderTabId)
      return JsonCodec.value(
        ProtocolBuilder.inspect({
          origin: page.origin,
          path: page.path,
          ...(session ? { session } : {}),
          tools: records.filter((record) =>
            record.status === CapabilityRevisionStatus.Active &&
            record.health === CapabilityHealth.Healthy,
          ).map((record) => record.definition),
          failures: records.flatMap((record) => record.failure ? [JsonCodec.value(record.failure)] : []),
          recentOutcomes: outcome ? [JsonCodec.value(outcome)] : [],
        }),
      )
    }
    return { ok: false, code: FailureCode.BridgeInvalid }
  }

  private static parseEnvelope(value: JsonValue): BridgeEnvelope | null {
    const ui = BridgeEnvelopeCodec.parse(value, BridgeDirection.UiToBackground)
    if (ui.valid) return ui.value
    const page = BridgeEnvelopeCodec.parse(value, BridgeDirection.PageToExtension)
    return page.valid ? page.value : null
  }

  private static asObject(value: JsonValue): JsonObject | null {
    return JsonTypes.isObject(value) ? value : null
  }

  private static page(url: string): { readonly origin: string; readonly path: string } | null {
    try {
      const parsed = new URL(url)
      return { origin: parsed.origin, path: parsed.pathname }
    } catch {
      return null
    }
  }

  private static createSession(payload: JsonObject): LearningSession | null {
    if (
      typeof payload.goal !== 'string' ||
      typeof payload.origin !== 'string' ||
      typeof payload.path !== 'string' ||
      typeof payload.mode !== 'string' ||
      !Object.values(LearningMode).includes(payload.mode as LearningMode)
    ) return null
    const mode = payload.mode as LearningMode
    return SessionMachine.start(
      {
        goal: payload.goal,
        origin: payload.origin,
        path: payload.path,
        mode,
        actor: mode === LearningMode.Manual ? SessionActor.Human : SessionActor.Agent,
      },
      { now: () => Date.now(), createId: () => crypto.randomUUID() },
    )
  }

  private static createAgentSession(
    payload: JsonObject,
    page: { readonly origin: string; readonly path: string } | null,
  ): LearningSession | null {
    if (!page || typeof payload.goal !== 'string' || payload.goal.trim().length === 0) return null
    return SessionMachine.start(
      {
        goal: payload.goal.trim(),
        origin: page.origin,
        path: page.path,
        mode: LearningMode.Automatic,
        actor: SessionActor.Agent,
      },
      { now: () => Date.now(), createId: () => crypto.randomUUID() },
    )
  }

  private static normalizeAgentInput(
    session: LearningSession,
    event: TraceEvent,
  ): TraceEvent {
    if (event.source !== TraceSource.Agent || !event.inputReference) {
      return event
    }
    const inputCount = session.trace.filter((item) => item.inputReference).length + 1
    return { ...event, inputReference: `input_${inputCount}` }
  }

  private async finalizeSession(tabId: number, stopManual: boolean): Promise<JsonValue> {
    if (!this.services) return { ok: false, code: FailureCode.BridgeInvalid }
    const session = await this.services.sessions.get(tabId)
    if (!session) return { ok: false, code: FailureCode.BridgeInvalid, message: 'No active learning session was found.' }
    if (stopManual) {
      const stopped = await this.services.requestTab(tabId, BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.SessionStop,
        payload: { tabId },
      }))
      if (!JsonTypes.isObject(stopped) || stopped.ok !== true) {
        await this.resumeManual(tabId, session)
        return {
          ok: false,
          code: FailureCode.InvalidSessionTransition,
          message: JsonTypes.isObject(stopped) && typeof stopped.message === 'string'
            ? stopped.message
            : 'The page recorder did not stop cleanly. Reload the page and try again.',
          session: JsonCodec.value(session),
        }
      }
    }
    const drafting = SessionMachine.transition(session, SessionStatus.Drafting)
    if (!drafting.valid) return { ok: false, code: drafting.failure ?? FailureCode.InvalidSessionTransition }
    const name = TraceCompiler.toolName(drafting.value.goal)
    const revision = await this.services.capabilities.nextRevision(drafting.value.origin, name)
    const compiled = TraceCompiler.compile({ session: drafting.value, nextRevision: revision })
    if (!compiled.valid) {
      if (stopManual) await this.resumeManual(tabId, session)
      return {
        ok: false,
        code: compiled.failure ?? FailureCode.ExecutionError,
        message: compiled.issues[0]?.message ?? 'The recorded trace could not be compiled safely.',
        issues: JsonCodec.value(compiled.issues),
        session: JsonCodec.value(session),
      }
    }
    await this.services.sessions.save(tabId, drafting.value)
    const proposal = await this.services.propose({
      requestId: crypto.randomUUID(),
      sessionId: drafting.value.id,
      definition: compiled.value,
      scope: { origin: drafting.value.origin, path: drafting.value.currentPath },
    })
    const awaiting = SessionMachine.transition(drafting.value, SessionStatus.AwaitingReview)
    if (!awaiting.valid) return { ok: false, code: awaiting.failure ?? FailureCode.InvalidSessionTransition }
    await this.services.sessions.save(tabId, awaiting.value)
    const records = await this.services.capabilities.listOrigin(awaiting.value.origin)
    const tools = records.filter((record) =>
      record.status === CapabilityRevisionStatus.Active &&
      record.health === CapabilityHealth.Healthy,
    ).map((record) => record.definition)
    await this.services.notifyTab(tabId, BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(), direction: BridgeDirection.ExtensionToPage,
      type: BridgeMessageType.RuntimeSync,
      payload: { session: JsonCodec.value(awaiting.value), tools: JsonCodec.value(tools) },
    }))
    await this.services.notifyUi(BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
      type: BridgeMessageType.SessionStateChanged,
      payload: { tabId, session: JsonCodec.value(awaiting.value), proposals: [proposal] },
    }))
    return { ok: true, session: JsonCodec.value(awaiting.value), proposal }
  }

  private async resumeManual(tabId: number, session: LearningSession): Promise<void> {
    if (!this.services) return
    await this.services.notifyTab(tabId, BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(),
      direction: BridgeDirection.ExtensionToPage,
      type: BridgeMessageType.ManualStart,
      payload: { session: JsonCodec.value(session) },
    })).catch(() => undefined)
    await this.services.notifyUi(BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(),
      direction: BridgeDirection.BackgroundToUi,
      type: BridgeMessageType.SessionStateChanged,
      payload: { tabId, session: JsonCodec.value(session), proposals: [] },
    }))
  }
}

export interface BackgroundServices {
  readonly sessions: SessionRepository
  readonly capabilities: CapabilityRepository
  readonly continuations: ContinuationRepository
  injectMainWorld(tabId: number): Promise<void>
  injectContent(tabId: number): Promise<void>
  notifyTab(tabId: number, envelope: import('webmcp-capability-forge-core').BridgeEnvelope): Promise<void>
  requestTab(tabId: number, envelope: import('webmcp-capability-forge-core').BridgeEnvelope): Promise<JsonValue>
  notifyUi(envelope: import('webmcp-capability-forge-core').BridgeEnvelope): Promise<void>
  propose(request: import('./proposal-coordinator').ProposalRequest): Promise<JsonValue>
  resolveProposal(tabId: number, requestId: string, approved: boolean): Promise<JsonValue>
  listProposals(origin: string): Promise<readonly import('./proposal-coordinator').ProposalRecord[]>
  executeLearnedTool(request: import('./learned-tool-execution-coordinator').LearnedToolExecutionRequest): Promise<JsonValue>
  createConfirmation(request: import('./confirmation-coordinator').ConfirmationRequestDetails): Promise<import('../storage/confirmation-repository').ConfirmationRecord>
  consumeConfirmation(request: import('./confirmation-coordinator').ConfirmationConsumeRequest): Promise<boolean>
  resolveConfirmation(requestId: string, approved: boolean): Promise<import('../storage/confirmation-repository').ConfirmationRecord>
  listConfirmations(origin: string): Promise<readonly import('../storage/confirmation-repository').ConfirmationRecord[]>
  listProposalHistory(origin: string): Promise<readonly import('./proposal-coordinator').ProposalRecord[]>
  listConfirmationHistory(origin: string): Promise<readonly import('../storage/confirmation-repository').ConfirmationRecord[]>
  setCapabilityStatus(tabId: number, origin: string, name: string, revision: number, status: CapabilityRevisionStatus): Promise<JsonValue>
  deleteCapability(tabId: number, origin: string, name: string, revision: number): Promise<JsonValue>
  exportToolPack(origin: string, names: readonly string[]): Promise<JsonValue>
  importToolPack(tabId: number, scope: import('webmcp-capability-forge-core').ActivePageScope, pack: JsonValue): Promise<JsonValue>
  resumePage(event: import('webmcp-capability-forge-core').PageReadyEvent): Promise<JsonValue>
}
