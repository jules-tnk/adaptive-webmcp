import {
  CapabilityValidator,
  JsonTypes,
  SchemaCatalog,
  ToolPackFormat,
  ValidationIssueCode,
  VerificationStatus,
  type ActivePageScope,
  type CapabilityDefinition,
  type JsonValue,
  type ValidationResult,
} from 'webmcp-capability-forge-core'

import { LegacyToolPackImporter } from './legacy-toolpack-importer'

export class ToolPackImporter {
  static convert(
    value: JsonValue,
    scope: ActivePageScope,
  ): ValidationResult<readonly CapabilityDefinition[]> {
    if (!JsonTypes.isObject(value) || value.format !== ToolPackFormat.CapabilityForge) {
      return LegacyToolPackImporter.convert(value, scope)
    }
    if (
      value.schemaVersion !== 1 || value.origin !== scope.origin ||
      typeof value.exportedAt !== 'string' || !Array.isArray(value.tools) || value.tools.length === 0
    ) return ToolPackImporter.failure('Current tool pack is invalid or belongs to another origin.')
    const definitions: CapabilityDefinition[] = []
    for (const item of value.tools) {
      const parsed = SchemaCatalog.parseCapability(item)
      if (!parsed.valid || parsed.value.scope.origin !== scope.origin) {
        return ToolPackImporter.failure('Imported capability scope is invalid.')
      }
      const candidate: CapabilityDefinition = {
        ...parsed.value,
        verification: { status: VerificationStatus.Proposed, attempts: [] },
      }
      const validated = CapabilityValidator.validate(candidate, scope)
      if (!validated.valid) return validated
      definitions.push(validated.value)
    }
    return { valid: true, value: definitions }
  }

  private static failure(message: string): ValidationResult<never> {
    return {
      valid: false,
      issues: [{ path: 'toolpack', code: ValidationIssueCode.Schema, message }],
    }
  }
}
