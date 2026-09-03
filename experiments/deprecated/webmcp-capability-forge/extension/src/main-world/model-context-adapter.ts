import type { JsonObject, JsonValue } from 'webmcp-capability-forge-core'

export interface WebMcpExecutionOptions {
  readonly signal?: AbortSignal
}

export interface WebMcpToolDefinition {
  readonly name: string
  readonly title: string
  readonly description: string
  readonly inputSchema: JsonObject
  readonly execute: (
    input: JsonObject,
    options?: WebMcpExecutionOptions,
  ) => Promise<JsonValue> | JsonValue
}

export interface ModelContextLike {
  registerTool(
    definition: WebMcpToolDefinition,
    options: { readonly signal: AbortSignal },
  ): Promise<void>
}

export interface RegistrationFailureReporter {
  report(name: string, error?: Error): void
}

export class ModelContextAdapter {
  static get(documentValue: Document): ModelContextLike | null {
    return documentValue.modelContext ?? null
  }
}
