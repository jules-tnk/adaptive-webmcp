import {
  ToolPackFormat,
  type CapabilityDefinition,
  type ToolPack,
} from 'webmcp-capability-forge-core'

export class ToolPackExporter {
  static create(
    origin: string,
    definitions: readonly CapabilityDefinition[],
    exportedAt: string,
  ): ToolPack {
    return {
      format: ToolPackFormat.CapabilityForge,
      schemaVersion: 1,
      exportedAt,
      origin,
      tools: definitions
        .filter((definition) => definition.scope.origin === origin)
        .map((definition) => structuredClone(definition)),
    }
  }
}
