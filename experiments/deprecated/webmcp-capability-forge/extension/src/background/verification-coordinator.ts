import {
  CapabilityClassification,
  ExecutionStatus,
  VerificationStatus,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type JsonObject,
  type VerificationAttempt,
  type VerificationRecord,
} from 'webmcp-capability-forge-core'

import {
  CapabilityRevisionStatus,
  CapabilityRepository,
} from '../storage/capability-repository'

export interface VerificationPlatform {
  preflight(definition: CapabilityDefinition): Promise<VerificationPreflight>
  replay(definition: CapabilityDefinition, input: JsonObject): Promise<ExecutionOutcome>
}

export interface VerificationPreflight {
  readonly ready: boolean
  readonly input: JsonObject
}

export interface VerificationDependencies {
  now(): number
  createId(): string
}

export interface VerificationRequest {
  readonly definition: CapabilityDefinition
}

export class VerificationCoordinator {
  private readonly repository: CapabilityRepository
  private readonly platform: VerificationPlatform
  private readonly dependencies: VerificationDependencies

  constructor(
    repository: CapabilityRepository,
    platform: VerificationPlatform,
    dependencies: VerificationDependencies = {
      now: () => Date.now(),
      createId: () => crypto.randomUUID(),
    },
  ) {
    this.repository = repository
    this.platform = platform
    this.dependencies = dependencies
  }

  async verify(request: VerificationRequest): Promise<VerificationRecord> {
    const startedAt = this.dependencies.now()
    const attemptId = this.dependencies.createId()
    const preflight = await this.platform.preflight(request.definition)
    if (!preflight.ready || request.definition.classification === CapabilityClassification.BlockedSensitive) {
      return this.store(request.definition, VerificationStatus.Failed, CapabilityRevisionStatus.Failed, {
        id: attemptId, status: VerificationStatus.Failed, startedAt, completedAt: this.dependencies.now(),
      })
    }
    if (request.definition.classification === CapabilityClassification.ExternalWrite) {
      return this.store(
        request.definition,
        VerificationStatus.ReviewedNotReplayVerified,
        CapabilityRevisionStatus.Guarded,
        { id: attemptId, status: VerificationStatus.ReviewedNotReplayVerified, startedAt, completedAt: this.dependencies.now() },
      )
    }
    const replay = await this.platform.replay(request.definition, preflight.input)
    return replay.status === ExecutionStatus.Completed
      ? this.store(request.definition, VerificationStatus.ReplayVerified, CapabilityRevisionStatus.Active, {
          id: attemptId, status: VerificationStatus.ReplayVerified, startedAt, completedAt: this.dependencies.now(),
        })
      : this.store(request.definition, VerificationStatus.Failed, CapabilityRevisionStatus.Failed, {
          id: attemptId, status: VerificationStatus.Failed, startedAt, completedAt: this.dependencies.now(),
        })
  }

  private async store(
    definition: CapabilityDefinition,
    status: VerificationStatus,
    revisionStatus: CapabilityRevisionStatus,
    attempt: VerificationAttempt,
  ): Promise<VerificationRecord> {
    const verification: VerificationRecord = { status, attempts: [attempt] }
    await this.repository.save({ ...definition, verification }, revisionStatus)
    return verification
  }
}
