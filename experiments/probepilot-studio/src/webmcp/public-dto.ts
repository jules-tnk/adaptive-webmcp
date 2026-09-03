import { ComponentCapability } from "@/components/component-capability";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { ComponentDefinition } from "@/components/component-definition";
import { SimulationRunStatus, type StudioState } from "@/state/store";
import { TscircuitAdapter } from "@/tscircuit/tscircuit-adapter";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";

export enum InspectScope { Summary = "summary", Design = "design", Simulation = "simulation", Bench = "bench" }

function capabilityLevels(definition: ComponentDefinition): Readonly<Record<ComponentCapability, boolean>> {
  return {
    [ComponentCapability.Design]: definition.capabilities.has(ComponentCapability.Design),
    [ComponentCapability.Spice]: definition.capabilities.has(ComponentCapability.Spice),
    [ComponentCapability.Bench]: definition.capabilities.has(ComponentCapability.Bench)
  };
}

export function buildPublicStudioDto(state: StudioState, scope: InspectScope) {
  const preview = PhysicalPreviewAdapter.summarize(state.design, state.physicalDesign);
  const simulationCompatibility = state.simulationCompatibility
    ? {
        compatible: state.simulationCompatibility.compatible,
        blockers: state.simulationCompatibility.blockers.map((blocker) => ({ ...blocker }))
      }
    : null;
  let availableAgentActions = [
    "studio_inspect",
    "design_build_circuit",
    "design_update_components",
    "design_remove_elements"
  ];
  if (state.bench) {
    availableAgentActions = [
      "studio_inspect",
      "bench_request_measurement",
      "bench_update_hypotheses",
      "bench_stage_repair",
      "bench_verify"
    ];
  } else if (
    state.simulationStatus !== SimulationRunStatus.Pending &&
    state.simulationStatus !== SimulationRunStatus.Superseded
  ) {
    availableAgentActions.push("design_validate_and_simulate");
  }

  const summary = {
    product: "ProbePilot Studio",
    mode: state.mode,
    project: { id: state.projectId, name: state.projectName },
    workspaceView: state.workspaceView,
    physicalPreview: {
      placementMode: state.physicalDesign.placementMode,
      board: state.physicalDesign.board,
      placements: state.physicalDesign.placements,
      pcbAvailable: preview.pcbAvailable,
      threeDAvailable: preview.threeDAvailable,
      warnings: [...preview.warnings],
      editableByAgent: false
    },
    designRevision: state.design.revision,
    simulationStatus: state.simulationStatus,
    requestedEngineId: state.requestedEngineId,
    requestedAnalysisType: state.requestedAnalysisType,
    executedEngineId: state.executedEngineId,
    simulationDurationMs: state.simulationDurationMs,
    simulationWarnings: [...state.simulationWarnings],
    simulationCompatibility,
    counts: {
      components: Object.keys(state.design.components).length,
      wires: Object.keys(state.design.wires).length,
      measurements: state.bench?.measurements.length ?? 0
    },
    availableAgentActions,
    humanOnlyActions: ["start_bench", "take_measurement", "approve_repair", "change_agent_protection"]
  };

  if (scope === InspectScope.Summary) return summary;

  const conversion = TscircuitAdapter.toCircuitJson(state.design);
  const design = {
    revision: state.design.revision,
    components: Object.values(state.design.components).map((component) => {
      const definition = ComponentDefinitionRegistry.get(component.kind);
      return {
        id: component.id,
        label: component.label,
        kind: component.kind,
        position: component.position,
        properties: component.properties,
        agentLocked: component.agentLocked,
        terminals: definition.terminals.map((terminal) => ({ id: terminal.id, label: terminal.label })),
        defaultFootprint: definition.defaultFootprint,
        capabilities: capabilityLevels(definition)
      };
    }),
    wires: Object.values(state.design.wires).map((wire) => ({ id: wire.id, a: wire.a, b: wire.b })),
    currentSimulationRevision: state.simulatedRevision,
    conversionDiagnostics: conversion.diagnostics
  };

  if (scope === InspectScope.Design) return { ...summary, design };
  if (scope === InspectScope.Simulation) return { ...summary, design, simulation: state.simulation };

  return {
    ...summary,
    design,
    simulation: state.simulation,
    bench: state.bench
      ? {
          id: state.bench.id,
          sourceDesignRevision: state.bench.sourceDesignRevision,
          status: state.bench.status,
          symptoms: state.bench.symptoms,
          measurements: state.bench.measurements,
          pendingMeasurement: state.bench.pendingMeasurement,
          hypotheses: state.bench.hypotheses,
          stagedRepair: state.bench.stagedRepair,
          verification: state.bench.verification,
          testPoints: Object.values(state.bench.sourceDesignSnapshot.components).flatMap((component) =>
            ComponentDefinitionRegistry.get(component.kind).terminals.map((terminal) => ({
              id: `${component.id}:${terminal.id}`,
              label: `${component.label} · ${terminal.label}`
            }))
          )
        }
      : null
  };
}
