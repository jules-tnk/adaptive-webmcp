import { z } from 'zod'

import {
  CapabilityClassification,
  CapabilityLimits,
  CapabilityValidator,
  ExpectedEffectKind,
  ExtractSource,
  JsonSchemaPropertyType,
  JsonSchemaType,
  RiskPolicy,
  SelectorKind,
  ValueSource,
  ValidationIssueCode,
  VerificationStatus,
  WorkflowAction,
  type ActivePageScope,
  type CapabilityDefinition,
  type ExtractField,
  type JsonSchemaProperty,
  type JsonValue,
  type TargetStrategy,
  type ValidationResult,
  type ValueExpression,
  type WorkflowStep,
} from 'webmcp-capability-forge-core'

enum LegacyFormat {
  Pack = 'adaptive-webmcp-toolpack',
  Tool = 'adaptive-webmcp-tool',
}

enum LegacyAction {
  Fill = 'fill',
  Click = 'click',
  WaitFor = 'waitFor',
  Extract = 'extract',
}

enum LegacyValueSource {
  Input = 'input',
  Literal = 'literal',
  Step = 'step',
}

enum LegacyExtractSource {
  Text = 'text',
  Value = 'value',
  Attribute = 'attribute',
}

enum LegacyPropertyType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
}

const legacyValue = z.discriminatedUnion('source', [
  z.object({ source: z.literal(LegacyValueSource.Input), name: z.string() }).strict(),
  z.object({ source: z.literal(LegacyValueSource.Literal), value: z.string() }).strict(),
  z.object({ source: z.literal(LegacyValueSource.Step), step: z.string(), path: z.string() }).strict(),
])

const legacyField = z.object({
  name: z.string(),
  source: z.enum(LegacyExtractSource),
  attribute: z.string().optional(),
}).strict()

const legacyStep = z.discriminatedUnion('action', [
  z.object({ action: z.literal(LegacyAction.Fill), selector: z.string(), value: legacyValue }).strict(),
  z.object({ action: z.literal(LegacyAction.Click), selector: z.string() }).strict(),
  z.object({ action: z.literal(LegacyAction.WaitFor), selector: z.string(), timeoutMs: z.number().int() }).strict(),
  z.object({ action: z.literal(LegacyAction.Extract), selector: z.string(), fields: z.array(legacyField), saveAs: z.string() }).strict(),
])

const legacyProperty = z.object({ type: z.enum(LegacyPropertyType) }).passthrough()
const legacyTool = z.object({
  format: z.literal(LegacyFormat.Tool),
  version: z.literal(1),
  name: z.string(),
  description: z.string(),
  scope: z.object({ origin: z.url(), pathMatch: z.string() }).strict(),
  inputSchema: z.object({
    type: z.literal(JsonSchemaType.Object),
    properties: z.record(z.string(), legacyProperty),
    required: z.array(z.string()).optional(),
    additionalProperties: z.literal(false),
  }).strict(),
  classification: z.string(),
  workflow: z.array(legacyStep).min(1).max(CapabilityLimits.MaximumWorkflowSteps),
}).strict()

const legacyPack = z.object({
  format: z.literal(LegacyFormat.Pack),
  version: z.literal(1),
  exportedAt: z.string(),
  origin: z.url(),
  tools: z.array(legacyTool).min(1),
}).strict()

