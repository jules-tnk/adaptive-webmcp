import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { simulateDcCircuit } from "@/domain/simulation";
import {
  ComponentKind,
  type CircuitDesign,
  type ComponentKindValue,
  type SimulationResult
} from "@/domain/types";
import {
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationCompatibilityBlocker,
  type SimulationEngine,
  type SimulationRequest
} from "./simulation-engine";

const supportedKinds: ReadonlySet<ComponentKindValue> = new Set([
  ComponentKind.DcSource,
  ComponentKind.Ground,
  ComponentKind.Resistor,
  ComponentKind.Led,
  ComponentKind.Switch
]);

export class DeterministicSimulationEngine implements SimulationEngine {
  readonly id = SimulationEngineId.Deterministic;

  canSimulate(design: CircuitDesign): SimulationCompatibility {
    const blockers: SimulationCompatibilityBlocker[] = Object.values(design.components)
      .filter((component) => !supportedKinds.has(component.kind))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((component) => ({
        componentId: component.id,
        reason: `${ComponentDefinitionRegistry.get(component.kind).name} is not supported by deterministic simulation.`
      }));

    return { compatible: blockers.length === 0, blockers };
  }

  simulate(design: CircuitDesign, request: SimulationRequest): Promise<SimulationResult> {
    const result = simulateDcCircuit(design, request.overrides);
    return Promise.resolve(result);
  }
}
