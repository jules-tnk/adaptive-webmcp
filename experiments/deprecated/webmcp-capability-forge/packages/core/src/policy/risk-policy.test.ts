import { describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  FailureCode,
  InteractionEffect,
  RiskPhase,
  RiskPolicy,
  WorkflowAction,
  type CapabilityDefinition,
} from '../index'

import { baseRiskCapability, riskTarget } from './risk-policy.test-fixtures'

describe('RiskPolicy', () => {
  it('classifies read-only extraction as read', () => {
    expect(RiskPolicy.classify(baseRiskCapability)).toBe(CapabilityClassification.Read)
  })

  it('escalates navigation and external effects', () => {
    const navigation: CapabilityDefinition = {
      ...baseRiskCapability,
      steps: [
        {
          id: 'step-1',
          action: WorkflowAction.Click,
          effect: InteractionEffect.Navigation,
          target: riskTarget,
        },
      ],
    }
    const submission: CapabilityDefinition = {
      ...baseRiskCapability,
      steps: [
        {
          id: 'step-1',
          action: WorkflowAction.Click,
          effect: InteractionEffect.FormSubmission,
          target: riskTarget,
        },
      ],
    }

    expect(RiskPolicy.classify(navigation)).toBe(CapabilityClassification.Navigation)
    expect(RiskPolicy.classify(submission)).toBe(CapabilityClassification.ExternalWrite)
  })

  it('requires confirmation for every external-write execution', () => {
    const result = RiskPolicy.authorize({
      classification: CapabilityClassification.ExternalWrite,
      phase: RiskPhase.Execution,
      confirmed: false,
      sensitiveTarget: false,
    })

    expect(result.allowed).toBe(false)
    expect(result.failure?.code).toBe(FailureCode.RiskConfirmationRequired)
  })

  it('blocks a sensitive target even after confirmation', () => {
    const result = RiskPolicy.authorize({
      classification: CapabilityClassification.Read,
      phase: RiskPhase.Execution,
      confirmed: true,
      sensitiveTarget: true,
    })

    expect(result.allowed).toBe(false)
    expect(result.failure?.code).toBe(FailureCode.SensitiveTargetBlocked)
  })
})
