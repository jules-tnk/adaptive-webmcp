import { describe, expect, it } from 'vitest'

import { ForgeToolName } from 'webmcp-capability-forge-core'

import { RegistrationLifecycle } from './registration-lifecycle'
import type {
  ModelContextLike,
  RegistrationFailureReporter,
  WebMcpToolDefinition,
} from './model-context-adapter'

class FakeModelContext implements ModelContextLike {
  names: string[] = []

  async registerTool(
    definition: WebMcpToolDefinition,
    options: { readonly signal: AbortSignal },
  ): Promise<void> {
    this.names.push(definition.name)
    options.signal.addEventListener('abort', () => {
      this.names = this.names.filter((name) => name !== definition.name)
    })
  }
}

class FailureReporter implements RegistrationFailureReporter {
  failures: string[] = []
  report(name: string): void { this.failures.push(name) }
}

describe('RegistrationLifecycle', () => {
  it('replaces and aborts registrations without reporting expected teardown', async () => {
    const context = new FakeModelContext()
    const reporter = new FailureReporter()
    const lifecycle = new RegistrationLifecycle(context, reporter)
    const definition: WebMcpToolDefinition = {
      name: ForgeToolName.InspectPage,
      title: 'Inspect page',
      description: 'Inspect visible page controls.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({ ok: true }),
    }

    await lifecycle.register(definition)
    await lifecycle.register(definition)
    lifecycle.remove(ForgeToolName.InspectPage)

    expect(context.names).toEqual([])
    expect(reporter.failures).toEqual([])
  })
})
