import type { BrowserContext } from '@playwright/test'

export class FakeModelContextInstaller {
  static async install(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      type JsonScalar = string | number | boolean | null
      type JsonObject = { readonly [key: string]: JsonValue }
      type JsonValue = JsonScalar | JsonObject | readonly JsonValue[]
      interface Tool {
        readonly name: string
        execute(input: JsonObject, options?: { readonly signal?: AbortSignal }): Promise<JsonValue> | JsonValue
      }
      const tools = new Map<string, Tool>()
      const modelContext = {
        async registerTool(tool: Tool, options?: { readonly signal?: AbortSignal }) {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => {
            if (tools.get(tool.name) === tool) tools.delete(tool.name)
          }, { once: true })
        },
        async getTools() { return [...tools.values()] },
        async executeTool(name: string, input: JsonObject) {
          const tool = tools.get(name)
          if (!tool) throw new Error(`Tool ${name} is not registered.`)
          return tool.execute(input, { signal: new AbortController().signal })
        },
      }
      Object.defineProperty(document, 'modelContext', { configurable: true, value: modelContext })
    })
  }
}
