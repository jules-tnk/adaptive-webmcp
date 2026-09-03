import {
  CapabilityValidator,
  ExecutionStatus,
  FailureCode,
  JsonSchemaPropertyType,
  InteractionEffect,
  WorkflowAction,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import type { CapabilityRepository } from '../storage/capability-repository'
import type { ContinuationRepository } from '../storage/continuation-repository'
import type { RepairCoordinator } from './repair-coordinator'

export interface LearnedToolExecutionRequest {
  readonly tabId: number
  readonly origin: string
  readonly path: string
  readonly toolName: string
  readonly input: JsonObject
}

export interface LearnedToolExecutionPlatform {
  execute(
    tabId: number,
    definition: CapabilityDefinition,
    input: JsonObject,
  ): Promise<ExecutionOutcome>
}

export interface LearnedToolExecutionDependencies {
  now(): number
}

export class LearnedToolExecutionCoordinator {
  private readonly capabilities: CapabilityRepository
  private readonly continuations: ContinuationRepository
  private readonly repairs: RepairCoordinator
  private readonly platform: LearnedToolExecutionPlatform
  private readonly dependencies: LearnedToolExecutionDependencies

  constructor(
    capabilities: CapabilityRepository,
    continuations: ContinuationRepository,
    repairs: RepairCoordinator,
    platform: LearnedToolExecutionPlatform,
    dependencies: LearnedToolExecutionDependencies = { now: () => Date.now() },
  ) {
    this.capabilities = capabilities
    this.continuations = continuations
    this.repairs = repairs
    this.platform = platform
    this.dependencies = dependencies
  }

  async execute(request: LearnedToolExecutionRequest): Promise<ExecutionOutcome> {
    const definition = await this.capabilities.getActive(request.origin, request.toolName)
    if (!definition) return this.storeFailure(request.tabId, FailureCode.TargetMissing, 'No active learned tool matches this request.')
    const scoped = CapabilityValidator.validate(definition, { origin: request.origin, path: request.path })
    if (!scoped.valid) return this.storeFailure(request.tabId, FailureCode.RouteMismatch, 'The learned tool is outside its approved scope.')
    if (!LearnedToolExecutionCoordinator.validInput(definition, request.input)) {
      return this.storeFailure(request.tabId, FailureCode.ExecutionError, 'The learned tool input does not match its schema.')
    }
    const navigationIndex = definition.steps.findIndex((step, index) =>
      step.effect === InteractionEffect.Navigation &&
      definition.steps[index + 1]?.action === WorkflowAction.WaitForUrl,
    )
    if (navigationIndex >= 0) {
      const checkpointStep = definition.steps[navigationIndex + 1]
      if (checkpointStep?.action === WorkflowAction.WaitForUrl) {
        await this.continuations.saveCheckpoint({
          executionId: crypto.randomUUID(),
          tabId: request.tabId,
          origin: request.origin,
          expectedPath: checkpointStep.pathPattern,
          capabilityName: definition.name,
          capabilityRevision: definition.revision,
          nextStep: navigationIndex + 1,
          input: request.input,
          expiresAt: this.dependencies.now() + 30_000,
        })
      }
    }
    const outcome = await this.platform.execute(request.tabId, definition, request.input)
    await this.continuations.saveOutcome(request.tabId, outcome)
    if (outcome.status === ExecutionStatus.Completed || outcome.failure?.code !== FailureCode.NavigationInterrupted) {
      await this.continuations.removeCheckpoint(request.tabId)
    }
    if (outcome.status === ExecutionStatus.Failed && outcome.failure) {
      await this.repairs.recordFailure({
        origin: definition.scope.origin,
        name: definition.name,
        revision: definition.revision,
        code: outcome.failure.code,
        message: outcome.failure.message,
        ...(outcome.failure.failedStep === undefined ? {} : { failedStep: outcome.failure.failedStep }),
      })
    }
    return outcome
  }

  private async storeFailure(
    tabId: number,
    code: FailureCode,
    message: string,
  ): Promise<ExecutionOutcome> {
    const outcome: ExecutionOutcome = {
      executionId: crypto.randomUUID(),
      status: ExecutionStatus.Failed,
      completedSteps: 0,
      outputs: {},
      failure: { code, message },
    }
    await this.continuations.saveOutcome(tabId, outcome)
    return outcome
  }

  private static validInput(definition: CapabilityDefinition, input: JsonObject): boolean {
    const properties = definition.inputSchema.properties
    if (Object.keys(input).some((name) => properties[name] === undefined)) return false
    if (definition.inputSchema.required.some((name) => input[name] === undefined)) return false
    return Object.entries(input).every(([name, value]) => {
      const property = properties[name]
      return property ? LearnedToolExecutionCoordinator.matchesType(property.type, value) : false
    })
  }

  private static matchesType(type: JsonSchemaPropertyType, value: JsonValue): boolean {
    if (type === JsonSchemaPropertyType.String) return typeof value === 'string'
    if (type === JsonSchemaPropertyType.Boolean) return typeof value === 'boolean'
    if (type === JsonSchemaPropertyType.Integer) return typeof value === 'number' && Number.isInteger(value)
    return typeof value === 'number' && Number.isFinite(value)
  }
}
