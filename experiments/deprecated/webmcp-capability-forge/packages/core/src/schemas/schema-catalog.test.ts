import { describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  ExpectedEffectKind,
  JsonSchemaType,
  LearningMode,
  SchemaCatalog,
  SelectorKind,
  SemanticRole,
  SessionActor,
  SessionStatus,
  VerificationStatus,
  WorkflowAction,
  type JsonObject,
} from '../index'

const target: JsonObject = {
  role: SemanticRole.Button,
  name: 'Search',
  candidates: [
    {
      kind: SelectorKind.AccessibleRole,
      selector: '[aria-label="Search"]',
      score: 100,
      uniqueAtRecording: true,
    },
  ],
}

const validCapability: JsonObject = {
  schemaVersion: 1,
  name: 'find_and_shortlist_item',
  title: 'Find and shortlist item',
  description: 'Search the catalog and shortlist one matching item.',
  scope: {
    origin: 'https://shop.example',
    pathPatterns: ['/catalog*'],
  },
  inputSchema: {
    type: JsonSchemaType.Object,
    properties: {},
    required: [],
    additionalProperties: false,
  },
  classification: CapabilityClassification.Read,
  steps: [
    {
      id: 'step-1',
      action: WorkflowAction.Click,
      target,
    },
  ],
  expectedEffects: [
    {
      kind: ExpectedEffectKind.ElementVisible,
      target,
    },
  ],
  provenanceSummary: {
    humanEvents: 1,
    agentEvents: 0,
    verifierEvents: 0,
  },
  verification: {
    status: VerificationStatus.Proposed,
    attempts: [],
  },
  revision: 1,
}

describe('SchemaCatalog', () => {
  it('parses a collecting Hybrid session', () => {
    const session: JsonObject = {
      schemaVersion: 1,
      id: 'session-1',
      goal: 'Find and shortlist a useful item',
      origin: 'https://shop.example',
      startPath: '/catalog',
      currentPath: '/catalog',
      mode: LearningMode.Hybrid,
      actor: SessionActor.Human,
      status: SessionStatus.Collecting,
      trace: [],
      agentActionCount: 0,
      startedAt: 1000,
      updatedAt: 1000,
      expiresAt: 601000,
    }

    const result = SchemaCatalog.parseSession(session)

    expect(result.valid).toBe(true)
    if (result.valid) expect(result.value.mode).toBe(LearningMode.Hybrid)
  })

  it('rejects an unsupported workflow action', () => {
    const capability: JsonObject = {
      ...validCapability,
      steps: [{ id: 'step-1', action: 'executeJavascript', target }],
    }

    expect(SchemaCatalog.parseCapability(capability).valid).toBe(false)
  })

  it('rejects a non-http origin', () => {
    const capability: JsonObject = {
      ...validCapability,
      scope: { origin: 'javascript:alert(1)', pathPatterns: ['/catalog*'] },
    }

    expect(SchemaCatalog.parseCapability(capability).valid).toBe(false)
  })

  it('accepts 250 workflow steps and rejects 251', () => {
    const accepted: JsonObject = {
      ...validCapability,
      steps: Array.from({ length: 250 }, (_, index) => ({
        id: `step-${index + 1}`,
        action: WorkflowAction.Click,
        target,
      })),
    }
    const rejected: JsonObject = {
      ...accepted,
      steps: Array.from({ length: 251 }, (_, index) => ({
        id: `step-${index + 1}`,
        action: WorkflowAction.Click,
        target,
      })),
    }

    expect(SchemaCatalog.parseCapability(accepted).valid).toBe(true)
    expect(SchemaCatalog.parseCapability(rejected).valid).toBe(false)
  })

  it('rejects an invalid capability classification', () => {
    const capability: JsonObject = {
      ...validCapability,
      classification: 'superuser',
    }

    expect(SchemaCatalog.parseCapability(capability).valid).toBe(false)
  })

  it('parses one concrete trace event for bridge validation', () => {
    const result = SchemaCatalog.parseTraceEvent({
      id: 'event-1',
      source: 'human',
      action: WorkflowAction.Click,
      target,
      origin: 'https://shop.example',
      path: '/catalog',
      timestamp: 1000,
    })

    expect(result.valid).toBe(true)
  })
})
