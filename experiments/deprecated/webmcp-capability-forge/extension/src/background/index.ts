import { ChromePlatform, ChromeSitePermissionPlatform } from './chrome-platform'
import { SitePermissions } from './site-permissions'
import { CapabilityRepository } from '../storage/capability-repository'
import {
  CapabilityHealth,
  CapabilityRevisionStatus,
} from '../storage/capability-repository'
import { ChromeStorageArea } from '../storage/chrome-storage-area'
import { SessionRepository } from '../storage/session-repository'
import { ContinuationRepository } from '../storage/continuation-repository'
import { JsonCodec } from '../storage/json-codec'
import {
  BridgeDirection,
  BridgeMessageType,
  ExecutionStatus,
  FailureCode,
  JsonTypes,
  LearningMode,
  SessionActor,
  SessionMachine,
  SessionStatus,
  VerificationStatus,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type ExecutionCheckpoint,
  type JsonObject,
  type PageReadyEvent,
  type JsonValue,
} from 'webmcp-capability-forge-core'
import { BridgeEnvelopeCodec } from '../bridge/bridge-envelope'
import { ProposalCoordinator } from './proposal-coordinator'
import { VerificationCoordinator, type VerificationPlatform } from './verification-coordinator'
import { ChromeTabPanelPlatform } from './chrome-tab-panel-platform'
import { TabPanelController } from './tab-panel-controller'
import { PanelViewRepository } from '../storage/panel-view-repository'
import { ProposalRepository } from '../storage/proposal-repository'
import { ConfirmationRepository } from '../storage/confirmation-repository'
import { ConfirmationCoordinator } from './confirmation-coordinator'
import { ToolPackExporter } from '../toolpack/toolpack-exporter'
import { ToolPackImporter } from '../toolpack/toolpack-importer'
import { ExecutionCoordinator, type ExecutionResumePlatform } from './execution-coordinator'
import { RepairCoordinator } from './repair-coordinator'
import {
  LearnedToolExecutionCoordinator,
  type LearnedToolExecutionPlatform,
} from './learned-tool-execution-coordinator'
import {
  ProposalLifecycleCoordinator,
  type ProposalVerificationService,
} from './proposal-lifecycle-coordinator'

const storage = new ChromeStorageArea()
const sessionRepository = new SessionRepository(storage)
const capabilityRepository = new CapabilityRepository(storage)
const continuationRepository = new ContinuationRepository(storage)
const proposalCoordinator = new ProposalCoordinator(
  capabilityRepository,
  new ProposalRepository(storage),
)
const panelViewRepository = new PanelViewRepository(storage)
const confirmationCoordinator = new ConfirmationCoordinator(new ConfirmationRepository(storage))
const tabPanelController = new TabPanelController(new ChromeTabPanelPlatform())

enum BackgroundAlarm {
  SessionExpiry = 'capability-forge-session-expiry',
}

void tabPanelController.initialize().catch(() => undefined)
chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    void tabPanelController.open(tab.id).catch((error: Error) => {
      console.error('Capability Forge could not open its tab-specific side panel.', error)
    })
  }
})
chrome.tabs.onRemoved.addListener((tabId) => {
  void panelViewRepository.remove(tabId).catch(() => undefined)
  void sessionRepository.pauseOnTabClose(tabId).catch(() => undefined)
})
chrome.alarms.create(BackgroundAlarm.SessionExpiry, { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BackgroundAlarm.SessionExpiry) {
    void sessionRepository.expireAll().catch(() => undefined)
  }
})

class TabVerificationPlatform implements VerificationPlatform {
  private readonly tabId: number
  constructor(tabId: number) { this.tabId = tabId }
  async preflight(definition: CapabilityDefinition) {
    const response = JsonCodec.value(await chrome.tabs.sendMessage(
      this.tabId,
      BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.RuntimePreflight,
        payload: { definition: JsonCodec.value(definition) },
      }),
    ))
    if (JsonTypes.isObject(response) && typeof response.ready === 'boolean' && JsonTypes.isObject(response.input)) {
      return { ready: response.ready, input: response.input }
    }
    return { ready: false, input: {} }
  }
  async replay(definition: CapabilityDefinition, input: JsonObject): Promise<ExecutionOutcome> {
    const response = JsonCodec.value(
      await chrome.tabs.sendMessage(
        this.tabId,
        BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.RuntimeExecute,
          payload: {
            executionId: crypto.randomUUID(),
            definition: JsonCodec.value(definition),
            input,
            confirmedStepIds: [],
          },
        }),
      ),
    )
    return BackgroundOutcome.parse(response)
  }
}

