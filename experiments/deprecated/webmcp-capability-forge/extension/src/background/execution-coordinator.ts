import {
  ExecutionStatus,
  FailureCode,
  type ExecutionCheckpoint,
  type ExecutionOutcome,
  type PageReadyEvent,
} from 'webmcp-capability-forge-core'

import { ContinuationRepository } from '../storage/continuation-repository'

export interface ExecutionResumePlatform {
  resume(checkpoint: ExecutionCheckpoint, event: PageReadyEvent): Promise<ExecutionOutcome>
}

export class ExecutionCoordinator {
  private readonly repository: ContinuationRepository
  private readonly platform: ExecutionResumePlatform

  constructor(repository: ContinuationRepository, platform: ExecutionResumePlatform) {
    this.repository = repository
    this.platform = platform
  }

  checkpoint(checkpoint: ExecutionCheckpoint): Promise<void> {
    return this.repository.saveCheckpoint(checkpoint)
  }

  async resume(event: PageReadyEvent): Promise<ExecutionOutcome> {
    const checkpoint = await this.repository.getCheckpoint(event.tabId)
    if (!checkpoint) {
      return ExecutionCoordinator.failed('missing', FailureCode.NavigationInterrupted, 'No navigation checkpoint is available.')
    }
    if (
      checkpoint.origin !== event.origin ||
      !ExecutionCoordinator.matches(event.path, checkpoint.expectedPath) ||
      event.timestamp > checkpoint.expiresAt
    ) {
      const outcome = ExecutionCoordinator.failed(checkpoint.executionId, FailureCode.RouteMismatch, 'The new document does not match the saved checkpoint.')
      await this.repository.saveOutcome(event.tabId, outcome)
      return outcome
    }
    const outcome = await this.platform.resume(checkpoint, event)
    await this.repository.saveOutcome(event.tabId, outcome)
    await this.repository.removeCheckpoint(event.tabId)
    return outcome
  }

  recentOutcome(tabId: number): Promise<ExecutionOutcome | null> {
    return this.repository.getRecentOutcome(tabId)
  }

  private static matches(path: string, pattern: string): boolean {
    return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern
  }

  private static failed(executionId: string, code: FailureCode, message: string): ExecutionOutcome {
    return { executionId, status: ExecutionStatus.Failed, completedSteps: 0, outputs: {}, failure: { code, message } }
  }
}
