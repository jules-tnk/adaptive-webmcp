import type { CapabilityDefinition } from './workflow-contracts'

export enum ToolPackFormat {
  CapabilityForge = 'webmcp-capability-forge-toolpack',
  LegacyAdaptiveWebMcp = 'adaptive-webmcp-toolpack',
}

export interface ToolPack {
  readonly format: ToolPackFormat.CapabilityForge
  readonly schemaVersion: 1
  readonly exportedAt: string
  readonly origin: string
  readonly tools: readonly CapabilityDefinition[]
}
