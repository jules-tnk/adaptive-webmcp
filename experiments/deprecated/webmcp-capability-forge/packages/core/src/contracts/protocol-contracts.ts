import type { CapabilityDefinition } from './workflow-contracts'
import type { LearningSession } from './session-contracts'
import type { JsonObject, JsonValue } from '../json/json-value'

export enum BridgeProtocol {
  CapabilityForge = 'webmcp-capability-forge-bridge',
}

export enum BridgeDirection {
  PageToExtension = 'page-to-extension',
  ExtensionToPage = 'extension-to-page',
  UiToBackground = 'ui-to-background',
  BackgroundToUi = 'background-to-ui',
}

export enum BridgeMessageType {
  SiteEnable = 'site.enable',
  SiteDisable = 'site.disable',
  SiteStatus = 'site.status',
  PageReady = 'page.ready',
  RuntimeSync = 'runtime.sync',
  SessionGet = 'session.get',
  SessionAppend = 'session.append',
  SessionStop = 'session.stop',
  SessionStateChanged = 'session.state_changed',
  CapabilitiesList = 'capabilities.list',
  CapabilitySetStatus = 'capability.set_status',
  CapabilityDelete = 'capability.delete',
  ToolPackExport = 'toolpack.export',
  ToolPackImport = 'toolpack.import',
  ManualStart = 'manual.start',
  ManualStop = 'manual.stop',
  PageInspect = 'page.inspect',
  PageInteract = 'page.interact',
  PageObserve = 'page.observe',
  ContentResponse = 'content.response',
  ProtocolInspect = 'protocol.inspect',
  SessionBegin = 'session.begin',
  SessionJoin = 'session.join',
  FailureReport = 'failure.report',
  RepairRequest = 'repair.request',
  WorkflowPropose = 'workflow.propose',
  RuntimeExecute = 'runtime.execute',
  RuntimePreflight = 'runtime.preflight',
  ProposalResolve = 'proposal.resolve',
  ConfirmationCreate = 'confirmation.create',
  ConfirmationResolve = 'confirmation.resolve',
  ConfirmationConsume = 'confirmation.consume',
  ConfirmationStateChanged = 'confirmation.state_changed',
}

export interface BridgeEnvelope extends JsonObject {
  readonly protocol: BridgeProtocol.CapabilityForge
  readonly version: 1
  readonly requestId: string
  readonly direction: BridgeDirection
  readonly type: BridgeMessageType
  readonly payload: JsonValue
}

export interface CreateEnvelopeInput {
  readonly requestId: string
  readonly direction: BridgeDirection
  readonly type: BridgeMessageType
  readonly payload: JsonValue
}

export enum ForgeToolName {
  Bootstrap = 'capability_forge',
  InspectPage = 'forge_inspect_page',
  Interact = 'forge_interact',
  ObserveChanges = 'forge_observe_changes',
  ReadTrace = 'forge_read_trace',
  ProposeWorkflow = 'forge_propose_workflow',
}

export enum BootstrapOperation {
  Inspect = 'inspect',
  BeginSession = 'begin_session',
  JoinSession = 'join_session',
  ListTools = 'list_tools',
  ReportFailure = 'report_failure',
  RequestRepair = 'request_repair',
}

export enum ProtocolPhase {
  Reuse = 'reuse',
  Explore = 'explore',
  Model = 'model',
  Propose = 'propose',
  Improve = 'improve',
}

export interface ProtocolContext {
  readonly origin: string
  readonly path: string
  readonly session?: LearningSession
  readonly tools: readonly CapabilityDefinition[]
  readonly failures: readonly JsonValue[]
  readonly recentOutcomes: readonly JsonValue[]
}

export interface ProtocolPhaseInstruction {
  readonly phase: ProtocolPhase
  readonly instruction: string
}

export interface ProtocolConstraints {
  readonly maximumExplorationActions: 20
  readonly maximumSessionMs: 600000
  readonly maximumObservationBytes: 32768
  readonly sameOriginOnly: true
  readonly executableCodeAllowed: false
  readonly humanApprovalRequired: true
}

export interface ProtocolNextCall {
  readonly operation: BootstrapOperation
  readonly when: string
  readonly requiredFields: readonly string[]
}

export interface LearningProtocol {
  readonly protocolVersion: 1
  readonly instruction: string
  readonly page: { readonly origin: string; readonly path: string }
  readonly phases: readonly ProtocolPhaseInstruction[]
  readonly allowedActions: readonly import('./workflow-contracts').WorkflowAction[]
  readonly constraints: ProtocolConstraints
  readonly session?: LearningSession
  readonly tools: readonly CapabilityDefinition[]
  readonly failures: readonly JsonValue[]
  readonly recentOutcomes: readonly JsonValue[]
  readonly nextCalls: readonly ProtocolNextCall[]
}
