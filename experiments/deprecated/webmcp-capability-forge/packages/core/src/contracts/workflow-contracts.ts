import type { JsonValue } from '../json/json-value'
import type { TargetStrategy } from '../selectors/selector-contracts'

export enum UrlProtocol {
  Http = 'http:',
  Https = 'https:',
}

export class CapabilityLimits {
  static readonly MaximumWorkflowSteps = 250
}

export enum JsonSchemaType {
  Object = 'object',
}

export enum JsonSchemaPropertyType {
  String = 'string',
  Number = 'number',
  Integer = 'integer',
  Boolean = 'boolean',
}

export enum WorkflowAction {
  Fill = 'fill',
  Click = 'click',
  Select = 'select',
  Check = 'check',
  Keypress = 'keypress',
  ScrollIntoView = 'scrollIntoView',
  WaitFor = 'waitFor',
  WaitForUrl = 'waitForURL',
  Extract = 'extract',
}

export enum InteractionEffect {
  Navigation = 'navigation',
  FormSubmission = 'form_submission',
  Message = 'message',
  Purchase = 'purchase',
  Deletion = 'deletion',
  AccountChange = 'account_change',
  Sensitive = 'sensitive',
}

export enum ValueSource {
  Input = 'input',
  Literal = 'literal',
  Step = 'step',
}

export enum ExtractSource {
  Text = 'text',
  Value = 'value',
  Attribute = 'attribute',
}

export enum ExpectedEffectKind {
  ElementVisible = 'element_visible',
  ElementValue = 'element_value',
  UrlMatches = 'url_matches',
  ItemCount = 'item_count',
}

export enum CapabilityClassification {
  Read = 'read',
  LocalUi = 'local-ui',
  Navigation = 'navigation',
  ExternalWrite = 'external-write',
  BlockedSensitive = 'blocked-sensitive',
}

export enum VerificationStatus {
  Proposed = 'proposed',
  PreflightPassed = 'preflight-passed',
  ReplayVerified = 'replay-verified',
  ReviewedNotReplayVerified = 'reviewed-not-replay-verified',
  Failed = 'failed',
  Stale = 'stale',
}

export interface JsonSchemaProperty {
  readonly type: JsonSchemaPropertyType
  readonly description?: string
  readonly enum?: readonly JsonValue[]
  readonly minimum?: number
  readonly maximum?: number
  readonly minLength?: number
  readonly maxLength?: number
}

export interface RestrictedJsonSchema {
  readonly type: JsonSchemaType.Object
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>
  readonly required: readonly string[]
  readonly additionalProperties: false
}

export interface InputValueExpression {
  readonly source: ValueSource.Input
  readonly name: string
}

export interface LiteralValueExpression {
  readonly source: ValueSource.Literal
  readonly value: JsonValue
}

export interface StepValueExpression {
  readonly source: ValueSource.Step
  readonly step: string
  readonly path: string
}

export type ValueExpression =
  | InputValueExpression
  | LiteralValueExpression
  | StepValueExpression

export interface ExtractField {
  readonly name: string
  readonly source: ExtractSource
  readonly attribute?: string
}

export interface WorkflowStepBase {
  readonly id: string
  readonly action: WorkflowAction
  readonly effect?: InteractionEffect
}

export interface FillStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Fill
  readonly target: TargetStrategy
  readonly value: ValueExpression
}

export interface ClickStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Click
  readonly target: TargetStrategy
}

export interface SelectStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Select
  readonly target: TargetStrategy
  readonly value: ValueExpression
}

export interface CheckStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Check
  readonly target: TargetStrategy
  readonly checked: boolean
}

export interface KeypressStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Keypress
  readonly target: TargetStrategy
  readonly key: string
  readonly ctrlKey?: boolean
  readonly altKey?: boolean
  readonly metaKey?: boolean
  readonly shiftKey?: boolean
}

export interface ScrollIntoViewStep extends WorkflowStepBase {
  readonly action: WorkflowAction.ScrollIntoView
  readonly target: TargetStrategy
}

export interface WaitForStep extends WorkflowStepBase {
  readonly action: WorkflowAction.WaitFor
  readonly target: TargetStrategy
  readonly timeoutMs: number
}

export interface WaitForUrlStep extends WorkflowStepBase {
  readonly action: WorkflowAction.WaitForUrl
  readonly pathPattern: string
  readonly timeoutMs: number
}

export interface ExtractStep extends WorkflowStepBase {
  readonly action: WorkflowAction.Extract
  readonly target: TargetStrategy
  readonly fields: readonly ExtractField[]
  readonly saveAs: string
}

export type WorkflowStep =
  | FillStep
  | ClickStep
  | SelectStep
  | CheckStep
  | KeypressStep
  | ScrollIntoViewStep
  | WaitForStep
  | WaitForUrlStep
  | ExtractStep

export interface ElementVisibleEffect {
  readonly kind: ExpectedEffectKind.ElementVisible
  readonly target: TargetStrategy
}

export interface ElementValueEffect {
  readonly kind: ExpectedEffectKind.ElementValue
  readonly target: TargetStrategy
  readonly value: ValueExpression
}

export interface UrlMatchesEffect {
  readonly kind: ExpectedEffectKind.UrlMatches
  readonly pathPattern: string
}

export interface ItemCountEffect {
  readonly kind: ExpectedEffectKind.ItemCount
  readonly target: TargetStrategy
  readonly count: number
}

export type ExpectedEffect =
  | ElementVisibleEffect
  | ElementValueEffect
  | UrlMatchesEffect
  | ItemCountEffect

export interface ProvenanceSummary {
  readonly humanEvents: number
  readonly agentEvents: number
  readonly verifierEvents: number
}

export interface TraceReductionSummary {
  readonly rawEvents: number
  readonly compiledEvents: number
  readonly omittedEvents: number
}

export interface VerificationAttempt {
  readonly id: string
  readonly status: VerificationStatus
  readonly startedAt: number
  readonly completedAt?: number
}

export interface VerificationRecord {
  readonly status: VerificationStatus
  readonly attempts: readonly VerificationAttempt[]
}

export interface CapabilityDefinition {
  readonly schemaVersion: 1
  readonly name: string
  readonly title: string
  readonly description: string
  readonly scope: {
    readonly origin: string
    readonly pathPatterns: readonly string[]
  }
  readonly inputSchema: RestrictedJsonSchema
  readonly classification: CapabilityClassification
  readonly steps: readonly WorkflowStep[]
  readonly expectedEffects: readonly ExpectedEffect[]
  readonly provenanceSummary: ProvenanceSummary
  readonly traceReduction?: TraceReductionSummary
  readonly verification: VerificationRecord
  readonly revision: number
}
