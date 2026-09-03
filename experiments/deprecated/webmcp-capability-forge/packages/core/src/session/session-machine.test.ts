import { describe, expect, it } from 'vitest'

import {
  FailureCode,
  LearningMode,
  SessionActor,
  SessionMachine,
  SessionRecoveryAction,
  SessionStatus,
  TraceSource,
  WorkflowAction,
  type LearningSession,
  type SessionDependencies,
  type TraceEvent,
  type ValidationResult,
} from '../index'

const dependencies: SessionDependencies = {
  now: () => 1000,
  createId: () => 'session-1',
}

const startHybrid = (): LearningSession =>
  SessionMachine.start(
    {
      goal: 'Find and shortlist an item',
      origin: 'https://shop.example',
      path: '/catalog',
      mode: LearningMode.Hybrid,
      actor: SessionActor.Human,
    },
    dependencies,
  )

const event = (id: string, source: TraceSource, timestamp: number): TraceEvent => ({
  id,
  source,
  action: WorkflowAction.Click,
  origin: 'https://shop.example',
  path: '/catalog',
  timestamp,
})

const valueOf = (result: ValidationResult<LearningSession>): LearningSession => {
  if (!result.valid) throw new Error('Expected a valid session result.')
  return result.value
}

describe('SessionMachine', () => {
  it('derives Hybrid mode when both Human and Agent events are present', () => {
    const manual = SessionMachine.start(
      {
        goal: 'Find an item',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Manual,
        actor: SessionActor.Human,
      },
      dependencies,
    )
    const human = valueOf(SessionMachine.append(manual, event('human-1', TraceSource.Human, 1100)))
    const mixed = valueOf(SessionMachine.append(human, event('agent-1', TraceSource.Agent, 1200)))

    expect(human.mode).toBe(LearningMode.Manual)
    expect(mixed.mode).toBe(LearningMode.Hybrid)
  })

  it('preserves Human, Agent, and Verifier events without mutating prior snapshots', () => {
    const started = startHybrid()
    const manual = valueOf(
      SessionMachine.append(started, event('event-1', TraceSource.Human, 1100)),
    )
    const handedOff = valueOf(SessionMachine.handoff(manual, SessionActor.Agent))
    const explored = valueOf(
      SessionMachine.append(handedOff, event('event-2', TraceSource.Agent, 1200)),
    )
    const verified = valueOf(
      SessionMachine.append(explored, event('event-3', TraceSource.Verifier, 1300)),
    )

    expect(verified.trace.map((traceEvent) => traceEvent.source)).toEqual([
      TraceSource.Human,
      TraceSource.Agent,
      TraceSource.Verifier,
    ])
    expect(started.trace).toEqual([])
    expect(manual.trace).toHaveLength(1)
    expect(explored.trace).toHaveLength(2)
  })

  it('rejects an illegal session transition', () => {
    const result = SessionMachine.transition(startHybrid(), SessionStatus.Active)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.failure).toBe(FailureCode.InvalidSessionTransition)
    }
  })

  it('pauses after the twentieth agent interaction', () => {
    let session = valueOf(SessionMachine.handoff(startHybrid(), SessionActor.Agent))

    for (let index = 1; index <= 20; index += 1) {
      session = valueOf(
        SessionMachine.append(
          session,
          event(`event-${index}`, TraceSource.Agent, 1000 + index),
        ),
      )
    }

    expect(session.trace).toHaveLength(20)
    expect(session.agentActionCount).toBe(20)
    expect(session.status).toBe(SessionStatus.Paused)
    expect(session.pauseReason).toBe(FailureCode.SessionLimitReached)
    expect(session.recoveryActions).toEqual([
      SessionRecoveryAction.Stop,
      SessionRecoveryAction.HumanHandoff,
      SessionRecoveryAction.RequestExtension,
    ])
  })

  it('expires a collecting session after ten minutes', () => {
    const expired = SessionMachine.expire(startHybrid(), 601000)

    expect(expired.status).toBe(SessionStatus.Paused)
    expect(expired.pauseReason).toBe(FailureCode.SessionLimitReached)
  })
})
