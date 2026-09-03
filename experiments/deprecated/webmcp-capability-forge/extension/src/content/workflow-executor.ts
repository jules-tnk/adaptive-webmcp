import {
  CapabilityClassification,
  ExecutionStatus,
  ExtractSource,
  FailureCode,
  InteractionEffect,
  JsonTypes,
  RiskPhase,
  RiskPolicy,
  SelectorRanker,
  ValueSource,
  WorkflowAction,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type JsonObject,
  type JsonValue,
  type TargetStrategy,
  type ValueExpression,
  type WorkflowStep,
} from 'webmcp-capability-forge-core'

export interface WorkflowExecutionRequest {
  readonly executionId: string
  readonly definition: CapabilityDefinition
  readonly input: JsonObject
  readonly documentValue: Document
  readonly confirmedStepIds: readonly string[]
  readonly startStep?: number
}

const maximumOutputBytes = 32 * 1024
const maximumExtractedItems = 20

export class WorkflowExecutor {
  private readonly controllers = new Map<string, AbortController>()

  async run(request: WorkflowExecutionRequest): Promise<ExecutionOutcome> {
    const controller = new AbortController()
    this.controllers.set(request.executionId, controller)
    const outputs: Record<string, JsonValue> = {}
    let completedSteps = request.startStep ?? 0
    try {
      for (const [index, step] of request.definition.steps.entries()) {
        if (index < (request.startStep ?? 0)) continue
        if (controller.signal.aborted) {
          return WorkflowExecutor.failure(request.executionId, ExecutionStatus.Cancelled, completedSteps, outputs, FailureCode.ExecutionCancelled, 'Execution was cancelled.', index)
        }
        const authorization = RiskPolicy.authorize({
          classification: WorkflowExecutor.classification(step),
          phase: RiskPhase.Execution,
          confirmed: request.confirmedStepIds.includes(step.id),
          sensitiveTarget: false,
        })
        if (!authorization.allowed) {
          return WorkflowExecutor.failure(request.executionId, ExecutionStatus.Failed, completedSteps, outputs, authorization.failure?.code ?? FailureCode.ExecutionError, authorization.failure?.message ?? 'Execution was not authorized.', index)
        }
        const result = await WorkflowExecutor.perform(step, request, outputs, controller.signal)
        if (!result.ok) {
          return WorkflowExecutor.failure(request.executionId, ExecutionStatus.Failed, completedSteps, outputs, result.code, result.message, index)
        }
        completedSteps += 1
        if (new TextEncoder().encode(JSON.stringify(outputs)).byteLength > maximumOutputBytes) {
          return WorkflowExecutor.failure(request.executionId, ExecutionStatus.Failed, completedSteps, {}, FailureCode.OutputLimitExceeded, 'Workflow output exceeded thirty-two kilobytes.', index)
        }
      }
      return { executionId: request.executionId, status: ExecutionStatus.Completed, completedSteps, outputs }
    } catch {
      return WorkflowExecutor.failure(request.executionId, ExecutionStatus.Failed, completedSteps, outputs, FailureCode.ExecutionError, 'Workflow execution failed unexpectedly.')
    } finally {
      this.controllers.delete(request.executionId)
    }
  }

  cancel(executionId: string): void {
    this.controllers.get(executionId)?.abort()
  }