class BackgroundOutcome {
  static parse(value: JsonValue): ExecutionOutcome {
    if (
      JsonTypes.isObject(value) &&
      typeof value.executionId === 'string' &&
      typeof value.status === 'string' &&
      Object.values(ExecutionStatus).includes(value.status as ExecutionStatus) &&
      typeof value.completedSteps === 'number' &&
      JsonTypes.isObject(value.outputs)
    ) {
      return {
        executionId: value.executionId,
        status: value.status as ExecutionStatus,
        completedSteps: value.completedSteps,
        outputs: value.outputs,
        ...(JsonTypes.isObject(value.failure) &&
        typeof value.failure.code === 'string' &&
        Object.values(FailureCode).includes(value.failure.code as FailureCode) &&
        typeof value.failure.message === 'string'
          ? {
              failure: {
                code: value.failure.code as FailureCode,
                message: value.failure.message,
                ...(typeof value.failure.failedStep === 'number'
                  ? { failedStep: value.failure.failedStep }
                  : {}),
              },
            }
          : {}),
      }
    }
    return {
      executionId: crypto.randomUUID(),
      status: ExecutionStatus.Failed,
      completedSteps: 0,
      outputs: {},
      failure: { code: FailureCode.ExecutionError, message: 'Verification replay failed.' },
    }
  }
}

class TabProposalVerificationService implements ProposalVerificationService {
  async verify(tabId: number, definition: CapabilityDefinition) {
    return new VerificationCoordinator(
      capabilityRepository,
      new TabVerificationPlatform(tabId),
    ).verify({ definition })
  }
}

class TabLearnedToolExecutionPlatform implements LearnedToolExecutionPlatform {
  async execute(tabId: number, definition: CapabilityDefinition, input: JsonObject): Promise<ExecutionOutcome> {
    return BackgroundExecution.send(tabId, definition, input)
  }
}

class BackgroundExecution {
  static async send(
    tabId: number,
    definition: CapabilityDefinition,
    input: JsonObject,
    startStep?: number,
  ): Promise<ExecutionOutcome> {
    try {
      const response = JsonCodec.value(await chrome.tabs.sendMessage(
        tabId,
        BridgeEnvelopeCodec.create({
          requestId: crypto.randomUUID(),
          direction: BridgeDirection.ExtensionToPage,
          type: BridgeMessageType.RuntimeExecute,
          payload: {
            executionId: crypto.randomUUID(),
            definition: JsonCodec.value(definition),
            input,
            confirmedStepIds: [],
            ...(startStep === undefined ? {} : { startStep }),
          },
        }),
      ))
      return BackgroundOutcome.parse(response)
    } catch {
      return {
        executionId: crypto.randomUUID(), status: ExecutionStatus.Failed,
        completedSteps: startStep ?? 0, outputs: {},
        failure: { code: FailureCode.NavigationInterrupted, message: 'Execution paused for page navigation.' },
      }
    }
  }
}

class TabExecutionResumePlatform implements ExecutionResumePlatform {
  async resume(checkpoint: ExecutionCheckpoint, _event: PageReadyEvent): Promise<ExecutionOutcome> {
    const record = await capabilityRepository.getRecord(
      checkpoint.origin,
      checkpoint.capabilityName,
      checkpoint.capabilityRevision,
    )
    if (!record) {
      return {
        executionId: checkpoint.executionId, status: ExecutionStatus.Failed,
        completedSteps: checkpoint.nextStep, outputs: {},
        failure: { code: FailureCode.StaleRevision, message: 'The saved navigation revision is unavailable.' },
      }
    }
    return BackgroundExecution.send(
      checkpoint.tabId, record.definition, checkpoint.input, checkpoint.nextStep,
    )
  }
}

const proposalLifecycleCoordinator = new ProposalLifecycleCoordinator(
  proposalCoordinator,
  sessionRepository,
  new TabProposalVerificationService(),
)
const learnedToolExecutionCoordinator = new LearnedToolExecutionCoordinator(
  capabilityRepository,
  continuationRepository,
  new RepairCoordinator(capabilityRepository),
  new TabLearnedToolExecutionPlatform(),
)
const executionCoordinator = new ExecutionCoordinator(
  continuationRepository,
  new TabExecutionResumePlatform(),
)

