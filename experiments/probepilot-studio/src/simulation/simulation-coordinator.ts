import type {
  CircuitDesign,
  SimulationResult
} from "@/domain/types";
import { DeterministicSimulationEngine } from "./deterministic-simulation-engine";
import {
  PermissiveSimulationCompatibilityResolver,
  SimulationDiagnosticCode,
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationCompatibilityBlocker,
  type SimulationCompatibilityResolver,
  type SimulationEngine,
  type SimulationRequest
} from "./simulation-engine";

const enginePriority: readonly SimulationEngineId[] = [
  SimulationEngineId.Deterministic,
  SimulationEngineId.Spice
];

type EngineFailureValue = Error | object | string | number | boolean | bigint | symbol | null | undefined;

export class SimulationCoordinator {
  private readonly engines: ReadonlyMap<SimulationEngineId, SimulationEngine>;

  constructor(
    engines: readonly SimulationEngine[] = [new DeterministicSimulationEngine()],
    private readonly compatibilityResolver: SimulationCompatibilityResolver = new PermissiveSimulationCompatibilityResolver()
  ) {
    this.engines = new Map(engines.map((engine) => [engine.id, engine]));
  }

  async simulate(design: CircuitDesign, request: SimulationRequest = {}): Promise<SimulationResult> {
    const selection = this.selectEngine(design, request.preferredEngineId);
    if (!selection.engine) {
      if (selection.unavailableMessage) {
        return this.engineUnavailableResult(design, selection.unavailableMessage);
      }
      return this.failureResult(
        design,
        selection.blockers,
        request.preferredEngineId
          ? `The preferred ${this.engineName(request.preferredEngineId)} engine cannot simulate this design.`
          : "No available simulation engine can simulate this design."
      );
    }

    const selectedEngine = selection.engine;
    return Promise.resolve()
      .then(() => selectedEngine.simulate(design, request))
      .then(
        (result) => ({ ...result, engineId: selectedEngine.id }),
        (failure: EngineFailureValue) => this.engineFailureResult(design, selectedEngine, failure)
      );
  }

  private selectEngine(
    design: CircuitDesign,
    preferredEngineId?: SimulationEngineId
  ): {
    engine?: SimulationEngine;
    blockers: readonly SimulationCompatibilityBlocker[];
    unavailableMessage?: string;
  } {
    if (preferredEngineId) {
      const preferred = this.engines.get(preferredEngineId);
      if (!preferred) {
        return {
          blockers: [],
          unavailableMessage: `${this.engineName(preferredEngineId)} simulation is not available.`
        };
      }

      const compatibility = this.effectiveCompatibility(preferred, design);
      return compatibility.compatible
        ? { engine: preferred, blockers: [] }
        : { blockers: compatibility.blockers };
    }

    if (this.engines.size === 0) {
      return {
        blockers: [],
        unavailableMessage: "No simulation engines are available."
      };
    }

    let bestRejectedCompatibility: SimulationCompatibility | undefined;
    for (const engineId of enginePriority) {
      const engine = this.engines.get(engineId);
      if (!engine) continue;
      const compatibility = this.effectiveCompatibility(engine, design);
      if (compatibility.compatible) return { engine, blockers: [] };
      bestRejectedCompatibility = this.preferMoreActionable(
        bestRejectedCompatibility,
        compatibility
      );
    }

    return { blockers: bestRejectedCompatibility?.blockers ?? [] };
  }

  private preferMoreActionable(
    current: SimulationCompatibility | undefined,
    candidate: SimulationCompatibility
  ): SimulationCompatibility {
    if (!current || candidate.blockers.length < current.blockers.length) return candidate;
    return current;
  }

  private effectiveCompatibility(
    engine: SimulationEngine,
    design: CircuitDesign
  ): SimulationCompatibility {
    const intrinsic = engine.canSimulate(design);
    const policy = this.compatibilityResolver.resolve(engine, design);
    const blockers = [...intrinsic.blockers, ...policy.blockers].filter(
      (blocker, index, allBlockers) => allBlockers.findIndex((candidate) =>
        candidate.componentId === blocker.componentId && candidate.reason === blocker.reason
      ) === index
    );
    return {
      compatible: intrinsic.compatible && policy.compatible,
      blockers
    };
  }

  private failureResult(
    design: CircuitDesign,
    blockers: readonly SimulationCompatibilityBlocker[],
    summary: string
  ): SimulationResult {
    const sortedBlockers = [...blockers].sort((left, right) =>
      left.componentId.localeCompare(right.componentId)
    );
    return {
      status: "fail",
      designRevision: design.revision,
      issues: sortedBlockers.map((blocker) => ({
        code: SimulationDiagnosticCode.UnsupportedComponent,
        severity: "error",
        message: blocker.reason,
        affectedIds: [blocker.componentId]
      })),
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary
    };
  }

  private engineFailureResult(
    design: CircuitDesign,
    engine: SimulationEngine,
    failure: EngineFailureValue
  ): SimulationResult {
    return {
      status: "fail",
      designRevision: design.revision,
      issues: [{
        code: SimulationDiagnosticCode.EngineFailure,
        severity: "error",
        message: `${this.engineName(engine.id)} simulation failed: ${this.failureMessage(failure)}`,
        affectedIds: []
      }],
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary: `${this.engineName(engine.id)} simulation could not be completed.`,
      engineId: engine.id
    };
  }

  private engineUnavailableResult(design: CircuitDesign, message: string): SimulationResult {
    return {
      status: "fail",
      designRevision: design.revision,
      issues: [{
        code: SimulationDiagnosticCode.EngineUnavailable,
        severity: "error",
        message,
        affectedIds: []
      }],
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary: message
    };
  }

  private failureMessage(failure: EngineFailureValue): string {
    if (failure instanceof Error) return failure.message || failure.name;
    if (typeof failure === "string") return failure || "No error details were provided.";
    if (failure === null || typeof failure === "undefined") {
      return "No error details were provided.";
    }
    if (typeof failure === "object") return "The engine threw a non-Error object.";
    return String(failure);
  }

  private engineName(engineId: SimulationEngineId): string {
    return engineId === SimulationEngineId.Spice ? "SPICE" : "Deterministic";
  }
}
