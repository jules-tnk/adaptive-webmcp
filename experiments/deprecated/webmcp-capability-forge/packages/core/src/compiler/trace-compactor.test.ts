import { describe, expect, it } from 'vitest'

import {
  SelectorKind,
  SemanticRole,
  TraceKeyKind,
  TraceCompactor,
  TraceSource,
  WorkflowAction,
  type TargetStrategy,
  type TraceEvent,
} from '../index'

const searchTarget: TargetStrategy = {
  role: SemanticRole.Textbox,
  name: 'Search',
  candidates: [{
    kind: SelectorKind.AccessibleRole,
    selector: '[aria-label="Search"]',
    score: 100,
    uniqueAtRecording: true,
  }],
}

const buttonTarget: TargetStrategy = {
  role: SemanticRole.Button,
  name: 'Submit',
  candidates: [{
    kind: SelectorKind.AccessibleRole,
    selector: '[aria-label="Submit"]',
    score: 100,
    uniqueAtRecording: true,
  }],
}

class TraceEvents {
  static create(
    id: string,
    action: WorkflowAction,
    timestamp: number,
    target: TargetStrategy = searchTarget,
    data?: TraceEvent['data'],
    inputReference?: string,
  ): TraceEvent {
    return {
      id,
      source: TraceSource.Human,
      action,
      target,
      ...(data === undefined ? {} : { data }),
      ...(inputReference === undefined ? {} : { inputReference }),
      origin: 'https://shop.example',
      path: '/catalog',
      timestamp,
    }
  }
}

describe('TraceCompactor', () => {
  it('reduces a typing burst to one parameterized Fill without changing the raw trace', () => {
    const raw: TraceEvent[] = []
    for (let index = 0; index < 18; index += 1) {
      raw.push(TraceEvents.create(
        `key-${index}`,
        WorkflowAction.Keypress,
        1000 + index * 20,
        searchTarget,
        { key: String.fromCharCode(97 + (index % 26)) },
      ))
      raw.push(TraceEvents.create(
        `fill-${index}`,
        WorkflowAction.Fill,
        1010 + index * 20,
        searchTarget,
        undefined,
        `input_${index + 1}`,
      ))
    }
    raw.push(TraceEvents.create('submit', WorkflowAction.Click, 1500, buttonTarget))

    const result = TraceCompactor.compact(raw)

    expect(raw).toHaveLength(37)
    expect(result.events.map((event) => event.action)).toEqual([
      WorkflowAction.Fill,
      WorkflowAction.Click,
    ])
    expect(result.events[0]?.inputReference).toBe('input_1')
    expect(result.summary).toEqual({ rawEvents: 37, compiledEvents: 2, omittedEvents: 35 })
  })

  it('preserves semantic keys, modifier shortcuts, target changes, and route boundaries', () => {
    const events = [
      TraceEvents.create('enter', WorkflowAction.Keypress, 1000, searchTarget, { key: 'Enter' }),
      TraceEvents.create('shortcut', WorkflowAction.Keypress, 1010, searchTarget, { key: 'k', ctrlKey: true }),
      TraceEvents.create('click', WorkflowAction.Click, 1020, buttonTarget),
      {
        ...TraceEvents.create('route', WorkflowAction.WaitForUrl, 1030),
        target: undefined,
        path: '/results',
      },
    ]

    const result = TraceCompactor.compact(events)

    expect(result.events.map((event) => event.id)).toEqual(['enter', 'shortcut', 'click', 'route'])
  })

  it('does not merge Fill events separated by a deliberate pause', () => {
    const events = [
      TraceEvents.create('first', WorkflowAction.Fill, 1000, searchTarget, undefined, 'input_1'),
      TraceEvents.create('second', WorkflowAction.Fill, 4000, searchTarget, undefined, 'input_2'),
    ]

    expect(TraceCompactor.compact(events).events).toHaveLength(2)
  })

  it('omits privacy-safe printable keys from an editable combobox trace', () => {
    const comboboxTarget: TargetStrategy = {
      ...searchTarget,
      role: SemanticRole.Combobox,
    }
    const events = [
      TraceEvents.create(
        'printable',
        WorkflowAction.Keypress,
        1000,
        comboboxTarget,
        { keyKind: TraceKeyKind.Printable },
      ),
      TraceEvents.create(
        'fill',
        WorkflowAction.Fill,
        1010,
        comboboxTarget,
        undefined,
        'input_1',
      ),
    ]

    expect(TraceCompactor.compact(events).events.map((event) => event.id)).toEqual(['fill'])
  })
})
