import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { ComponentCapability } from "@/components/component-capability";
import {
  SimulationEngineId,
  type CircuitDesign,
  type SimulationResult
} from "@/domain/types";
import {
  ProbePilotToSpice,
  type SpiceConversionError
} from "@/tscircuit/probepilot-to-spice";
import { SpiceRuntime } from "@/tscircuit/spice-runtime";
import type { SpiceRuntimeEngine } from "@/tscircuit/spice-engine-payload";
import {
  SimulationDiagnosticCode,
  type SimulationCompatibility,
  type SimulationCompatibilityBlocker,
  type SimulationEngine,
  type SimulationRequest
} from "./simulation-engine";
import { SpiceResultMapper } from "./spice-result-mapper";

type SpiceEngineFailure = Error | object | string | number | boolean | bigint | symbol | null | undefined;
type SpiceEngineFactory = () => Promise<SpiceRuntimeEngine>;

export class TscircuitSpiceSimulationEngine implements SimulationEngine {
  readonly id = SimulationEngineId.Spice;

  constructor(
    private readonly createEngine: SpiceEngineFactory = SpiceRuntime.getNgspiceEngine()
  ) {}

  canSimulate(design: CircuitDesign): SimulationCompatibility {
    const blockers: SimulationCompatibilityBlocker[] = Object.values(design.components)
      .sort((left, right) => left.id.localeCompare(right.id))
      .flatMap((component) => {
        const definition = ComponentDefinitionRegistry.get(component.kind);
        if (!ComponentDefinitionRegistry.supports(component.kind, ComponentCapability.Spice)) {
          return [{
            componentId: component.id,
            reason: `${definition.name} has not passed the verified SPICE capability gate.`
          }];
        }
        return ProbePilotToSpice.supports(component.kind)
          ? []
          : [{
              componentId: component.id,
              reason: `${definition.name} has no verified SPICE mapping.`
            }];
      });
    return { compatible: blockers.length === 0, blockers };
  }

  async simulate(
    design: CircuitDesign,
    request: SimulationRequest = {}
  ): Promise<SimulationResult> {
    const conversion = ProbePilotToSpice.convert(design, request);
    if (!conversion.netlist || conversion.errors.length > 0) {
      return TscircuitSpiceSimulationEngine.conversionFailure(design, conversion.errors);
    }

    try {
      const engine = await this.createEngine();
      const payload = await engine.simulate(conversion.netlist);
      return SpiceResultMapper.map({
        design,
        request,
        terminalNodeNames: conversion.terminalNodeNames,
        componentElementNames: conversion.componentElementNames,
        payload
      });
    } catch (failure) {
      return TscircuitSpiceSimulationEngine.engineFailure(
        design,
        failure as SpiceEngineFailure
      );
    }
  }

  private static conversionFailure(
    design: CircuitDesign,
    errors: readonly SpiceConversionError[]
  ): SimulationResult {
    return {
      status: "fail",
      designRevision: design.revision,
      issues: errors.map((error) => ({
        code: error.code,
        severity: "error",
        message: error.message,
        affectedIds: TscircuitSpiceSimulationEngine.affectedIds(error)
      })),
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary: "SPICE conversion failed before engine execution.",
      engineId: SimulationEngineId.Spice
    };
  }

  private static affectedIds(error: SpiceConversionError): string[] {
    const ids = [
      ...(error.affectedComponentIds ?? []),
      error.componentId,
      error.wireId
    ].filter((id): id is string => Boolean(id));
    return ids.filter((id, index) => ids.indexOf(id) === index)
      .sort((left, right) => left.localeCompare(right));
  }

  private static engineFailure(
    design: CircuitDesign,
    failure: SpiceEngineFailure
  ): SimulationResult {
    return {
      status: "fail",
      designRevision: design.revision,
      issues: [{
        code: SimulationDiagnosticCode.EngineFailure,
        severity: "error",
        message: `SPICE simulation failed: ${TscircuitSpiceSimulationEngine.failureMessage(failure)}`,
        affectedIds: []
      }],
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary: "SPICE simulation could not be completed.",
      engineId: SimulationEngineId.Spice
    };
  }

  private static failureMessage(failure: SpiceEngineFailure): string {
    if (failure instanceof Error) return failure.message || failure.name;
    if (typeof failure === "string") return failure || "No error details were provided.";
    if (failure === null || typeof failure === "undefined") {
      return "No error details were provided.";
    }
    if (typeof failure === "object") return "The engine threw a non-Error object.";
    return String(failure);
  }
}
