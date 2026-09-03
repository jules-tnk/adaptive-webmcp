import type { ForgeToolName } from 'webmcp-capability-forge-core'

import type {
  ModelContextLike,
  RegistrationFailureReporter,
  WebMcpToolDefinition,
} from './model-context-adapter'

export class RegistrationLifecycle {
  private readonly context: ModelContextLike
  private readonly reporter: RegistrationFailureReporter
  private readonly controllers = new Map<string, AbortController>()

  constructor(context: ModelContextLike, reporter: RegistrationFailureReporter) {
    this.context = context
    this.reporter = reporter
  }

  async register(definition: WebMcpToolDefinition): Promise<void> {
    this.remove(definition.name as ForgeToolName)
    const controller = new AbortController()
    this.controllers.set(definition.name, controller)
    await this.context
      .registerTool(definition, { signal: controller.signal })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') this.reporter.report(definition.name, error)
      })
  }

  remove(name: ForgeToolName | string): void {
    this.controllers.get(name)?.abort()
    this.controllers.delete(name)
  }

  dispose(): void {
    for (const controller of this.controllers.values()) controller.abort()
    this.controllers.clear()
  }
}
