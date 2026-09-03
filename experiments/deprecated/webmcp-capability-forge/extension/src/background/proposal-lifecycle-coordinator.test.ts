import { describe, expect, it } from 'vitest'

import {
  LearningMode,
  SessionActor,
  SessionMachine,
  SessionStatus,
  VerificationStatus,
  type CapabilityDefinition,
  type JsonObject,
  type VerificationRecord,
} from 'webmcp-capability-forge-core'

import { CapabilityRepository } from '../storage/capability-repository'
import { ProposalRepository } from '../storage/proposal-repository'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import { SessionRepository } from '../storage/session-repository'
import type { StorageArea } from '../storage/storage-area'
import { ProposalCoordinator } from './proposal-coordinator'
import {
  ProposalLifecycleCoordinator,
  type ProposalVerificationService,
} from './proposal-lifecycle-coordinator'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

class FixedVerificationService implements ProposalVerificationService {
  private readonly status: VerificationStatus
  constructor(status: VerificationStatus) { this.status = status }
  async verify(_tabId: number, _definition: CapabilityDefinition): Promise<VerificationRecord> {
    return {
      status: this.status,
      attempts: [{ id: 'attempt-1', status: this.status, startedAt: 10, completedAt: 20 }],
    }
  }
}

class ProposalLifecycleFixtures {
  static session(status: SessionStatus) {
    const collecting = SessionMachine.start({
      goal: 'Find a notebook',
      origin: 'https://one.example',
      path: '/catalog',
      mode: LearningMode.Manual,
      actor: SessionActor.Human,
    }, { now: () => 1, createId: () => 'session-1' })
    const drafting = SessionMachine.transition(collecting, SessionStatus.Drafting)
    if (!drafting.valid) throw new Error('Fixture drafting transition failed.')
    const awaiting = SessionMachine.transition(drafting.value, SessionStatus.AwaitingReview)
    if (!awaiting.valid) throw new Error('Fixture review transition failed.')
    if (status === SessionStatus.AwaitingReview) return awaiting.value
    throw new Error('Unsupported fixture status.')
  }
}

describe('ProposalLifecycleCoordinator', () => {
  it('persists Rejected when a pending proposal is rejected', async () => {
    const storage = new MemoryStorageArea()
    const sessions = new SessionRepository(storage, { now: () => 10 })
    const capabilities = new CapabilityRepository(storage)
    const proposals = new ProposalCoordinator(capabilities, new ProposalRepository(storage), { now: () => 10 })
    const definition = RepositoryTestFixtures.capability('https://one.example', 1, VerificationStatus.Proposed)
    await sessions.save(7, ProposalLifecycleFixtures.session(SessionStatus.AwaitingReview))
    await proposals.propose({
      requestId: 'proposal-1', sessionId: 'session-1', definition,
      scope: { origin: 'https://one.example', path: '/catalog' },
    })
    const coordinator = new ProposalLifecycleCoordinator(
      proposals, sessions, new FixedVerificationService(VerificationStatus.ReplayVerified),
    )

    const result = await coordinator.resolve({ tabId: 7, requestId: 'proposal-1', approved: false })

    expect(result.session.status).toBe(SessionStatus.Rejected)
    expect((await sessions.get(7))?.status).toBe(SessionStatus.Rejected)
    expect(result.verification).toBeUndefined()
  })

  it('persists Verifying then Active after replay verification', async () => {
    const storage = new MemoryStorageArea()
    const sessions = new SessionRepository(storage, { now: () => 10 })
    const capabilities = new CapabilityRepository(storage)
    const proposals = new ProposalCoordinator(capabilities, new ProposalRepository(storage), { now: () => 10 })
    const definition = RepositoryTestFixtures.capability('https://one.example', 1, VerificationStatus.Proposed)
    await sessions.save(7, ProposalLifecycleFixtures.session(SessionStatus.AwaitingReview))
    await proposals.propose({
      requestId: 'proposal-1', sessionId: 'session-1', definition,
      scope: { origin: 'https://one.example', path: '/catalog' },
    })
    const coordinator = new ProposalLifecycleCoordinator(
      proposals, sessions, new FixedVerificationService(VerificationStatus.ReplayVerified),
    )

    const result = await coordinator.resolve({ tabId: 7, requestId: 'proposal-1', approved: true })

    expect(result.verification?.attempts).toHaveLength(1)
    expect(result.session.status).toBe(SessionStatus.Active)
    expect((await sessions.get(7))?.status).toBe(SessionStatus.Active)
  })

  it('persists Failed when verification fails', async () => {
    const storage = new MemoryStorageArea()
    const sessions = new SessionRepository(storage, { now: () => 10 })
    const capabilities = new CapabilityRepository(storage)
    const proposals = new ProposalCoordinator(capabilities, new ProposalRepository(storage), { now: () => 10 })
    const definition = RepositoryTestFixtures.capability('https://one.example', 1, VerificationStatus.Proposed)
    await sessions.save(7, ProposalLifecycleFixtures.session(SessionStatus.AwaitingReview))
    await proposals.propose({
      requestId: 'proposal-1', sessionId: 'session-1', definition,
      scope: { origin: 'https://one.example', path: '/catalog' },
    })
    const coordinator = new ProposalLifecycleCoordinator(
      proposals, sessions, new FixedVerificationService(VerificationStatus.Failed),
    )

    const result = await coordinator.resolve({ tabId: 7, requestId: 'proposal-1', approved: true })

    expect(result.session.status).toBe(SessionStatus.Failed)
    expect((await sessions.get(7))?.status).toBe(SessionStatus.Failed)
  })
})