  private static async perform(
    step: WorkflowStep,
    request: WorkflowExecutionRequest,
    outputs: Record<string, JsonValue>,
    signal: AbortSignal,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: FailureCode; readonly message: string }> {
    if (step.action === WorkflowAction.WaitForUrl) {
      const matched = await WorkflowExecutor.waitForUrl(request.documentValue, step.pathPattern, step.timeoutMs, signal)
      return matched ? { ok: true } : { ok: false, code: FailureCode.Timeout, message: 'Timed out waiting for the expected route.' }
    }
    if (step.action === WorkflowAction.WaitFor) {
      const matched = await WorkflowExecutor.waitForTarget(request.documentValue, step.target, step.timeoutMs, signal)
      return matched ? { ok: true } : { ok: false, code: FailureCode.Timeout, message: 'Timed out waiting for the expected target.' }
    }
    const elements = WorkflowExecutor.resolveAll(request.documentValue, step.target)
    if (elements.length === 0) return { ok: false, code: FailureCode.TargetMissing, message: 'No element matched the target strategy.' }
    if (step.action !== WorkflowAction.Extract && elements.length !== 1) {
      return { ok: false, code: FailureCode.TargetAmbiguous, message: 'More than one element matched the target strategy.' }
    }
    const element = elements[0]
    if (!element) return { ok: false, code: FailureCode.TargetMissing, message: 'Target element is unavailable.' }

    if (step.action === WorkflowAction.Fill && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      element.value = String(WorkflowExecutor.resolveValue(step.value, request.input, outputs) ?? '')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    } else if (step.action === WorkflowAction.Select && element instanceof HTMLSelectElement) {
      element.value = String(WorkflowExecutor.resolveValue(step.value, request.input, outputs) ?? '')
      element.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (step.action === WorkflowAction.Check && element instanceof HTMLInputElement) {
      element.checked = step.checked
      element.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (step.action === WorkflowAction.Keypress) {
      element.dispatchEvent(new KeyboardEvent('keydown', {
        key: step.key,
        ctrlKey: step.ctrlKey,
        altKey: step.altKey,
        metaKey: step.metaKey,
        shiftKey: step.shiftKey,
        bubbles: true,
      }))
    } else if (step.action === WorkflowAction.ScrollIntoView && element instanceof HTMLElement) {
      element.scrollIntoView?.({ block: 'center' })
    } else if (step.action === WorkflowAction.Click && element instanceof HTMLElement) {
      element.click()
    } else if (step.action === WorkflowAction.Extract) {
      outputs[step.saveAs] = elements.slice(0, maximumExtractedItems).map((item) => {
        const record: Record<string, JsonValue> = {}
        for (const field of step.fields) {
          if (field.source === ExtractSource.Text) record[field.name] = item.textContent?.trim() ?? ''
          if (field.source === ExtractSource.Value) record[field.name] = item instanceof HTMLInputElement ? item.value : ''
          if (field.source === ExtractSource.Attribute) record[field.name] = item.getAttribute(field.attribute ?? '') ?? ''
        }
        return record
      })
    } else {
      return { ok: false, code: FailureCode.ExecutionError, message: 'Target type does not support this action.' }
    }
    return { ok: true }
  }

  private static resolveAll(documentValue: Document, target: TargetStrategy): readonly Element[] {
    for (const candidate of SelectorRanker.rank(target.candidates)) {
      const matches: Element[] = []
      for (const root of WorkflowExecutor.roots(documentValue)) {
        try { matches.push(...Array.from(root.querySelectorAll(candidate.selector))) } catch { continue }
      }
      if (matches.length > 0) return [...new Set(matches)]
    }
    return []
  }

  private static roots(documentValue: Document): readonly (Document | ShadowRoot)[] {
    const roots: (Document | ShadowRoot)[] = [documentValue]
    for (const element of Array.from(documentValue.querySelectorAll('*'))) {
      if (element.shadowRoot) roots.push(element.shadowRoot)
    }
    return roots
  }

  private static async waitForTarget(documentValue: Document, target: TargetStrategy, timeoutMs: number, signal: AbortSignal): Promise<boolean> {
    const started = Date.now()
    while (!signal.aborted && Date.now() - started <= timeoutMs) {
      if (WorkflowExecutor.resolveAll(documentValue, target).length > 0) return true
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return false
  }

  private static async waitForUrl(documentValue: Document, pattern: string, timeoutMs: number, signal: AbortSignal): Promise<boolean> {
    const started = Date.now()
    while (!signal.aborted && Date.now() - started <= timeoutMs) {
      const path = documentValue.defaultView?.location.pathname ?? ''
      const matches = pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern
      if (matches) return true
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return false
  }

  private static resolveValue(value: ValueExpression, input: JsonObject, outputs: Record<string, JsonValue>): JsonValue | undefined {
    if (value.source === ValueSource.Input) return input[value.name]
    if (value.source === ValueSource.Literal) return value.value
    const saved = outputs[value.step]
    if (!JsonTypes.isObject(saved)) return undefined
    return saved[value.path]
  }

  private static classification(step: WorkflowStep): CapabilityClassification {
    if (step.effect === InteractionEffect.Sensitive) return CapabilityClassification.BlockedSensitive
    if ([InteractionEffect.FormSubmission, InteractionEffect.Message, InteractionEffect.Purchase, InteractionEffect.Deletion, InteractionEffect.AccountChange].includes(step.effect as InteractionEffect)) return CapabilityClassification.ExternalWrite
    if (step.effect === InteractionEffect.Navigation) return CapabilityClassification.Navigation
    if ([WorkflowAction.Fill, WorkflowAction.Click, WorkflowAction.Select, WorkflowAction.Check, WorkflowAction.Keypress].includes(step.action)) return CapabilityClassification.LocalUi
    return CapabilityClassification.Read
  }

  private static failure(executionId: string, status: ExecutionStatus, completedSteps: number, outputs: Record<string, JsonValue>, code: FailureCode, message: string, failedStep?: number): ExecutionOutcome {
    return { executionId, status, completedSteps, outputs, failure: { code, message, ...(failedStep === undefined ? {} : { failedStep }) } }
  }
}
