import type { AnyCircuitElement } from "circuit-json";

export enum TscircuitDiagnosticSeverity {
  Error = "error",
  Warning = "warning"
}

export enum TscircuitDiagnosticCode {
  UnknownComponentKind = "UNKNOWN_COMPONENT_KIND",
  InvalidComponentProperties = "INVALID_COMPONENT_PROPERTIES",
  InvalidComponentReference = "INVALID_COMPONENT_REFERENCE",
  InvalidTerminalReference = "INVALID_TERMINAL_REFERENCE",
  DuplicatePublicId = "DUPLICATE_PUBLIC_ID",
  CircuitJsonValidationFailed = "CIRCUIT_JSON_VALIDATION_FAILED",
  DuplicateCircuitJsonId = "DUPLICATE_CIRCUIT_JSON_ID",
  InvalidCircuitJsonReference = "INVALID_CIRCUIT_JSON_REFERENCE"
}

export type TscircuitDiagnostic = {
  readonly code: TscircuitDiagnosticCode;
  readonly severity: TscircuitDiagnosticSeverity;
  readonly message: string;
  readonly affectedIds: readonly string[];
};

export type TscircuitConversionResult = {
  readonly elements: AnyCircuitElement[];
  readonly diagnostics: TscircuitDiagnostic[];
};
