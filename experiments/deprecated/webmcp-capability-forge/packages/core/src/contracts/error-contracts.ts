export enum ValidationIssueCode {
  Schema = 'schema',
  InvalidSessionTransition = 'invalid_session_transition',
  SessionLimitReached = 'session_limit_reached',
  TargetMissing = 'target_missing',
  TargetAmbiguous = 'target_ambiguous',
  StaleRevision = 'stale_revision',
  OriginMismatch = 'origin_mismatch',
  PathMismatch = 'path_mismatch',
  UndeclaredInput = 'undeclared_input',
  UnknownStepReference = 'unknown_step_reference',
  DuplicateStepOutput = 'duplicate_step_output',
  MissingRouteCheckpoint = 'missing_route_checkpoint',
  ArbitraryUrl = 'arbitrary_url',
  UnsafeTarget = 'unsafe_target',
  ClassificationMismatch = 'classification_mismatch',
  BridgeInvalid = 'bridge_invalid',
  BridgeReplay = 'bridge_replay',
}

export enum FailureCode {
  InvalidSessionTransition = 'INVALID_SESSION_TRANSITION',
  SessionLimitReached = 'SESSION_LIMIT_REACHED',
  PermissionRequired = 'PERMISSION_REQUIRED',
  RiskConfirmationRequired = 'RISK_CONFIRMATION_REQUIRED',
  SensitiveTargetBlocked = 'SENSITIVE_TARGET_BLOCKED',
  TargetMissing = 'TARGET_MISSING',
  TargetAmbiguous = 'TARGET_AMBIGUOUS',
  RouteMismatch = 'ROUTE_MISMATCH',
  NavigationInterrupted = 'NAVIGATION_INTERRUPTED',
  ExpectedEffectMissing = 'EXPECTED_EFFECT_MISSING',
  OutputLimitExceeded = 'OUTPUT_LIMIT_EXCEEDED',
  StaleRevision = 'STALE_REVISION',
  BridgeInvalid = 'BRIDGE_INVALID',
  BridgeReplay = 'BRIDGE_REPLAY',
  ExecutionCancelled = 'EXECUTION_CANCELLED',
  ExecutionError = 'EXECUTION_ERROR',
  Timeout = 'TIMEOUT',
}

export interface ValidationIssue {
  readonly path: string
  readonly code: ValidationIssueCode
  readonly message: string
}

export interface ValidationSuccess<T> {
  readonly valid: true
  readonly value: T
}

export interface ValidationFailure {
  readonly valid: false
  readonly issues: readonly ValidationIssue[]
  readonly failure?: FailureCode
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure
