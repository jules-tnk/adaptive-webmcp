import type {
  InteractionEffect,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import {
  ConfirmationRepository,
  ConfirmationStatus,
  type ConfirmationRecord,
} from '../storage/confirmation-repository'

export interface ConfirmationRequestDetails {
  readonly tabId: number
  readonly origin: string
  readonly path: string
  readonly action: WorkflowAction
  readonly effect: InteractionEffect
  readonly target: string
}

export interface ConfirmationConsumeRequest extends ConfirmationRequestDetails {
  readonly requestId: string
}

export interface ConfirmationDependencies {
  now(): number
  createId(): string
}

const confirmationDurationMs = 120_000

export class ConfirmationCoordinator {
  private readonly repository: ConfirmationRepository
  private readonly dependencies: ConfirmationDependencies

  constructor(
    repository: ConfirmationRepository,
    dependencies: ConfirmationDependencies = {
      now: () => Date.now(),
      createId: () => crypto.randomUUID(),
    },
  ) {
    this.repository = repository
    this.dependencies = dependencies
  }

  async create(details: ConfirmationRequestDetails): Promise<ConfirmationRecord> {
    const createdAt = this.dependencies.now()
    const record: ConfirmationRecord = {
      requestId: this.dependencies.createId(),
      ...details,
      status: ConfirmationStatus.Pending,
      createdAt,
      expiresAt: createdAt + confirmationDurationMs,
    }
    await this.repository.save(record)
    return record
  }

  async resolve(requestId: string, approved: boolean): Promise<ConfirmationRecord> {
    const current = await this.repository.get(requestId)
    if (!current || current.status !== ConfirmationStatus.Pending) {
      throw new Error('Pending confirmation request was not found.')
    }
    return this.repository.resolve(
      requestId,
      approved ? ConfirmationStatus.Approved : ConfirmationStatus.Rejected,
    )
  }

  async consume(request: ConfirmationConsumeRequest): Promise<boolean> {
    const record = await this.repository.get(request.requestId)
    if (!record || record.status !== ConfirmationStatus.Approved) return false
    if (record.expiresAt < this.dependencies.now()) {
      await this.repository.resolve(request.requestId, ConfirmationStatus.Expired)
      return false
    }
    if (
      record.tabId !== request.tabId || record.origin !== request.origin ||
      record.path !== request.path || record.action !== request.action ||
      record.effect !== request.effect || record.target !== request.target
    ) return false
    await this.repository.resolve(request.requestId, ConfirmationStatus.Consumed)
    return true
  }

  get(requestId: string): Promise<ConfirmationRecord | null> {
    return this.repository.get(requestId)
  }

  listPending(origin: string): Promise<readonly ConfirmationRecord[]> {
    return this.repository.listPending(origin)
  }

  listHistory(origin: string): Promise<readonly ConfirmationRecord[]> {
    return this.repository.listOrigin(origin)
  }
}
