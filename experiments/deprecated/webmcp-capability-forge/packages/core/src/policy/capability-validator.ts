import {
  ValidationIssueCode,
  type ValidationIssue,
  type ValidationResult,
} from '../contracts/error-contracts'
import {
  CapabilityClassification,
  CapabilityLimits,
  InteractionEffect,
  ValueSource,
  WorkflowAction,
  type CapabilityDefinition,
  type ValueExpression,
  type WorkflowStep,
} from '../contracts/workflow-contracts'
import type { TargetStrategy } from '../selectors/selector-contracts'
import { SelectorRanker } from '../selectors/selector-ranker'
import { RiskPolicy } from './risk-policy'

export interface ActivePageScope {
  readonly origin: string
  readonly path: string
}

const maximumWaitMs = 5000
const maximumExtractedItems = 20

export class CapabilityValidator {
  static validate(
    definition: CapabilityDefinition,
    scope: ActivePageScope,
  ): ValidationResult<CapabilityDefinition> {
    const issues: ValidationIssue[] = []
    if (definition.scope.origin !== scope.origin) {
      issues.push(
        CapabilityValidator.issue(
          'scope.origin',
          ValidationIssueCode.OriginMismatch,
          'Capability origin must equal the active page origin.',
        ),
      )
    }
    if (!definition.scope.pathPatterns.some((pattern) => CapabilityValidator.matchesPath(scope.path, pattern))) {
      issues.push(
        CapabilityValidator.issue(
          'scope.pathPatterns',
          ValidationIssueCode.PathMismatch,
          'Capability scope must include the active page path.',
        ),
      )
    }
    if (definition.steps.length > CapabilityLimits.MaximumWorkflowSteps) {
      issues.push(
        CapabilityValidator.issue(
          'steps',
          ValidationIssueCode.Schema,
          `Capability exceeds the ${CapabilityLimits.MaximumWorkflowSteps}-step workflow limit.`,
        ),
      )
    }

    const inputNames = new Set(Object.keys(definition.inputSchema.properties))
    const savedSteps = new Set<string>()
    definition.steps.forEach((step, index) => {
      CapabilityValidator.validateStep(step, index, inputNames, savedSteps, issues)
      if (
        step.effect === InteractionEffect.Navigation &&
        definition.steps[index + 1]?.action !== WorkflowAction.WaitForUrl
      ) {
        issues.push(
          CapabilityValidator.issue(
            `steps.${index}.effect`,
            ValidationIssueCode.MissingRouteCheckpoint,
            'A navigation action must be followed by a URL checkpoint.',
          ),
        )
      }
      if (step.action === WorkflowAction.Extract) {
        if (savedSteps.has(step.saveAs)) {
          issues.push(
            CapabilityValidator.issue(
              `steps.${index}.saveAs`,
              ValidationIssueCode.DuplicateStepOutput,
              'Extracted-output names must be unique.',
            ),
          )
        } else {
          savedSteps.add(step.saveAs)
        }
      }
    })

    for (const [index, effect] of definition.expectedEffects.entries()) {
      if ('target' in effect) {
        CapabilityValidator.validateTarget(
          effect.target,
          `expectedEffects.${index}.target`,
          issues,
        )
      }
    }

    const derived = RiskPolicy.classify(definition)
    if (derived !== definition.classification) {
      issues.push(
        CapabilityValidator.issue(
          'classification',
          ValidationIssueCode.ClassificationMismatch,
          `Declared classification ${definition.classification} must equal derived classification ${derived}.`,
        ),
      )
    }
    return issues.length > 0
      ? { valid: false, issues }
      : { valid: true, value: structuredClone(definition) }
  }

  private static validateStep(
    step: WorkflowStep,
    index: number,
    inputNames: ReadonlySet<string>,
    savedSteps: ReadonlySet<string>,
    issues: ValidationIssue[],
  ): void {
    if ('target' in step) {
      CapabilityValidator.validateTarget(step.target, `steps.${index}.target`, issues)
    }
    if (step.action === WorkflowAction.Fill || step.action === WorkflowAction.Select) {
      CapabilityValidator.validateValue(step.value, index, inputNames, savedSteps, issues)
    }
    if (step.action === WorkflowAction.WaitFor && step.timeoutMs > maximumWaitMs) {
      issues.push(CapabilityValidator.issue(`steps.${index}.timeoutMs`, ValidationIssueCode.Schema, 'Wait exceeds five seconds.'))
    }
    if (step.action === WorkflowAction.Extract && step.fields.length > maximumExtractedItems) {
      issues.push(CapabilityValidator.issue(`steps.${index}.fields`, ValidationIssueCode.Schema, 'Extraction exceeds twenty fields.'))
    }
    if (step.action === WorkflowAction.WaitForUrl) {
      if (!step.pathPattern.startsWith('/') || step.pathPattern.includes('://')) {
        issues.push(CapabilityValidator.issue(`steps.${index}.pathPattern`, ValidationIssueCode.ArbitraryUrl, 'Route checkpoints must use same-origin path patterns.'))
      }
    }
  }

  private static validateValue(
    value: ValueExpression,
    index: number,
    inputNames: ReadonlySet<string>,
    savedSteps: ReadonlySet<string>,
    issues: ValidationIssue[],
  ): void {
    if (value.source === ValueSource.Input && !inputNames.has(value.name)) {
      issues.push(CapabilityValidator.issue(`steps.${index}.value.name`, ValidationIssueCode.UndeclaredInput, 'Workflow input is not declared.'))
    }
    if (value.source === ValueSource.Step && !savedSteps.has(value.step)) {
      issues.push(CapabilityValidator.issue(`steps.${index}.value.step`, ValidationIssueCode.UnknownStepReference, 'Workflow step output is not available.'))
    }
  }

  private static validateTarget(
    target: TargetStrategy,
    path: string,
    issues: ValidationIssue[],
  ): void {
    const selected = SelectorRanker.select(target.candidates)
    if (!selected.valid) {
      issues.push(CapabilityValidator.issue(path, ValidationIssueCode.UnsafeTarget, 'Target lacks one unique selector candidate.'))
      return
    }
    const normalized = selected.value.selector.toLowerCase().replaceAll(' ', '')
    if (/script|iframe|input\[type=["']?(password|file|hidden)/i.test(normalized)) {
      issues.push(CapabilityValidator.issue(path, ValidationIssueCode.UnsafeTarget, 'Target selector points to a blocked element.'))
    }
  }

  private static matchesPath(path: string, pattern: string): boolean {
    if (!pattern.startsWith('/')) return false
    return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern
  }

  private static issue(
    path: string,
    code: ValidationIssueCode,
    message: string,
  ): ValidationIssue {
    return { path, code, message }
  }
}
