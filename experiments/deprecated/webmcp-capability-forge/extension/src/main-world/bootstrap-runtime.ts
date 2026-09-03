import {
  BridgeMessageType,
  BootstrapOperation,
  ForgeToolName,
  JsonSchemaPropertyType,
  JsonSchemaType,
  LearningMode,
  SessionActor,
  SessionStatus,
  type JsonObject,
  type JsonValue,
  type LearningSession,
} from 'webmcp-capability-forge-core'

import type {
  ModelContextLike,
  RegistrationFailureReporter,
  WebMcpToolDefinition,
} from './model-context-adapter'
import { RegistrationLifecycle } from './registration-lifecycle'

export interface PageBridge {
  request(type: string, payload: JsonObject): Promise<JsonValue>
}

export interface RuntimeState {
  readonly session?: LearningSession
}

class SilentReporter implements RegistrationFailureReporter {
  report(): void {}
}

export class BootstrapRuntime {
  private lifecycle: RegistrationLifecycle | null = null
  private bridge: PageBridge | null = null
  private temporaryActive = false

  async install(context: ModelContextLike, bridge: PageBridge): Promise<void> {
    this.dispose()
    this.bridge = bridge
    this.lifecycle = new RegistrationLifecycle(context, new SilentReporter())
    await this.lifecycle.register(this.bootstrapDefinition())
  }

  async sync(state: RuntimeState): Promise<void> {
    const active =
      state.session?.status === SessionStatus.Collecting &&
      (state.session.actor === SessionActor.Agent ||
        state.session.mode === LearningMode.Automatic ||
        state.session.mode === LearningMode.Hybrid)
    if (active && !this.temporaryActive) {
      for (const definition of this.temporaryDefinitions()) {
        await this.lifecycle?.register(definition)
      }
      this.temporaryActive = true
    } else if (!active && this.temporaryActive) {
      this.removeTemporary()
    }
  }

  dispose(): void {
    this.lifecycle?.dispose()
    this.lifecycle = null
    this.bridge = null
    this.temporaryActive = false
  }

  private bootstrapDefinition(): WebMcpToolDefinition {
    return {
      name: ForgeToolName.Bootstrap,
      title: 'Capability Forge',
      description: 'Call inspect first to learn, reuse, and repair reviewed WebMCP workflows for this page.',
      inputSchema: {
        type: JsonSchemaType.Object,
        properties: {
          operation: {
            type: JsonSchemaPropertyType.String,
            enum: Object.values(BootstrapOperation),
          },
          goal: {
            type: JsonSchemaPropertyType.String,
            description: 'The browser task the agent needs to complete when beginning learning.',
          },
          sessionId: {
            type: JsonSchemaPropertyType.String,
            description: 'The active session to join.',
          },
          toolName: {
            type: JsonSchemaPropertyType.String,
            description: 'The learned tool that failed or needs repair.',
          },
          failureCode: {
            type: JsonSchemaPropertyType.String,
            description: 'The structured failure code returned by Capability Forge.',
          },
          failureMessage: {
            type: JsonSchemaPropertyType.String,
            description: 'A concise failure description.',
          },
        },
        required: ['operation'],
        additionalProperties: false,
      },
      execute: (input) => this.request(this.operationType(input), input),
    }
  }

  private temporaryDefinitions(): readonly WebMcpToolDefinition[] {
    return [
      this.definition(ForgeToolName.InspectPage, 'Inspect page', BridgeMessageType.PageInspect),
      this.definition(ForgeToolName.Interact, 'Interact with page', BridgeMessageType.PageInteract),
      this.definition(ForgeToolName.ObserveChanges, 'Observe changes', BridgeMessageType.PageObserve),
      this.definition(ForgeToolName.ReadTrace, 'Read trace', BridgeMessageType.SessionGet),
      this.definition(ForgeToolName.ProposeWorkflow, 'Propose workflow', BridgeMessageType.WorkflowPropose),
    ]
  }

  private definition(
    name: ForgeToolName,
    title: string,
    type: BridgeMessageType,
  ): WebMcpToolDefinition {
    return {
      name,
      title,
      description: `${title} during the approved learning session.`,
      inputSchema: {
        type: JsonSchemaType.Object,
        properties: {},
        additionalProperties: true,
      },
      execute: (input) => this.request(type, input),
    }
  }

  private request(type: BridgeMessageType, payload: JsonObject): Promise<JsonValue> {
    return this.bridge?.request(type, payload) ?? Promise.resolve({ ok: false })
  }

  private operationType(input: JsonObject): BridgeMessageType {
    const operation = input.operation
    if (operation === BootstrapOperation.BeginSession) return BridgeMessageType.SessionBegin
    if (operation === BootstrapOperation.JoinSession) return BridgeMessageType.SessionJoin
    if (operation === BootstrapOperation.ListTools) return BridgeMessageType.CapabilitiesList
    if (operation === BootstrapOperation.ReportFailure) return BridgeMessageType.FailureReport
    if (operation === BootstrapOperation.RequestRepair) return BridgeMessageType.RepairRequest
    return BridgeMessageType.ProtocolInspect
  }

  private removeTemporary(): void {
    this.lifecycle?.remove(ForgeToolName.InspectPage)
    this.lifecycle?.remove(ForgeToolName.Interact)
    this.lifecycle?.remove(ForgeToolName.ObserveChanges)
    this.lifecycle?.remove(ForgeToolName.ReadTrace)
    this.lifecycle?.remove(ForgeToolName.ProposeWorkflow)
    this.temporaryActive = false
  }
}
