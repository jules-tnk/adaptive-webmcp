import type { FailureCode } from './error-contracts'
import type { WorkflowAction } from './workflow-contracts'
import type { JsonValue } from '../json/json-value'
import type { TargetStrategy } from '../selectors/selector-contracts'

export enum LearningMode {
  Manual = 'manual',
  Automatic = 'automatic',
  Hybrid = 'hybrid',
}

export enum SessionActor {
  Human = 'human',
  Agent = 'agent',
}

export enum SessionStatus {
  Idle = 'idle',
  AwaitingStartApproval = 'awaiting_start_approval',
  Collecting = 'collecting',
  Drafting = 'drafting',
  AwaitingReview = 'awaiting_review',
  Verifying = 'verifying',
  Active = 'active',
  Paused = 'paused',
  Rejected = 'rejected',
  Failed = 'failed',
}

export enum TraceSource {
  Human = 'human',
  Agent = 'agent',
  Verifier = 'verifier',
}

export enum TraceKeyKind {
  Printable = 'printable',
}

export enum SessionRecoveryAction {
  Stop = 'stop',
  HumanHandoff = 'human_handoff',
  RequestExtension = 'request_extension',
}

export interface BoundedObservation {
  readonly text?: string
  readonly attributes?: Readonly<Record<string, string>>
  readonly truncated: boolean
}

export interface TraceEvent {
  readonly id: string
  readonly source: TraceSource
  readonly action: WorkflowAction
  readonly target?: TargetStrategy
  readonly inputReference?: string
  readonly outcome?: BoundedObservation
  readonly data?: JsonValue
  readonly origin: string
  readonly path: string
  readonly timestamp: number
}

export interface LearningSession {
  readonly schemaVersion: 1
  readonly id: string
  readonly goal: string
  readonly origin: string
  readonly startPath: string
  readonly currentPath: string
  readonly mode: LearningMode
  readonly actor: SessionActor
  readonly status: SessionStatus
  readonly trace: readonly TraceEvent[]
  readonly agentActionCount: number
  readonly startedAt: number
  readonly updatedAt: number
  readonly expiresAt: number
  readonly pauseReason?: FailureCode
  readonly recoveryActions?: readonly SessionRecoveryAction[]
}

export interface StartSessionInput {
  readonly goal: string
  readonly origin: string
  readonly path: string
  readonly mode: LearningMode
  readonly actor: SessionActor
}

export interface SessionDependencies {
  now(): number
  createId(): string
}
