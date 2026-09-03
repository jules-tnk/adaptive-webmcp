import {
  CapabilityValidator,
  type ActivePageScope,
  type CapabilityDefinition,
} from 'webmcp-capability-forge-core'

import {
  CapabilityRevisionStatus,
  CapabilityRepository,
} from '../storage/capability-repository'
import {
  ProposalRepository,
  ProposalStatus,
  type ProposalRecord,
} from '../storage/proposal-repository'

export { ProposalStatus, type ProposalRecord } from '../storage/proposal-repository'

export interface ProposalRequest {
  readonly requestId: string
  readonly sessionId: string
  readonly definition: CapabilityDefinition
  readonly scope: ActivePageScope
}

export interface ProposalResolution {
  readonly requestId: string
  readonly approved: boolean
}

export interface ProposalDependencies {
  now(): number
}

const approvalTimeoutMs = 120_000

export class ProposalCoordinator {
  private readonly repository: CapabilityRepository
  private readonly proposals: ProposalRepository
  private readonly dependencies: ProposalDependencies

  constructor(
    repository: CapabilityRepository,
    proposals: ProposalRepository,
    dependencies: ProposalDependencies = { now: () => Date.now() },
  ) {
    this.repository = repository
    this.proposals = proposals
    this.dependencies = dependencies
  }

  async propose(request: ProposalRequest): Promise<ProposalRecord> {
    const validated = CapabilityValidator.validate(request.definition, request.scope)
    if (!validated.valid) throw new Error('Capability proposal failed validation.')
    await this.repository.save(validated.value, CapabilityRevisionStatus.Proposed)
    const record: ProposalRecord = {
      requestId: request.requestId,
      sessionId: request.sessionId,
      status: ProposalStatus.Pending,
      definition: validated.value,
      createdAt: this.dependencies.now(),
      expiresAt: this.dependencies.now() + approvalTimeoutMs,
    }
    await this.proposals.save(record)
    return structuredClone(record)
  }

  async resolve(resolution: ProposalResolution): Promise<ProposalRecord> {
    const pending = await this.proposals.get(resolution.requestId)
    if (!pending || pending.status !== ProposalStatus.Pending) throw new Error('Pending proposal was not found.')
    const path = pending.definition.scope.pathPatterns[0]
    if (!path) throw new Error('Pending proposal scope is invalid.')
    const validated = CapabilityValidator.validate(pending.definition, {
      origin: pending.definition.scope.origin,
      path: path.endsWith('*') ? path.slice(0, -1) : path,
    })
    if (!validated.valid) throw new Error('Capability proposal failed approval validation.')
    return this.proposals.resolve(
      resolution.requestId,
      resolution.approved ? ProposalStatus.Approved : ProposalStatus.Rejected,
    )
  }

  listPending(origin: string): Promise<readonly ProposalRecord[]> {
    return this.proposals.listPending(origin)
  }

  listHistory(origin: string): Promise<readonly ProposalRecord[]> {
    return this.proposals.listOrigin(origin)
  }
}
