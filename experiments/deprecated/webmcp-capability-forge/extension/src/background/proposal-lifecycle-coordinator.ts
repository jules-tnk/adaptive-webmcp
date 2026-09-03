import {
  SessionMachine,
  SessionStatus,
  VerificationStatus,
  type CapabilityDefinition,
  type LearningSession,
  type VerificationRecord,
} from 'webmcp-capability-forge-core'

import type { SessionRepository } from '../storage/session-repository'
import {
  ProposalStatus,
  type ProposalCoordinator,
  type ProposalRecord,
} from './proposal-coordinator'

export interface ProposalLifecycleResolution {
  readonly tabId: number
  readonly requestId: string
  readonly approved: boolean
}

export interface ProposalLifecycleResult {
  readonly record: ProposalRecord
  readonly session: LearningSession
  readonly verification?: VerificationRecord
}

export interface ProposalVerificationService {
  verify(tabId: number, definition: CapabilityDefinition): Promise<VerificationRecord>
}

export class ProposalLifecycleCoordinator {
  private readonly proposals: ProposalCoordinator
  private readonly sessions: SessionRepository
  private readonly verification: ProposalVerificationService

  constructor(
    proposals: ProposalCoordinator,
    sessions: SessionRepository,
    verification: ProposalVerificationService,
  ) {
    this.proposals = proposals
    this.sessions = sessions
    this.verification = verification
  }

  async resolve(resolution: ProposalLifecycleResolution): Promise<ProposalLifecycleResult> {
    const record = await this.proposals.resolve({
      requestId: resolution.requestId,
      approved: resolution.approved,
    })
    const session = await this.sessions.get(resolution.tabId)
    if (!session || session.id !== record.sessionId) {
      throw new Error('Proposal session was not found for the active tab.')
    }
    if (record.status === ProposalStatus.Rejected) {
      const rejected = ProposalLifecycleCoordinator.transition(session, SessionStatus.Rejected)
      await this.sessions.save(resolution.tabId, rejected)
      return { record, session: rejected }
    }
    const verifying = ProposalLifecycleCoordinator.transition(session, SessionStatus.Verifying)
    await this.sessions.save(resolution.tabId, verifying)
    const verification = await this.verification.verify(resolution.tabId, record.definition)
    const successful =
      verification.status === VerificationStatus.ReplayVerified ||
      verification.status === VerificationStatus.ReviewedNotReplayVerified
    const finalSession = ProposalLifecycleCoordinator.transition(
      verifying,
      successful ? SessionStatus.Active : SessionStatus.Failed,
    )
    await this.sessions.save(resolution.tabId, finalSession)
    return { record, verification, session: finalSession }
  }

  private static transition(session: LearningSession, status: SessionStatus): LearningSession {
    const transitioned = SessionMachine.transition(session, status)
    if (!transitioned.valid) throw new Error('Proposal session transition failed.')
    return transitioned.value
  }
}
