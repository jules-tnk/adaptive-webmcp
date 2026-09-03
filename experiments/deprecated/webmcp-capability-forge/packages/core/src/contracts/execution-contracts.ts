import type { FailureCode } from './error-contracts'
import type { JsonObject } from '../json/json-value'

export enum ExecutionStatus {
  Running = 'running',
  AwaitingDocument = 'awaiting_document',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface ExecutionFailure {
  readonly code: FailureCode
  readonly message: string
  readonly failedStep?: number
}

export interface ExecutionOutcome {
  readonly executionId: string
  readonly status: ExecutionStatus
  readonly completedSteps: number
  readonly outputs: JsonObject
  readonly failure?: ExecutionFailure
}

export interface ExecutionCheckpoint {
  readonly executionId: string
  readonly tabId: number
  readonly origin: string
  readonly expectedPath: string
  readonly capabilityName: string
  readonly capabilityRevision: number
  readonly nextStep: number
  readonly input: JsonObject
  readonly expiresAt: number
}

export interface PageReadyEvent {
  readonly tabId: number
  readonly origin: string
  readonly path: string
  readonly timestamp: number
}
