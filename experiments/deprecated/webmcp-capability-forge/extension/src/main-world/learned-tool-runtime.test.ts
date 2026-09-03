import { describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  VerificationStatus,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { LearnedToolRuntime } from './learned-tool-runtime'
import type { PageBridge } from './bootstrap-runtime'
import type { ModelContextLike, WebMcpToolDefinition } from './model-context-adapter'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'

class FakeModelContext implements ModelContextLike {
  definitions = new Map<string, WebMcpToolDefinition>()
  async registerTool(definition: WebMcpToolDefinition, options: { readonly signal: AbortSignal }): Promise<void> {
    this.definitions.set(definition.name, definition)
    options.signal.addEventListener('abort', () => this.definitions.delete(definition.name))
  }
}

class FakeBridge implements PageBridge {
  payload: JsonObject = {}
  async request(_type: string, payload: JsonObject): Promise<JsonValue> {
    this.payload = payload
    return { ok: true }
  }
}

describe('LearnedToolRuntime', () => {
  it('registers only scope-matching eligible revisions and removes them when scope changes', async () => {
    const context = new FakeModelContext()
    const runtime = new LearnedToolRuntime(context, new FakeBridge())
    const verified = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.ReplayVerified)
    const blocked = {
      ...RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed),
      name: 'blocked_tool',
      classification: CapabilityClassification.BlockedSensitive,
    }

    await runtime.sync([verified, blocked], { origin: 'https://shop.example', path: '/catalog' })
    expect(context.definitions.has(verified.name)).toBe(true)
    expect(context.definitions.has(blocked.name)).toBe(false)

    await runtime.sync([verified], { origin: 'https://other.example', path: '/catalog' })
    expect(context.definitions.has(verified.name)).toBe(false)
  })

  it('sends only the tool name and input for trusted background execution', async () => {
    const context = new FakeModelContext()
    const bridge = new FakeBridge()
    const runtime = new LearnedToolRuntime(context, bridge)
    const verified = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.ReplayVerified)
    await runtime.sync([verified], { origin: 'https://shop.example', path: '/catalog' })
    const tool = context.definitions.get(verified.name)
    if (!tool) throw new Error('Learned tool was not registered.')

    await tool.execute({ query: 'notebook' })

    expect(bridge.payload).toEqual({ toolName: verified.name, input: { query: 'notebook' } })
    expect(bridge.payload.definition).toBeUndefined()
  })
})