export class LegacyToolPackImporter {
  static convert(
    value: JsonValue,
    scope: ActivePageScope,
  ): ValidationResult<readonly CapabilityDefinition[]> {
    const parsed = legacyPack.safeParse(value)
    if (!parsed.success || parsed.data.origin !== scope.origin) {
      return { valid: false, issues: [{ path: 'toolpack', code: ValidationIssueCode.Schema, message: 'Legacy tool pack is invalid or belongs to another origin.' }] }
    }
    const definitions: CapabilityDefinition[] = []
    for (const tool of parsed.data.tools) {
      if (tool.scope.origin !== scope.origin) {
        return { valid: false, issues: [{ path: 'scope.origin', code: ValidationIssueCode.OriginMismatch, message: 'Legacy tool origin does not match.' }] }
      }
      const steps = tool.workflow.map((step, index) => LegacyToolPackImporter.step(step, index))
      const target = LegacyToolPackImporter.lastTarget(steps)
      if (!target) return { valid: false, issues: [{ path: 'workflow', code: ValidationIssueCode.UnsafeTarget, message: 'Legacy workflow has no verifiable target.' }] }
      const properties: Record<string, JsonSchemaProperty> = {}
      Object.entries(tool.inputSchema.properties).forEach(([name, property]) => {
        properties[name] = { type: LegacyToolPackImporter.propertyType(property.type) }
      })
      const draft: CapabilityDefinition = {
        schemaVersion: 1,
        name: tool.name,
        title: tool.name.replaceAll('_', ' '),
        description: tool.description,
        scope: { origin: tool.scope.origin, pathPatterns: [tool.scope.pathMatch] },
        inputSchema: { type: JsonSchemaType.Object, properties, required: tool.inputSchema.required ?? [], additionalProperties: false },
        classification: CapabilityClassification.Read,
        steps,
        expectedEffects: [{ kind: ExpectedEffectKind.ElementVisible, target }],
        provenanceSummary: { humanEvents: 0, agentEvents: steps.length, verifierEvents: 0 },
        verification: { status: VerificationStatus.Proposed, attempts: [] },
        revision: 1,
      }
      const definition = { ...draft, classification: RiskPolicy.classify(draft) }
      const validated = CapabilityValidator.validate(definition, scope)
      if (!validated.valid) return validated
      definitions.push(validated.value)
    }
    return { valid: true, value: definitions }
  }

  private static step(step: z.infer<typeof legacyStep>, index: number): WorkflowStep {
    const target = LegacyToolPackImporter.target(step.selector)
    const id = `step-${index + 1}`
    if (step.action === LegacyAction.Fill) return { id, action: WorkflowAction.Fill, target, value: LegacyToolPackImporter.value(step.value) }
    if (step.action === LegacyAction.Click) return { id, action: WorkflowAction.Click, target }
    if (step.action === LegacyAction.WaitFor) return { id, action: WorkflowAction.WaitFor, target, timeoutMs: step.timeoutMs }
    return { id, action: WorkflowAction.Extract, target, fields: step.fields.map(LegacyToolPackImporter.field), saveAs: step.saveAs }
  }

  private static value(value: z.infer<typeof legacyValue>): ValueExpression {
    if (value.source === LegacyValueSource.Input) return { source: ValueSource.Input, name: value.name }
    if (value.source === LegacyValueSource.Step) return { source: ValueSource.Step, step: value.step, path: value.path }
    return { source: ValueSource.Literal, value: value.value }
  }

  private static field(field: z.infer<typeof legacyField>): ExtractField {
    const source = field.source === LegacyExtractSource.Text ? ExtractSource.Text : field.source === LegacyExtractSource.Value ? ExtractSource.Value : ExtractSource.Attribute
    return { name: field.name, source, ...(field.attribute ? { attribute: field.attribute } : {}) }
  }

  private static target(selector: string): TargetStrategy {
    return { candidates: [{ kind: SelectorKind.Structural, selector, score: 15, uniqueAtRecording: true }] }
  }

  private static lastTarget(steps: readonly WorkflowStep[]): TargetStrategy | null {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index]
      if (step && 'target' in step) return step.target
    }
    return null
  }

  private static propertyType(type: LegacyPropertyType): JsonSchemaPropertyType {
    if (type === LegacyPropertyType.Number) return JsonSchemaPropertyType.Number
    if (type === LegacyPropertyType.Integer) return JsonSchemaPropertyType.Integer
    if (type === LegacyPropertyType.Boolean) return JsonSchemaPropertyType.Boolean
    return JsonSchemaPropertyType.String
  }
}
