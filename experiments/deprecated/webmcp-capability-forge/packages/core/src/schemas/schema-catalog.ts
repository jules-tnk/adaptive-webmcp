import { z } from 'zod'

z.config({ jitless: true })

import {
  CapabilityClassification,
  CapabilityLimits,
  ExpectedEffectKind,
  ExtractSource,
  InteractionEffect,
  JsonSchemaPropertyType,
  JsonSchemaType,
  UrlProtocol,
  ValueSource,
  VerificationStatus,
  WorkflowAction,
  type CapabilityDefinition,
} from '../contracts/workflow-contracts'
import {
  LearningMode,
  SessionActor,
  SessionRecoveryAction,
  SessionStatus,
  TraceSource,
  type TraceEvent,
  type LearningSession,
} from '../contracts/session-contracts'
import {
  ValidationIssueCode,
  type ValidationIssue,
  type ValidationResult,
} from '../contracts/error-contracts'
import type { JsonValue } from '../json/json-value'
import { SelectorKind, SemanticRole } from '../selectors/selector-contracts'

const httpOriginSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === UrlProtocol.Http || protocol === UrlProtocol.Https
})

const pathPatternSchema = z.string().min(1).max(256).refine((value) => {
  if (!value.startsWith('/')) return false
  const wildcardCount = value.split('*').length - 1
  return wildcardCount === 0 || (wildcardCount === 1 && value.endsWith('*'))
})

const selectorCandidateSchema = z
  .object({
    kind: z.enum(SelectorKind),
    selector: z.string().min(1).max(512),
    score: z.number().int().min(0).max(100),
    uniqueAtRecording: z.boolean(),
  })
  .strict()

const targetStrategySchema = z
  .object({
    role: z.enum(SemanticRole).optional(),
    name: z.string().min(1).max(256).optional(),
    candidates: z.array(selectorCandidateSchema).min(1).max(12),
  })
  .strict()

const jsonSchemaPropertySchema = z
  .object({
    type: z.enum(JsonSchemaPropertyType),
    description: z.string().max(200).optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
  })
  .strict()

const inputSchema = z
  .object({
    type: z.literal(JsonSchemaType.Object),
    properties: z.record(z.string(), jsonSchemaPropertySchema),
    required: z.array(z.string()).max(32),
    additionalProperties: z.literal(false),
  })
  .strict()

const valueExpressionSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal(ValueSource.Input), name: z.string().min(1).max(64) }).strict(),
  z.object({ source: z.literal(ValueSource.Literal), value: z.json() }).strict(),
  z
    .object({
      source: z.literal(ValueSource.Step),
      step: z.string().min(1).max(64),
      path: z.string().min(1).max(128),
    })
    .strict(),
])

const extractFieldSchema = z
  .object({
    name: z.string().min(1).max(64),
    source: z.enum(ExtractSource),
    attribute: z.string().min(1).max(64).optional(),
  })
  .strict()

const workflowStepSchema = z.discriminatedUnion('action', [
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Fill),
      target: targetStrategySchema,
      value: valueExpressionSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Click),
      effect: z.enum(InteractionEffect).optional(),
      target: targetStrategySchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Select),
      target: targetStrategySchema,
      value: valueExpressionSchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Check),
      target: targetStrategySchema,
      checked: z.boolean(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Keypress),
      target: targetStrategySchema,
      key: z.string().min(1).max(32),
      ctrlKey: z.boolean().optional(),
      altKey: z.boolean().optional(),
      metaKey: z.boolean().optional(),
      shiftKey: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.ScrollIntoView),
      target: targetStrategySchema,
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.WaitFor),
      target: targetStrategySchema,
      timeoutMs: z.number().int().min(0).max(5000),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.WaitForUrl),
      pathPattern: pathPatternSchema,
      timeoutMs: z.number().int().min(0).max(5000),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(64),
      action: z.literal(WorkflowAction.Extract),
      target: targetStrategySchema,
      fields: z.array(extractFieldSchema).min(1).max(20),
      saveAs: z.string().min(1).max(64),
    })
    .strict(),
])

const expectedEffectSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal(ExpectedEffectKind.ElementVisible),
      target: targetStrategySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal(ExpectedEffectKind.ElementValue),
      target: targetStrategySchema,
      value: valueExpressionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal(ExpectedEffectKind.UrlMatches),
      pathPattern: pathPatternSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal(ExpectedEffectKind.ItemCount),
      target: targetStrategySchema,
      count: z.number().int().min(0).max(1000),
    })
    .strict(),
])

const verificationAttemptSchema = z
  .object({
    id: z.string().min(1).max(64),
    status: z.enum(VerificationStatus),
    startedAt: z.number().int().nonnegative(),
    completedAt: z.number().int().nonnegative().optional(),
  })
  .strict()

const capabilitySchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    scope: z
      .object({
        origin: httpOriginSchema,
        pathPatterns: z.array(pathPatternSchema).min(1).max(12),
      })
      .strict(),
    inputSchema,
    classification: z.enum(CapabilityClassification),
    steps: z.array(workflowStepSchema).min(1).max(CapabilityLimits.MaximumWorkflowSteps),
    expectedEffects: z.array(expectedEffectSchema).min(1).max(12),
    provenanceSummary: z
      .object({
        humanEvents: z.number().int().nonnegative(),
        agentEvents: z.number().int().nonnegative(),
        verifierEvents: z.number().int().nonnegative(),
      })
      .strict(),
    traceReduction: z
      .object({
        rawEvents: z.number().int().nonnegative(),
        compiledEvents: z.number().int().nonnegative(),
        omittedEvents: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    verification: z
      .object({
        status: z.enum(VerificationStatus),
        attempts: z.array(verificationAttemptSchema).max(20),
      })
      .strict(),
    revision: z.number().int().min(1),
  })
  .strict()

const traceEventSchema = z
  .object({
    id: z.string().min(1).max(64),
    source: z.enum(TraceSource),
    action: z.enum(WorkflowAction),
    target: targetStrategySchema.optional(),
    inputReference: z.string().min(1).max(64).optional(),
    outcome: z
      .object({
        text: z.string().max(32768).optional(),
        attributes: z.record(z.string(), z.string()).optional(),
        truncated: z.boolean(),
      })
      .strict()
      .optional(),
    data: z.json().optional(),
    origin: httpOriginSchema,
    path: z.string().startsWith('/'),
    timestamp: z.number().int().nonnegative(),
  })
  .strict()

const sessionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(64),
    goal: z.string().min(1).max(500),
    origin: httpOriginSchema,
    startPath: z.string().startsWith('/'),
    currentPath: z.string().startsWith('/'),
    mode: z.enum(LearningMode),
    actor: z.enum(SessionActor),
    status: z.enum(SessionStatus),
    trace: z.array(traceEventSchema).max(100),
    agentActionCount: z.number().int().min(0).max(20),
    startedAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
    pauseReason: z.string().optional(),
    recoveryActions: z.array(z.enum(SessionRecoveryAction)).optional(),
  })
  .strict()

export class SchemaCatalog {
  static parseTraceEvent(value: JsonValue): ValidationResult<TraceEvent> {
    const parsed = traceEventSchema.safeParse(value)
    if (!parsed.success) return SchemaCatalog.failure(parsed.error.issues)
    return { valid: true, value: parsed.data as TraceEvent }
  }

  static parseSession(value: JsonValue): ValidationResult<LearningSession> {
    const parsed = sessionSchema.safeParse(value)
    if (!parsed.success) return SchemaCatalog.failure(parsed.error.issues)
    return { valid: true, value: parsed.data as LearningSession }
  }

  static parseCapability(value: JsonValue): ValidationResult<CapabilityDefinition> {
    const parsed = capabilitySchema.safeParse(value)
    if (!parsed.success) return SchemaCatalog.failure(parsed.error.issues)
    return { valid: true, value: parsed.data as CapabilityDefinition }
  }

  private static failure(issues: readonly z.core.$ZodIssue[]): ValidationResult<never> {
    const mapped: ValidationIssue[] = issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.'),
      code: ValidationIssueCode.Schema,
      message: issue.message,
    }))
    return { valid: false, issues: mapped }
  }
}
