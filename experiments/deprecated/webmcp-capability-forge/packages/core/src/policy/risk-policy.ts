import { FailureCode } from '../contracts/error-contracts'
import {
  CapabilityClassification,
  InteractionEffect,
  WorkflowAction,
  type CapabilityDefinition,
} from '../contracts/workflow-contracts'

export enum RiskPhase {
  Learning = 'learning',
  Verification = 'verification',
  Execution = 'execution',
}

export interface RiskContext {
  readonly classification: CapabilityClassification
  readonly phase: RiskPhase
  readonly confirmed: boolean
  readonly sensitiveTarget: boolean
}

export interface AuthorizationFailure {
  readonly code: FailureCode
  readonly message: string
}

export interface AuthorizationResult {
  readonly allowed: boolean
  readonly failure?: AuthorizationFailure
}

export class RiskPolicy {
  static classify(definition: CapabilityDefinition): CapabilityClassification {
    let classification = CapabilityClassification.Read
    for (const step of definition.steps) {
      if (step.effect === InteractionEffect.Sensitive) {
        return CapabilityClassification.BlockedSensitive
      }
      if (
        step.effect === InteractionEffect.FormSubmission ||
        step.effect === InteractionEffect.Message ||
        step.effect === InteractionEffect.Purchase ||
        step.effect === InteractionEffect.Deletion ||
        step.effect === InteractionEffect.AccountChange
      ) {
        classification = CapabilityClassification.ExternalWrite
        continue
      }
      if (
        classification !== CapabilityClassification.ExternalWrite &&
        step.effect === InteractionEffect.Navigation
      ) {
        classification = CapabilityClassification.Navigation
        continue
      }
      if (
        classification === CapabilityClassification.Read &&
        (step.action === WorkflowAction.Fill ||
          step.action === WorkflowAction.Click ||
          step.action === WorkflowAction.Select ||
          step.action === WorkflowAction.Check ||
          step.action === WorkflowAction.Keypress)
      ) {
        classification = CapabilityClassification.LocalUi
      }
    }
    return classification
  }

  static authorize(context: RiskContext): AuthorizationResult {
    if (
      context.sensitiveTarget ||
      context.classification === CapabilityClassification.BlockedSensitive
    ) {
      return {
        allowed: false,
        failure: {
          code: FailureCode.SensitiveTargetBlocked,
          message: 'Sensitive targets cannot be used by Capability Forge.',
        },
      }
    }
    if (
      context.classification === CapabilityClassification.ExternalWrite &&
      !context.confirmed
    ) {
      return RiskPolicy.confirmationRequired()
    }
    if (
      context.classification === CapabilityClassification.Navigation &&
      context.phase !== RiskPhase.Execution &&
      !context.confirmed
    ) {
      return RiskPolicy.confirmationRequired()
    }
    return { allowed: true }
  }

  private static confirmationRequired(): AuthorizationResult {
    return {
      allowed: false,
      failure: {
        code: FailureCode.RiskConfirmationRequired,
        message: 'A direct user confirmation is required for this action.',
      },
    }
  }
}
