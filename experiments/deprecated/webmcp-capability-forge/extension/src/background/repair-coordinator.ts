import type {
  CapabilityDefinition,
  FailureCode,
} from 'webmcp-capability-forge-core'

import {
  CapabilityRevisionStatus,
  CapabilityRepository,
  type CapabilityFailureRecord,
} from '../storage/capability-repository'

export interface RepairFailureRequest extends CapabilityFailureRecord {
  readonly origin: string
  readonly name: string
  readonly revision: number
  readonly code: FailureCode
}

export class RepairCoordinator {
  private readonly repository: CapabilityRepository

  constructor(repository: CapabilityRepository) {
    this.repository = repository
  }

  recordFailure(request: RepairFailureRequest): Promise<void> {
    return this.repository.recordFailure(request.origin, request.name, request.revision, {
      code: request.code,
      message: request.message,
      ...(request.failedStep === undefined ? {} : { failedStep: request.failedStep }),
    })
  }

  saveFailedReplacement(definition: CapabilityDefinition): Promise<void> {
    return this.repository.save(definition, CapabilityRevisionStatus.Failed)
  }
}
