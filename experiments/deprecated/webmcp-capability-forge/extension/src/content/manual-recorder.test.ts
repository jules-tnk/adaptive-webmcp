import { beforeEach, describe, expect, it } from 'vitest'

import {
  LearningMode,
  InteractionEffect,
  SelectorKind,
  SessionActor,
  SessionMachine,
  TraceSource,
  TraceKeyKind,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import { ManualRecorder } from './manual-recorder'

describe('ManualRecorder', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <label>Query <input name="query"></label>
      <select name="category"><option value="office">Office</option></select>
      <label><input type="checkbox" name="featured"> Featured</label>
      <button aria-label="Search">Search</button>
      <input type="password" name="password">
    `
  })

  it('records non-sensitive human actions with parameter references', async () => {
    const session = SessionMachine.start(
      {
        goal: 'Search the catalog',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Hybrid,
        actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    let eventId = 0
    const recorder = new ManualRecorder({
      now: () => 1100 + eventId,
      createId: () => `event-${++eventId}`,
    })
    recorder.start(session, document)

    const query = document.querySelector('[name="query"]')
    const category = document.querySelector('[name="category"]')
    const featured = document.querySelector('[name="featured"]')
    const search = document.querySelector('[aria-label="Search"]')
    const password = document.querySelector('[name="password"]')
    if (!(query instanceof HTMLInputElement)) throw new Error('Query fixture missing.')
    if (!(category instanceof HTMLSelectElement)) throw new Error('Category fixture missing.')
    if (!(featured instanceof HTMLInputElement)) throw new Error('Checkbox fixture missing.')
    if (!(search instanceof HTMLButtonElement)) throw new Error('Search fixture missing.')
    if (!(password instanceof HTMLInputElement)) throw new Error('Password fixture missing.')

    query.value = 'notebook'
    query.dispatchEvent(new Event('input', { bubbles: true }))
    category.value = 'office'
    category.dispatchEvent(new Event('change', { bubbles: true }))
    featured.checked = true
    featured.dispatchEvent(new Event('change', { bubbles: true }))
    query.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    query.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    search.click()
    password.value = 'secret'
    password.dispatchEvent(new Event('input', { bubbles: true }))

    const recorded = await recorder.stop()

    expect(recorded.trace.map((event) => event.action)).toEqual([
      WorkflowAction.Fill,
      WorkflowAction.Select,
      WorkflowAction.Check,
      WorkflowAction.Keypress,
      WorkflowAction.Keypress,
      WorkflowAction.Click,
    ])
    expect(recorded.trace.every((event) => event.source === TraceSource.Human)).toBe(true)
    expect(recorded.trace[0]?.inputReference).toBe('input_1')
    expect(recorded.trace[4]?.data).toEqual({
      key: 'k', ctrlKey: true, altKey: false, metaKey: false, shiftKey: false,
    })
    expect(recorded.trace.some((event) => JSON.stringify(event).includes('secret'))).toBe(false)
  })

  it('delivers recorded events in order and flushes them before stop resolves', async () => {
    const session = SessionMachine.start(
      {
        goal: 'Search the catalog',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Manual,
        actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    const delivered: string[] = []
    let eventId = 0
    const recorder = new ManualRecorder(
      {
        now: () => 1100 + eventId,
        createId: () => `event-${++eventId}`,
      },
      {
        async append(event) {
          await Promise.resolve()
          delivered.push(event.id)
        },
      },
    )
    recorder.start(session, document)
    const query = document.querySelector('[name="query"]')
    const search = document.querySelector('[aria-label="Search"]')
    if (!(query instanceof HTMLInputElement)) throw new Error('Query fixture missing.')
    if (!(search instanceof HTMLButtonElement)) throw new Error('Search fixture missing.')

    query.dispatchEvent(new Event('input', { bubbles: true }))
    search.click()
    await recorder.stop()

    expect(delivered).toEqual(['event-1', 'event-2'])
  })

  it('continues input numbering and labels anchor clicks as navigation after restoration', async () => {
    const started = SessionMachine.start(
      {
        goal: 'Continue after navigation',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Manual,
        actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    const query = document.querySelector('[name="query"]')
    if (!(query instanceof HTMLInputElement)) throw new Error('Query fixture missing.')
    const firstTarget = {
      candidates: [{
        kind: SelectorKind.StableName,
        selector: '[name="query"]',
        score: 80,
        uniqueAtRecording: true,
      }],
    }
    const appended = SessionMachine.append(started, {
      id: 'event-1', source: TraceSource.Human, action: WorkflowAction.Fill,
      target: firstTarget, inputReference: 'input_1', origin: started.origin,
      path: started.currentPath, timestamp: 1100,
    })
    if (!appended.valid) throw new Error('Fixture event could not be appended.')
    document.body.insertAdjacentHTML('beforeend', '<a aria-label="Open results" href="/results">Open</a>')
    const delivered: import('webmcp-capability-forge-core').TraceEvent[] = []
    let eventId = 1
    const recorder = new ManualRecorder(
      { now: () => 1200 + eventId, createId: () => `event-${++eventId}` },
      { async append(event) { delivered.push(event) } },
    )
    recorder.start(appended.value, document)

    query.dispatchEvent(new Event('input', { bubbles: true }))
    const link = document.querySelector('[aria-label="Open results"]')
    if (!(link instanceof HTMLAnchorElement)) throw new Error('Link fixture missing.')
    link.addEventListener('click', (event) => event.preventDefault())
    link.click()
    await recorder.stop()

    expect(delivered[0]?.inputReference).toBe('input_2')
    expect(delivered[1]?.data).toEqual({ effect: InteractionEffect.Navigation })
  })

  it('preserves printable key timing without storing the typed character', async () => {
    const session = SessionMachine.start(
      {
        goal: 'Type privately', origin: 'https://shop.example', path: '/catalog',
        mode: LearningMode.Manual, actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    const recorder = new ManualRecorder({
      now: () => 1100,
      createId: () => 'event-1',
    })
    recorder.start(session, document)
    const query = document.querySelector('[name="query"]')
    if (!(query instanceof HTMLInputElement)) throw new Error('Query fixture missing.')

    query.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
    const recorded = await recorder.stop()

    expect(recorded.trace[0]?.data).toEqual({
      keyKind: TraceKeyKind.Printable,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
    })
    expect(JSON.stringify(recorded.trace[0]?.data)).not.toContain('"x"')
  })

  it('keeps a printable activation key when the target is not a text editor', async () => {
    const session = SessionMachine.start(
      {
        goal: 'Activate a button', origin: 'https://shop.example', path: '/catalog',
        mode: LearningMode.Manual, actor: SessionActor.Human,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    const recorder = new ManualRecorder({ now: () => 1100, createId: () => 'event-1' })
    recorder.start(session, document)
    const search = document.querySelector('[aria-label="Search"]')
    if (!(search instanceof HTMLButtonElement)) throw new Error('Search fixture missing.')

    search.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    const recorded = await recorder.stop()

    expect(recorded.trace[0]?.data).toMatchObject({ key: ' ' })
    expect(JSON.stringify(recorded.trace[0]?.data)).not.toContain(TraceKeyKind.Printable)
  })
})
