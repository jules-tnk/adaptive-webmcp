import {
  BridgeMessageType,
  CapabilityClassification,
  VerificationStatus,
  type ActivePageScope,
  type CapabilityDefinition,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from '../storage/json-codec'
import type { PageBridge } from './bootstrap-runtime'
import type { ModelContextLike, RegistrationFailureReporter, WebMcpToolDefinition } from './model-context-adapter'
import { RegistrationLifecycle } from './registration-lifecycle'

class SilentReporter implements RegistrationFailureReporter {
  report(): void {}
}

export class LearnedToolRuntime {
  private readonly lifecycle: RegistrationLifecycle
  private readonly bridge: PageBridge
  private readonly activeNames = new Set<string>()

  constructor(context: ModelContextLike, bridge: PageBridge) {
    this.lifecycle = new RegistrationLifecycle(context, new SilentReporter())
    this.bridge = bridge
  }

  async sync(definitions: readonly CapabilityDefinition[], scope: ActivePageScope): Promise<void> {
    const eligible = definitions.filter((definition) => LearnedToolRuntime.eligible(definition, scope))
    const nextNames = new Set(eligible.map((definition) => definition.name))
    for (const name of this.activeNames) {
      if (!nextNames.has(name)) this.lifecycle.remove(name)
    }
    for (const definition of eligible) {
      await this.lifecycle.register(this.tool(definition))
    }
    this.activeNames.clear()
    nextNames.forEach((name) => this.activeNames.add(name))
  }

  dispose(): void {
    this.lifecycle.dispose()
    this.activeNames.clear()
  }

  private tool(definition: CapabilityDefinition): WebMcpToolDefinition {
    return {
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: JsonCodec.object(definition.inputSchema),
      execute: (input) =>
        this.bridge.request(
          BridgeMessageType.RuntimeExecute,
          JsonCodec.object({ toolName: definition.name, input }),
        ),
    }
  }

  private static eligible(definition: CapabilityDefinition, scope: ActivePageScope): boolean {
    if (definition.scope.origin !== scope.origin) return false
    if (!definition.scope.pathPatterns.some((pattern) => LearnedToolRuntime.matches(scope.path, pattern))) return false
    if (definition.classification === CapabilityClassification.BlockedSensitive) return false
    if (definition.verification.status === VerificationStatus.ReplayVerified) return true
    return (
      definition.classification === CapabilityClassification.ExternalWrite &&
      definition.verification.status === VerificationStatus.ReviewedNotReplayVerified
    )
  }

  private static matches(path: string, pattern: string): boolean {
    return pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern
  }
}
