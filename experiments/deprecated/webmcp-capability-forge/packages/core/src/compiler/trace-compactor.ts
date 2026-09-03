import { TraceKeyKind, TraceSource, type TraceEvent } from '../contracts/session-contracts'
import { WorkflowAction } from '../contracts/workflow-contracts'
import { JsonTypes } from '../json/json-value'
import { SemanticRole } from '../selectors/selector-contracts'

export interface TraceCompactionSummary {
  readonly rawEvents: number
  readonly compiledEvents: number
  readonly omittedEvents: number
}

export interface TraceCompactionResult {
  readonly events: readonly TraceEvent[]
  readonly summary: TraceCompactionSummary
}

const maximumEditingGapMs = 2_000

export class TraceCompactor {
  static compact(trace: readonly TraceEvent[]): TraceCompactionResult {
    const events: TraceEvent[] = []
    for (const rawEvent of trace) {
      const event = structuredClone(rawEvent)
      if (TraceCompactor.redundantPrintableKey(event)) continue
      const previous = events.at(-1)
      if (previous && TraceCompactor.sameEditingBurst(previous, event)) {
        events[events.length - 1] = {
          ...event,
          ...(previous.inputReference ? { inputReference: previous.inputReference } : {}),
        }
      } else {
        events.push(event)
      }
    }
    return {
      events,
      summary: {
        rawEvents: trace.length,
        compiledEvents: events.length,
        omittedEvents: trace.length - events.length,
      },
    }
  }

  private static redundantPrintableKey(event: TraceEvent): boolean {
    if (
      event.action !== WorkflowAction.Keypress ||
      !JsonTypes.isObject(event.data)
    ) return false
    if (event.data.keyKind === TraceKeyKind.Printable) return true
    if (
      event.target?.role !== SemanticRole.Textbox &&
      event.target?.role !== SemanticRole.Searchbox &&
      event.target?.role !== SemanticRole.Combobox
    ) return false
    if (typeof event.data.key !== 'string' || event.data.key.length !== 1) return false
    return event.data.ctrlKey !== true && event.data.metaKey !== true && event.data.altKey !== true
  }

  private static sameEditingBurst(previous: TraceEvent, event: TraceEvent): boolean {
    return previous.action === WorkflowAction.Fill && event.action === WorkflowAction.Fill &&
      previous.source === event.source && event.source !== TraceSource.Verifier &&
      previous.origin === event.origin && previous.path === event.path &&
      event.timestamp - previous.timestamp <= maximumEditingGapMs &&
      JSON.stringify(previous.target) === JSON.stringify(event.target)
  }
}
