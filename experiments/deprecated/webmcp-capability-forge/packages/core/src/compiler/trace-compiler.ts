import {
  FailureCode,
  ValidationIssueCode,
  type ValidationResult,
} from '../contracts/error-contracts'
import { TraceSource, type LearningSession, type TraceEvent } from '../contracts/session-contracts'
import {
  CapabilityClassification,
  ExpectedEffectKind,
  ExtractSource,
  InteractionEffect,
  JsonSchemaPropertyType,
  JsonSchemaType,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
  type WorkflowStep,
} from '../contracts/workflow-contracts'
import { JsonTypes } from '../json/json-value'
import { CapabilityValidator } from '../policy/capability-validator'
import { RiskPolicy } from '../policy/risk-policy'
import { TraceCompactor } from './trace-compactor'

export interface TraceCompilerInput {
  readonly session: LearningSession
  readonly nextRevision: number
}

export class TraceCompiler {
  static compile(input: TraceCompilerInput): ValidationResult<CapabilityDefinition> {
    if (input.session.trace.length === 0) return TraceCompiler.failure('trace', 'A recorded trace is required.')
    const compacted = TraceCompactor.compact(input.session.trace)
    if (compacted.events.length === 0) return TraceCompiler.failure('trace', 'The trace contains no replayable workflow events.')
    const steps: WorkflowStep[] = []
    for (const [index, event] of compacted.events.entries()) {
      const step = TraceCompiler.step(event, index)
      if (!step) return TraceCompiler.failure(`trace.${index}`, 'The trace event cannot be compiled safely.')
      steps.push(step)
    }
    const finalTarget = [...compacted.events].reverse().find((event) => event.target)?.target
    const finalRoute = [...compacted.events].reverse().find(
      (event) => event.action === WorkflowAction.WaitForUrl,
    )
    if (!finalTarget && !finalRoute) return TraceCompiler.failure('trace', 'A final target or route is required for replay evidence.')
    const inputNames = [...new Set(compacted.events.flatMap((event) => event.inputReference ? [event.inputReference] : []))]
    const properties = Object.fromEntries(inputNames.map((name) => [name, {
      type: JsonSchemaPropertyType.String,
      description: `Recorded input ${name}`,
    }]))
    const paths = [...new Set(compacted.events.map((event) => event.path))].slice(0, 12)
    const draft: CapabilityDefinition = {
      schemaVersion: 1,
      name: TraceCompiler.toolName(input.session.goal),
      title: input.session.goal,
      description: `Replay the reviewed workflow: ${input.session.goal}`.slice(0, 500),
      scope: { origin: input.session.origin, pathPatterns: paths },
      inputSchema: {
        type: JsonSchemaType.Object,
        properties,
        required: inputNames,
        additionalProperties: false,
      },
      classification: CapabilityClassification.Read,
      steps,
      expectedEffects: finalRoute
        ? [{ kind: ExpectedEffectKind.UrlMatches, pathPattern: finalRoute.path }]
        : [{ kind: ExpectedEffectKind.ElementVisible, target: finalTarget! }],
      provenanceSummary: {
        humanEvents: compacted.events.filter((event) => event.source === TraceSource.Human).length,
        agentEvents: compacted.events.filter((event) => event.source === TraceSource.Agent).length,
        verifierEvents: compacted.events.filter((event) => event.source === TraceSource.Verifier).length,
      },
      traceReduction: compacted.summary,
      verification: { status: VerificationStatus.Proposed, attempts: [] },
      revision: input.nextRevision,
    }
    const classified = { ...draft, classification: RiskPolicy.classify(draft) }
    return CapabilityValidator.validate(classified, {
      origin: input.session.origin,
      path: input.session.currentPath,
    })
  }

  private static step(event: TraceEvent, index: number): WorkflowStep | null {
    const id = `step-${index + 1}`
    if (event.action === WorkflowAction.WaitForUrl) {
      return { id, action: WorkflowAction.WaitForUrl, pathPattern: event.path, timeoutMs: 5000 }
    }
    if (!event.target) return null
    if (event.action === WorkflowAction.Fill && event.inputReference) {
      return { id, action: WorkflowAction.Fill, target: event.target, value: { source: ValueSource.Input, name: event.inputReference } }
    }
    if (event.action === WorkflowAction.Select && event.inputReference) {
      return { id, action: WorkflowAction.Select, target: event.target, value: { source: ValueSource.Input, name: event.inputReference } }
    }
    if (event.action === WorkflowAction.Click) {
      const effect = JsonTypes.isObject(event.data) && typeof event.data.effect === 'string' &&
        Object.values(InteractionEffect).includes(event.data.effect as InteractionEffect)
        ? event.data.effect as InteractionEffect
        : undefined
      return { id, action: WorkflowAction.Click, target: event.target, ...(effect ? { effect } : {}) }
    }
    if (event.action === WorkflowAction.ScrollIntoView) return { id, action: WorkflowAction.ScrollIntoView, target: event.target }
    if (event.action === WorkflowAction.WaitFor) return { id, action: WorkflowAction.WaitFor, target: event.target, timeoutMs: 5000 }
    if (event.action === WorkflowAction.Check) {
      const checked = JsonTypes.isObject(event.data) && typeof event.data.checked === 'boolean'
        ? event.data.checked
        : true
      return { id, action: WorkflowAction.Check, target: event.target, checked }
    }
    if (event.action === WorkflowAction.Keypress) {
      if (!JsonTypes.isObject(event.data) || typeof event.data.key !== 'string') return null
      return {
        id,
        action: WorkflowAction.Keypress,
        target: event.target,
        key: event.data.key,
        ...(typeof event.data.ctrlKey === 'boolean' ? { ctrlKey: event.data.ctrlKey } : {}),
        ...(typeof event.data.altKey === 'boolean' ? { altKey: event.data.altKey } : {}),
        ...(typeof event.data.metaKey === 'boolean' ? { metaKey: event.data.metaKey } : {}),
        ...(typeof event.data.shiftKey === 'boolean' ? { shiftKey: event.data.shiftKey } : {}),
      }
    }
    if (event.action === WorkflowAction.Extract) {
      return {
        id,
        action: WorkflowAction.Extract,
        target: event.target,
        fields: [{ name: 'text', source: ExtractSource.Text }],
        saveAs: `output_${index + 1}`,
      }
    }
    return null
  }

  static toolName(goal: string): string {
    const normalized = goal.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const prefixed = /^[a-z]/.test(normalized) ? normalized : `workflow_${normalized}`
    return (prefixed || 'learned_workflow').slice(0, 64)
  }

  private static failure(path: string, message: string): ValidationResult<never> {
    return {
      valid: false,
      failure: FailureCode.ExecutionError,
      issues: [{ path, code: ValidationIssueCode.Schema, message }],
    }
  }
}
