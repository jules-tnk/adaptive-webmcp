import { describe, expect, it } from 'vitest'

import {
  JsonSchemaPropertyType,
  SelectorKind,
  SemanticRole,
  VerificationStatus,
  ValueSource,
  WorkflowAction,
  type CapabilityDefinition,
} from 'webmcp-capability-forge-core'

import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import { WorkflowPreflight } from './workflow-preflight'

class WorkflowPreflightFixtures {
  static definition(): CapabilityDefinition {
    const base = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed)
    const target = {
      role: SemanticRole.Textbox,
      name: 'Search catalog',
      candidates: [{
        kind: SelectorKind.AccessibleRole,
        selector: '[aria-label="Search catalog"]',
        score: 100,
        uniqueAtRecording: true,
      }],
    }
    return {
      ...base,
      inputSchema: {
        ...base.inputSchema,
        properties: { query: { type: JsonSchemaPropertyType.String } },
        required: ['query'],
      },
      steps: [{
        id: 'step-1',
        action: WorkflowAction.Fill,
        target,
        value: { source: ValueSource.Input, name: 'query' },
      }],
      expectedEffects: [],
    }
  }
}

describe('WorkflowPreflight', () => {
  it('collects a required input from the currently resolved form target', () => {
    document.body.innerHTML = '<input aria-label="Search catalog" value="notebook">'

    const result = WorkflowPreflight.inspect(WorkflowPreflightFixtures.definition(), document)

    expect(result.ready).toBe(true)
    expect(result.input).toEqual({ query: 'notebook' })
  })

  it('fails when a workflow target is absent', () => {
    document.body.innerHTML = '<main>No search control</main>'

    const result = WorkflowPreflight.inspect(WorkflowPreflightFixtures.definition(), document)

    expect(result.ready).toBe(false)
    expect(result.input).toEqual({})
  })
})
