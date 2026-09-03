import { describe, expect, it } from 'vitest'

import {
  LearningMode,
  InteractionEffect,
  ExpectedEffectKind,
  SelectorKind,
  SemanticRole,
  SessionActor,
  SessionStatus,
  TraceCompiler,
  TraceSource,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type LearningSession,
  type TargetStrategy,
} from '../index'

const searchTarget: TargetStrategy = {
  role: SemanticRole.Textbox,
  name: 'Search catalog',
  candidates: [{
    kind: SelectorKind.AccessibleRole,
    selector: '[aria-label="Search catalog"]',
    score: 100,
    uniqueAtRecording: true,
  }],
}

const categoryTarget: TargetStrategy = {
  role: SemanticRole.Combobox,
  name: 'Category',
  candidates: [{
    kind: SelectorKind.AccessibleRole,
    selector: '[aria-label="Category"]',
    score: 100,
    uniqueAtRecording: true,
  }],
}

const shortlistTarget: TargetStrategy = {
  role: SemanticRole.Button,
  name: 'Shortlist',
  candidates: [{
    kind: SelectorKind.AccessibleRole,
    selector: 'button[aria-label="Shortlist"]',
    score: 100,
    uniqueAtRecording: true,
  }],
}

class CompilerFixtures {
  static session(trace: LearningSession['trace']): LearningSession {
    return {
      schemaVersion: 1,
      id: 'session-1',
      goal: 'Find and shortlist one item',
      origin: 'https://shop.example',
      startPath: '/catalog',
      currentPath: '/catalog',
      mode: LearningMode.Manual,
      actor: SessionActor.Human,
      status: SessionStatus.Drafting,
      trace,
      agentActionCount: 0,
      startedAt: 1000,
      updatedAt: 2000,
      expiresAt: 601000,
    }
  }
}

describe('TraceCompiler', () => {
  it('rejects an empty trace', () => {
    expect(TraceCompiler.compile({
      session: CompilerFixtures.session([]),
      nextRevision: 1,
    }).valid).toBe(false)
  })

  it('compiles recorded inputs and clicks into a validated proposed capability', () => {
    const session = CompilerFixtures.session([
      { id: 'event-1', source: TraceSource.Human, action: WorkflowAction.Fill, target: searchTarget, inputReference: 'input_1', origin: 'https://shop.example', path: '/catalog', timestamp: 1100 },
      { id: 'event-2', source: TraceSource.Human, action: WorkflowAction.Select, target: categoryTarget, inputReference: 'input_2', origin: 'https://shop.example', path: '/catalog', timestamp: 1200 },
      { id: 'event-3', source: TraceSource.Human, action: WorkflowAction.Click, target: shortlistTarget, origin: 'https://shop.example', path: '/catalog', timestamp: 1300 },
    ])

    const result = TraceCompiler.compile({ session, nextRevision: 1 })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.name).toBe('find_and_shortlist_one_item')
    expect(result.value.scope).toEqual({ origin: 'https://shop.example', pathPatterns: ['/catalog'] })
    expect(result.value.inputSchema.required).toEqual(['input_1', 'input_2'])
    expect(result.value.steps).toHaveLength(3)
    expect(result.value.steps[0]).toMatchObject({ action: WorkflowAction.Fill, value: { source: ValueSource.Input, name: 'input_1' } })
    expect(result.value.steps[1]).toMatchObject({ action: WorkflowAction.Select, value: { source: ValueSource.Input, name: 'input_2' } })
    expect(result.value.provenanceSummary).toEqual({ humanEvents: 3, agentEvents: 0, verifierEvents: 0 })
    expect(result.value.verification.status).toBe(VerificationStatus.Proposed)
    expect(result.value.revision).toBe(1)
  })

  it('preserves navigation clicks and their required route checkpoint', () => {
    const session = CompilerFixtures.session([
      {
        id: 'event-1', source: TraceSource.Human, action: WorkflowAction.Click,
        target: shortlistTarget, data: { effect: InteractionEffect.Navigation },
        origin: 'https://shop.example', path: '/catalog', timestamp: 1100,
      },
      {
        id: 'event-2', source: TraceSource.Human, action: WorkflowAction.WaitForUrl,
        origin: 'https://shop.example', path: '/results', timestamp: 1200,
      },
    ])

    const result = TraceCompiler.compile({ session: { ...session, currentPath: '/results' }, nextRevision: 1 })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.steps[0]).toMatchObject({
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
    })
    expect(result.value.steps[1]).toMatchObject({
      action: WorkflowAction.WaitForUrl,
      pathPattern: '/results',
    })
    expect(result.value.expectedEffects).toEqual([{
      kind: ExpectedEffectKind.UrlMatches,
      pathPattern: '/results',
    }])
  })

  it('validates the compacted workflow instead of rejecting redundant raw typing events', () => {
    const trace: LearningSession['trace'][number][] = []
    for (let index = 0; index < 21; index += 1) {
      trace.push({
        id: `key-${index}`, source: TraceSource.Human, action: WorkflowAction.Keypress,
        target: searchTarget, data: { key: 'a' }, origin: 'https://shop.example',
        path: '/catalog', timestamp: 1000 + index * 20,
      })
      trace.push({
        id: `fill-${index}`, source: TraceSource.Human, action: WorkflowAction.Fill,
        target: searchTarget, inputReference: `input_${index + 1}`,
        origin: 'https://shop.example', path: '/catalog', timestamp: 1010 + index * 20,
      })
    }
    trace.push({
      id: 'click', source: TraceSource.Human, action: WorkflowAction.Click,
      target: shortlistTarget, origin: 'https://shop.example', path: '/catalog', timestamp: 1500,
    })

    const result = TraceCompiler.compile({ session: CompilerFixtures.session(trace), nextRevision: 1 })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.steps).toHaveLength(2)
    expect(result.value.inputSchema.required).toEqual(['input_1'])
    expect(result.value.traceReduction).toEqual({
      rawEvents: 43,
      compiledEvents: 2,
      omittedEvents: 41,
    })
  })

  it('preserves semantic shortcut modifiers in the compiled keypress step', () => {
    const result = TraceCompiler.compile({
      session: CompilerFixtures.session([{
        id: 'shortcut', source: TraceSource.Human, action: WorkflowAction.Keypress,
        target: searchTarget,
        data: { key: 'k', ctrlKey: true, altKey: false, metaKey: false, shiftKey: false },
        origin: 'https://shop.example', path: '/catalog', timestamp: 1100,
      }]),
      nextRevision: 1,
    })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.steps[0]).toMatchObject({
      action: WorkflowAction.Keypress,
      key: 'k',
      ctrlKey: true,
      altKey: false,
      metaKey: false,
      shiftKey: false,
    })
  })
})
