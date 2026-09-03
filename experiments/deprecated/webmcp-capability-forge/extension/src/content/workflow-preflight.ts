import {
  SelectorRanker,
  ValueSource,
  WorkflowAction,
  type CapabilityDefinition,
  type JsonObject,
  type TargetStrategy,
} from 'webmcp-capability-forge-core'

export interface WorkflowPreflightResult {
  readonly ready: boolean
  readonly input: JsonObject
}

export class WorkflowPreflight {
  static inspect(
    definition: CapabilityDefinition,
    documentValue: Document,
  ): WorkflowPreflightResult {
    const input: Record<string, string> = {}
    for (const step of definition.steps) {
      if (!('target' in step)) continue
      const elements = WorkflowPreflight.resolve(documentValue, step.target)
      if (elements.length === 0) return { ready: false, input: {} }
      if (step.action !== WorkflowAction.Extract && elements.length !== 1) {
        return { ready: false, input: {} }
      }
      const element = elements[0]
      if (
        step.action === WorkflowAction.Fill &&
        step.value.source === ValueSource.Input &&
        (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
      ) {
        input[step.value.name] = element.value
      }
      if (
        step.action === WorkflowAction.Select &&
        step.value.source === ValueSource.Input &&
        element instanceof HTMLSelectElement
      ) {
        input[step.value.name] = element.value
      }
    }
    const ready = definition.inputSchema.required.every((name) => input[name] !== undefined)
    return { ready, input }
  }

  private static resolve(documentValue: Document, target: TargetStrategy): readonly Element[] {
    for (const candidate of SelectorRanker.rank(target.candidates)) {
      try {
        const elements = Array.from(documentValue.querySelectorAll(candidate.selector))
        if (elements.length > 0) return elements
      } catch {
        continue
      }
    }
    return []
  }
}
