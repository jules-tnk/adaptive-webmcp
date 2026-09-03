import { describe, expect, it } from 'vitest'

import {
  BootstrapOperation,
  BridgeMessageType,
  ForgeToolName,
  LearningMode,
  SessionActor,
  SessionMachine,
  SessionStatus,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { BootstrapRuntime, type PageBridge, type RuntimeState } from './bootstrap-runtime'
import type { ModelContextLike, WebMcpToolDefinition } from './model-context-adapter'

class FakeModelContext implements ModelContextLike {
  definitions = new Map<string, WebMcpToolDefinition>()

  async registerTool(
    definition: WebMcpToolDefinition,
    options: { readonly signal: AbortSignal },
  ): Promise<void> {
    this.definitions.set(definition.name, definition)
    options.signal.addEventListener('abort', () => this.definitions.delete(definition.name))
  }
}

class FakePageBridge implements PageBridge {
  type: string | null = null
  payload: JsonObject = {}
  async request(_type: string, _payload: JsonObject): Promise<JsonValue> {
    this.type = _type
    this.payload = _payload
    return { ok: true }
  }
}

describe('BootstrapRuntime', () => {
  it('accepts an agent task goal and routes begin_session without origin, path, or mode input', async () => {
    const context = new FakeModelContext()
    const bridge = new FakePageBridge()
    const runtime = new BootstrapRuntime()
    await runtime.install(context, bridge)
    const bootstrap = context.definitions.get(ForgeToolName.Bootstrap)
    if (!bootstrap) throw new Error('Bootstrap tool was not registered.')

    await bootstrap.execute({ operation: BootstrapOperation.BeginSession, goal: 'Search the catalog' })

    expect(bridge.type).toBe(BridgeMessageType.SessionBegin)
    expect(bridge.payload).toEqual({ operation: BootstrapOperation.BeginSession, goal: 'Search the catalog' })
    expect(bootstrap.inputSchema).toMatchObject({ required: ['operation'] })
    expect(JSON.stringify(bootstrap.inputSchema)).toContain('goal')
  })

  it('keeps bootstrap stable and exposes temporary tools only while Automatic collection is active', async () => {
    const context = new FakeModelContext()
    const runtime = new BootstrapRuntime()
    await runtime.install(context, new FakePageBridge())
    expect(context.definitions.has(ForgeToolName.Bootstrap)).toBe(true)
    expect(context.definitions.has(ForgeToolName.InspectPage)).toBe(false)

    const session = SessionMachine.start(
      {
        goal: 'Find an item',
        origin: 'https://shop.example',
        path: '/catalog',
        mode: LearningMode.Automatic,
        actor: SessionActor.Agent,
      },
      { now: () => 1000, createId: () => 'session-1' },
    )
    await runtime.sync({ session } satisfies RuntimeState)
    expect(context.definitions.has(ForgeToolName.InspectPage)).toBe(true)
    expect(context.definitions.has(ForgeToolName.ProposeWorkflow)).toBe(true)

    await runtime.sync({ session: { ...session, status: SessionStatus.Paused } })
    expect(context.definitions.has(ForgeToolName.Bootstrap)).toBe(true)
    expect(context.definitions.has(ForgeToolName.InspectPage)).toBe(false)
  })
})