class BackgroundRuntimeSync {
  static async send(tabId: number, origin: string): Promise<void> {
    const records = await capabilityRepository.listOrigin(origin)
    const tools = records.filter((record) =>
      record.status === CapabilityRevisionStatus.Active &&
      record.health === CapabilityHealth.Healthy,
    ).map((record) => record.definition)
    const session = await sessionRepository.get(tabId)
    await chrome.tabs.sendMessage(tabId, BridgeEnvelopeCodec.create({
      requestId: crypto.randomUUID(),
      direction: BridgeDirection.ExtensionToPage,
      type: BridgeMessageType.RuntimeSync,
      payload: { ...(session ? { session: JsonCodec.value(session) } : {}), tools: JsonCodec.value(tools) },
    })).catch(() => undefined)
  }
}

class TabMessages {
  static request(tabId: number, envelope: import('webmcp-capability-forge-core').BridgeEnvelope): Promise<JsonValue> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({
        ok: false,
        code: FailureCode.Timeout,
        message: 'The page recorder did not answer within five seconds.',
      }), 5_000)
      void chrome.tabs.sendMessage(tabId, envelope).then((response) => {
        clearTimeout(timeout)
        resolve(JsonCodec.value(response))
      }).catch(() => {
        clearTimeout(timeout)
        resolve({
          ok: false,
          code: FailureCode.NavigationInterrupted,
          message: 'The page recorder is unavailable after navigation.',
        })
      })
    })
  }
}
const platform = new ChromePlatform(
  new SitePermissions(new ChromeSitePermissionPlatform()),
  {
    sessions: sessionRepository,
    capabilities: capabilityRepository,
    continuations: continuationRepository,
    async injectMainWorld(tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['main-world.js'], world: 'MAIN' })
    },
    async injectContent(tabId) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'], world: 'ISOLATED' })
    },
    async notifyTab(tabId, envelope) {
      await chrome.tabs.sendMessage(tabId, envelope)
    },
    async requestTab(tabId, envelope) {
      return TabMessages.request(tabId, envelope)
    },
    async notifyUi(envelope) {
      await chrome.runtime.sendMessage(envelope).catch(() => undefined)
    },
    async propose(request) {
      return JsonCodec.value(await proposalCoordinator.propose(request))
    },
    async resolveProposal(tabId, requestId, approved) {
      const result = await proposalLifecycleCoordinator.resolve({
        tabId,
        requestId,
        approved,
      })
      const records = await capabilityRepository.listOrigin(result.record.definition.scope.origin)
      const tools = records.filter((record) =>
        record.status === CapabilityRevisionStatus.Active &&
        record.health === CapabilityHealth.Healthy,
      ).map((record) => record.definition)
      await chrome.tabs.sendMessage(tabId, BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.RuntimeSync,
        payload: { session: JsonCodec.value(result.session), tools: JsonCodec.value(tools) },
      })).catch(() => undefined)
      return JsonCodec.value(result)
    },
    listProposals(origin) {
      return proposalCoordinator.listPending(origin)
    },
    async executeLearnedTool(request) {
      const outcome = await learnedToolExecutionCoordinator.execute(request)
      const records = await capabilityRepository.listOrigin(request.origin)
      const tools = records.filter((record) =>
        record.status === CapabilityRevisionStatus.Active &&
        record.health === CapabilityHealth.Healthy,
      ).map((record) => record.definition)
      const session = await sessionRepository.get(request.tabId)
      await chrome.tabs.sendMessage(request.tabId, BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(),
        direction: BridgeDirection.ExtensionToPage,
        type: BridgeMessageType.RuntimeSync,
        payload: { ...(session ? { session: JsonCodec.value(session) } : {}), tools: JsonCodec.value(tools) },
      })).catch(() => undefined)
      return JsonCodec.value(outcome)
    },
    createConfirmation(request) {
      return confirmationCoordinator.create(request)
    },
    consumeConfirmation(request) {
      return confirmationCoordinator.consume(request)
    },
    resolveConfirmation(requestId, approved) {
      return confirmationCoordinator.resolve(requestId, approved)
    },
    listConfirmations(origin) {
      return confirmationCoordinator.listPending(origin)
    },
    listProposalHistory(origin) {
      return proposalCoordinator.listHistory(origin)
    },
    listConfirmationHistory(origin) {
      return confirmationCoordinator.listHistory(origin)
    },
    async setCapabilityStatus(tabId, origin, name, revision, status) {
      const record = await capabilityRepository.getRecord(origin, name, revision)
      if (!record) return JsonCodec.object({ ok: false, code: FailureCode.TargetMissing })
      if (
        status === CapabilityRevisionStatus.Active &&
        record.definition.verification.status !== VerificationStatus.ReplayVerified &&
        record.definition.verification.status !== VerificationStatus.ReviewedNotReplayVerified
      ) return JsonCodec.object({ ok: false, code: FailureCode.ExecutionError })
      await capabilityRepository.setStatus(origin, name, revision, status)
      await BackgroundRuntimeSync.send(tabId, origin)
      return JsonCodec.object({ ok: true, tools: JsonCodec.value(await capabilityRepository.listOrigin(origin)) })
    },
    async deleteCapability(tabId, origin, name, revision) {
      await capabilityRepository.remove(origin, name, revision)
      await BackgroundRuntimeSync.send(tabId, origin)
      return JsonCodec.object({ ok: true, tools: JsonCodec.value(await capabilityRepository.listOrigin(origin)) })
    },
    async exportToolPack(origin, names) {
      const selected = (await capabilityRepository.listOrigin(origin)).filter((record) =>
        names.includes(record.name) &&
        (record.status === CapabilityRevisionStatus.Active || record.status === CapabilityRevisionStatus.Guarded) &&
        (record.definition.verification.status === VerificationStatus.ReplayVerified ||
          record.definition.verification.status === VerificationStatus.ReviewedNotReplayVerified),
      ).map((record) => record.definition)
      return JsonCodec.object({ ok: true, pack: JsonCodec.value(ToolPackExporter.create(origin, selected, new Date().toISOString())) })
    },
    async importToolPack(tabId, scope, pack) {
      const converted = ToolPackImporter.convert(pack, scope)
      if (!converted.valid || converted.value.length !== 1) {
        return JsonCodec.object({ ok: false, code: FailureCode.BridgeInvalid, ...(converted.valid ? {} : { issues: JsonCodec.value(converted.issues) }) })
      }
      const imported = converted.value[0]
      if (!imported) return JsonCodec.object({ ok: false, code: FailureCode.BridgeInvalid })
      const revision = await capabilityRepository.nextRevision(scope.origin, imported.name)
      const definition = { ...imported, revision }
      const collecting = SessionMachine.start({
        goal: `Import ${definition.title}`,
        origin: scope.origin,
        path: scope.path,
        mode: LearningMode.Manual,
        actor: SessionActor.Human,
      }, { now: () => Date.now(), createId: () => crypto.randomUUID() })
      const drafting = SessionMachine.transition(collecting, SessionStatus.Drafting)
      if (!drafting.valid) return JsonCodec.object({ ok: false, code: FailureCode.InvalidSessionTransition })
      const awaiting = SessionMachine.transition(drafting.value, SessionStatus.AwaitingReview)
      if (!awaiting.valid) return JsonCodec.object({ ok: false, code: FailureCode.InvalidSessionTransition })
      await sessionRepository.save(tabId, awaiting.value)
      const proposal = await proposalCoordinator.propose({
        requestId: crypto.randomUUID(), sessionId: awaiting.value.id, definition,
        scope,
      })
      await chrome.runtime.sendMessage(BridgeEnvelopeCodec.create({
        requestId: crypto.randomUUID(), direction: BridgeDirection.BackgroundToUi,
        type: BridgeMessageType.SessionStateChanged,
        payload: { tabId, session: JsonCodec.value(awaiting.value), proposals: [JsonCodec.value(proposal)] },
      })).catch(() => undefined)
      return JsonCodec.object({ ok: true, session: JsonCodec.value(awaiting.value), proposal: JsonCodec.value(proposal) })
    },
    async resumePage(event) {
      const checkpoint = await continuationRepository.getCheckpoint(event.tabId)
      if (!checkpoint) return JsonCodec.object({ ok: true, resumed: false })
      return JsonCodec.value(await executionCoordinator.resume(event))
    },
  },
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void platform
    .handle(message, sender.tab?.id ?? 0, sender.tab?.url ?? '')
    .then(sendResponse)
    .catch((error: Error) => {
      console.error('Capability Forge background request failed.', error)
      sendResponse({
        ok: false,
        code: FailureCode.ExecutionError,
        message: error.message || 'The background request failed unexpectedly.',
      })
    })
  return true
})
