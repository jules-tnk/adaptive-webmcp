import { beforeEach, describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  ExecutionStatus,
  ExtractSource,
  InteractionEffect,
  JsonSchemaPropertyType,
  JsonSchemaType,
  SelectorKind,
  SemanticRole,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
  type JsonObject,
  type TargetStrategy,
} from 'webmcp-capability-forge-core'

import { WorkflowExecutor } from './workflow-executor'

const target = (selector: string, role: SemanticRole, name: string): TargetStrategy => ({
  role,
  name,
  candidates: [{ kind: SelectorKind.StableId, selector, score: 100, uniqueAtRecording: true }],
})

describe('WorkflowExecutor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="query">
      <select id="category"><option value="office">Office</option></select>
      <input id="featured" type="checkbox">
      <button id="search">Search</button>
      <div id="results"></div>
    `
    const query = document.querySelector('#query')
    const search = document.querySelector('#search')
    if (!(query instanceof HTMLInputElement)) throw new Error('Query fixture missing.')
    if (!(search instanceof HTMLButtonElement)) throw new Error('Search fixture missing.')
    Object.defineProperty(query, 'scrollIntoView', { value: () => undefined })
    search.addEventListener('click', () => {
      window.history.pushState({}, '', '/results')
      const result = document.createElement('article')
      result.className = 'result'
      result.textContent = 'Field Notebook'
      document.querySelector('#results')?.append(result)
    })
  })

  it('executes all nine bounded workflow actions and extracts the result', async () => {
    let preservedShortcut = false
    document.querySelector('#query')?.addEventListener('keydown', (event) => {
      preservedShortcut = event instanceof KeyboardEvent && event.ctrlKey
    })
    const definition: CapabilityDefinition = {
      schemaVersion: 1,
      name: 'find_item',
      title: 'Find item',
      description: 'Find one item.',
      scope: { origin: window.location.origin, pathPatterns: ['/*'] },
      inputSchema: {
        type: JsonSchemaType.Object,
        properties: {
          query: { type: JsonSchemaPropertyType.String },
          category: { type: JsonSchemaPropertyType.String },
        },
        required: ['query', 'category'],
        additionalProperties: false,
      },
      classification: CapabilityClassification.Navigation,
      steps: [
        { id: 'fill', action: WorkflowAction.Fill, target: target('#query', SemanticRole.Textbox, 'Query'), value: { source: ValueSource.Input, name: 'query' } },
        { id: 'select', action: WorkflowAction.Select, target: target('#category', SemanticRole.Combobox, 'Category'), value: { source: ValueSource.Input, name: 'category' } },
        { id: 'check', action: WorkflowAction.Check, target: target('#featured', SemanticRole.Checkbox, 'Featured'), checked: true },
        { id: 'key', action: WorkflowAction.Keypress, target: target('#query', SemanticRole.Textbox, 'Query'), key: 'Enter', ctrlKey: true },
        { id: 'scroll', action: WorkflowAction.ScrollIntoView, target: target('#query', SemanticRole.Textbox, 'Query') },
        { id: 'click', action: WorkflowAction.Click, effect: InteractionEffect.Navigation, target: target('#search', SemanticRole.Button, 'Search') },
        { id: 'url', action: WorkflowAction.WaitForUrl, pathPattern: '/results', timeoutMs: 100 },
        { id: 'wait', action: WorkflowAction.WaitFor, target: target('.result', SemanticRole.Textbox, 'Result'), timeoutMs: 100 },
        { id: 'extract', action: WorkflowAction.Extract, target: target('.result', SemanticRole.Textbox, 'Result'), fields: [{ name: 'text', source: ExtractSource.Text }], saveAs: 'items' },
      ],
      expectedEffects: [],
      provenanceSummary: { humanEvents: 1, agentEvents: 8, verifierEvents: 0 },
      verification: { status: VerificationStatus.Proposed, attempts: [] },
      revision: 1,
    }
    const input: JsonObject = { query: 'notebook', category: 'office' }
    const executor = new WorkflowExecutor()

    const outcome = await executor.run({
      executionId: 'execution-1',
      definition,
      input,
      documentValue: document,
      confirmedStepIds: [],
    })

    expect(outcome.status).toBe(ExecutionStatus.Completed)
    expect((document.querySelector('#query') as HTMLInputElement).value).toBe('notebook')
    expect((document.querySelector('#category') as HTMLSelectElement).value).toBe('office')
    expect((document.querySelector('#featured') as HTMLInputElement).checked).toBe(true)
    expect(preservedShortcut).toBe(true)
    expect(JSON.stringify(outcome.outputs)).toContain('Field Notebook')
  })

  it('fails at the missing target without continuing', async () => {
    const definition = {
      ...({} as CapabilityDefinition),
      schemaVersion: 1 as const,
      name: 'missing', title: 'Missing', description: 'Missing target.',
      scope: { origin: window.location.origin, pathPatterns: ['/*'] },
      inputSchema: { type: JsonSchemaType.Object, properties: {}, required: [], additionalProperties: false as const },
      classification: CapabilityClassification.LocalUi,
      steps: [{ id: 'click', action: WorkflowAction.Click, target: target('#absent', SemanticRole.Button, 'Absent') }],
      expectedEffects: [], provenanceSummary: { humanEvents: 0, agentEvents: 1, verifierEvents: 0 },
      verification: { status: VerificationStatus.Proposed, attempts: [] }, revision: 1,
    } satisfies CapabilityDefinition

    const outcome = await new WorkflowExecutor().run({ executionId: 'execution-2', definition, input: {}, documentValue: document, confirmedStepIds: [] })

    expect(outcome.status).toBe(ExecutionStatus.Failed)
    expect(outcome.failure?.failedStep).toBe(0)
  })
})
