import { describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  CapabilityValidator,
  ExpectedEffectKind,
  ExtractSource,
  InteractionEffect,
  JsonSchemaPropertyType,
  JsonSchemaType,
  SelectorKind,
  SemanticRole,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type ActivePageScope,
  type CapabilityDefinition,
  type TargetStrategy,
  type WorkflowStep,
} from '../index'

const target: TargetStrategy = {
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

const scope: ActivePageScope = {
  origin: 'https://shop.example',
  path: '/catalog',
}

const readStep: WorkflowStep = {
  id: 'step-1',
  action: WorkflowAction.Extract,
  target,
  fields: [{ name: 'title', source: ExtractSource.Text }],
  saveAs: 'result',
}

const baseCapability: CapabilityDefinition = {
  schemaVersion: 1,
  name: 'read_catalog_item',
  title: 'Read catalog item',
  description: 'Read one visible catalog result.',
  scope: { origin: scope.origin, pathPatterns: ['/catalog*'] },
  inputSchema: {
    type: JsonSchemaType.Object,
    properties: {
      query: { type: JsonSchemaPropertyType.String },
    },
    required: [],
    additionalProperties: false,
  },
  classification: CapabilityClassification.Read,
  steps: [readStep],
  expectedEffects: [{ kind: ExpectedEffectKind.ElementVisible, target }],
  provenanceSummary: { humanEvents: 1, agentEvents: 0, verifierEvents: 0 },
  verification: { status: VerificationStatus.Proposed, attempts: [] },
  revision: 1,
}

const withSteps = (
  steps: readonly WorkflowStep[],
  classification: CapabilityClassification,
): CapabilityDefinition => ({ ...baseCapability, steps, classification })

describe('CapabilityValidator', () => {
  it('rejects a capability from another origin', () => {
    const capability: CapabilityDefinition = {
      ...baseCapability,
      scope: { ...baseCapability.scope, origin: 'https://other.example' },
    }

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('rejects an undeclared input reference', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.Fill,
          target,
          value: { source: ValueSource.Input, name: 'missing' },
        },
      ],
      CapabilityClassification.LocalUi,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('rejects a navigation action without a following URL checkpoint', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.Click,
          effect: InteractionEffect.Navigation,
          target,
        },
      ],
      CapabilityClassification.Navigation,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('accepts a same-origin navigation followed by a bounded URL checkpoint', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.Click,
          effect: InteractionEffect.Navigation,
          target,
        },
        {
          id: 'step-2',
          action: WorkflowAction.WaitForUrl,
          pathPattern: '/catalog/results*',
          timeoutMs: 5000,
        },
      ],
      CapabilityClassification.Navigation,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(true)
  })

  it('rejects an arbitrary URL in a route checkpoint', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.WaitForUrl,
          pathPattern: 'https://other.example/results',
          timeoutMs: 5000,
        },
      ],
      CapabilityClassification.Navigation,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('rejects a reference to an extraction that is not available yet', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.Fill,
          target,
          value: { source: ValueSource.Step, step: 'future', path: 'title' },
        },
      ],
      CapabilityClassification.LocalUi,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('rejects duplicate extracted-output names', () => {
    const extraction: WorkflowStep = {
      id: 'step-1',
      action: WorkflowAction.Extract,
      target,
      fields: [{ name: 'title', source: ExtractSource.Text }],
      saveAs: 'result',
    }
    const capability = withSteps(
      [extraction, { ...extraction, id: 'step-2' }],
      CapabilityClassification.Read,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })

  it('accepts 250 workflow steps and rejects 251', () => {
    const boundedStep: WorkflowStep = {
      id: 'step-1',
      action: WorkflowAction.ScrollIntoView,
      target,
    }
    const accepted = withSteps(
      Array.from({ length: 250 }, (_, index) => ({ ...boundedStep, id: `step-${index + 1}` })),
      CapabilityClassification.Read,
    )
    const rejected = withSteps(
      Array.from({ length: 251 }, (_, index) => ({ ...boundedStep, id: `step-${index + 1}` })),
      CapabilityClassification.Read,
    )

    expect(CapabilityValidator.validate(accepted, scope).valid).toBe(true)
    expect(CapabilityValidator.validate(rejected, scope).valid).toBe(false)
  })

  it('rejects a classification that understates an external effect', () => {
    const capability = withSteps(
      [
        {
          id: 'step-1',
          action: WorkflowAction.Click,
          effect: InteractionEffect.FormSubmission,
          target,
        },
      ],
      CapabilityClassification.LocalUi,
    )

    expect(CapabilityValidator.validate(capability, scope).valid).toBe(false)
  })
})
