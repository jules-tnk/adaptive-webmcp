import type {
  CircuitDesign,
  SimulationOverrides,
  SimulationResult
} from "@/domain/types";
import { SimulationEngineId } from "@/domain/types";

export { SimulationEngineId } from "@/domain/types";

export enum SimulationDiagnosticCode {
  UnsupportedComponent = "SIMULATION_UNSUPPORTED_COMPONENT",
  EngineFailure = "SIMULATION_ENGINE_FAILURE",
  EngineUnavailable = "SIMULATION_ENGINE_UNAVAILABLE"
}

export enum SimulationAnalysisType {
  OperatingPoint = "operating_point",
  DcSweep = "dc_sweep",
  AcSweep = "ac_sweep",
  Transient = "transient"
}

export enum SimulationSweepScale {
  Linear = "linear",
  Decade = "decade",
  Octave = "octave"
}

export enum SimulationProbeKind {
  NodeVoltage = "node_voltage",
  ComponentCurrent = "component_current"
}

export interface OperatingPointSimulationAnalysis {
  readonly type: SimulationAnalysisType.OperatingPoint;
}

export interface DcSweepSimulationAnalysis {
  readonly type: SimulationAnalysisType.DcSweep;
  readonly sourceComponentId: string;
  readonly start: number;
  readonly stop: number;
  readonly step: number;
}

export interface AcSweepSimulationAnalysis {
  readonly type: SimulationAnalysisType.AcSweep;
  readonly sourceComponentId: string;
  readonly scale: SimulationSweepScale;
  readonly points: number;
  readonly startHertz: number;
  readonly stopHertz: number;
  readonly magnitude?: number;
  readonly phaseDegrees?: number;
}

export interface TransientSimulationAnalysis {
  readonly type: SimulationAnalysisType.Transient;
  readonly stepSeconds: number;
  readonly stopSeconds: number;
  readonly startSeconds?: number;
  readonly maximumStepSeconds?: number;
  readonly useInitialConditions?: boolean;
}

export type SimulationAnalysis =
  | OperatingPointSimulationAnalysis
  | DcSweepSimulationAnalysis
  | AcSweepSimulationAnalysis
  | TransientSimulationAnalysis;

export interface NodeVoltageSimulationProbe {
  readonly kind: SimulationProbeKind.NodeVoltage;
  readonly componentId: string;
  readonly terminalId: string;
}

export interface ComponentCurrentSimulationProbe {
  readonly kind: SimulationProbeKind.ComponentCurrent;
  readonly componentId: string;
}

export type SimulationProbe =
  | NodeVoltageSimulationProbe
  | ComponentCurrentSimulationProbe;

export interface SimulationRequest {
  readonly preferredEngineId?: SimulationEngineId;
  readonly overrides?: SimulationOverrides;
  readonly analysis?: SimulationAnalysis;
  readonly probes?: readonly SimulationProbe[];
}

export interface SimulationCompatibilityBlocker {
  readonly componentId: string;
  readonly reason: string;
}

export interface SimulationCompatibility {
  readonly compatible: boolean;
  readonly blockers: readonly SimulationCompatibilityBlocker[];
}

export interface SimulationEngine {
  readonly id: SimulationEngineId;
  canSimulate(design: CircuitDesign): SimulationCompatibility;
  simulate(design: CircuitDesign, request: SimulationRequest): Promise<SimulationResult>;
}

export interface SimulationCompatibilityResolver {
  resolve(engine: SimulationEngine, design: CircuitDesign): SimulationCompatibility;
}

export class PermissiveSimulationCompatibilityResolver implements SimulationCompatibilityResolver {
  resolve(_engine: SimulationEngine, _design: CircuitDesign): SimulationCompatibility {
    return { compatible: true, blockers: [] };
  }
}
