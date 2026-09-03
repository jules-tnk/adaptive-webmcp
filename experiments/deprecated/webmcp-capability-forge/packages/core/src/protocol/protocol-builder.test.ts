import { describe, expect, it } from 'vitest'

import {
  BootstrapOperation,
  LearningMode,
  ProtocolBuilder,
  ProtocolPhase,
  SessionActor,
  SessionMachine,
  WorkflowAction,
} from '../index'

describe('ProtocolBuilder', () => {
  it('gives an unfamiliar agent the complete inspect-first learning contract', () => {
    const session = SessionMachine.start(
      {
        goal: 'Find a useful item',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Automatic,
        actor: SessionActor.Agent,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )

    const protocol = ProtocolBuilder.inspect({
      origin: 'https://shop.example',
      path: '/catalog',
      session,
      tools: [],
      failures: [],
      recentOutcomes: [],
    })

    expect(protocol.instruction).toContain(BootstrapOperation.Inspect)
    expect(protocol.phases.map((phase) => phase.phase)).toEqual([
      ProtocolPhase.Reuse,
      ProtocolPhase.Explore,
      ProtocolPhase.Model,
      ProtocolPhase.Propose,
      ProtocolPhase.Improve,
    ])
    expect(protocol.allowedActions).toContain(WorkflowAction.Click)
    expect(protocol.constraints.humanApprovalRequired).toBe(true)
    expect(protocol.page).toEqual({ origin: 'https://shop.example', path: '/catalog' })
    expect(protocol.session?.id).toBe('session-1')
    expect(protocol.nextCalls.map((call) => call.operation)).toContain(
      BootstrapOperation.RequestRepair,
    )
  })
})
