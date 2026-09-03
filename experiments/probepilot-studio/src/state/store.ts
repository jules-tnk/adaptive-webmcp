import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { ActivityLog } from "@/activity/activity-log";
import { ComponentCapability } from "@/components/component-capability";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { createComponent, componentCatalog, mergeComponentProperties, parseTestPointId, terminalExists, testPointId, type ComponentPropertyPatch } from "@/domain/catalog";
import { cloneBench, cloneDesign } from "@/domain/clone";
import { createBlankDesign, createDemoDesign } from "@/domain/fixtures";
import { PrivateBenchEngine } from "@/domain/bench";
import { canConnect } from "@/domain/validation";
import type { ProjectRecord } from "@/projects/project-types";
import { PhysicalLayout } from "@/physical/physical-layout";
import { WorkspaceView, type PhysicalDesign } from "@/physical/physical-design";
import { DeterministicSimulationEngine } from "@/simulation/deterministic-simulation-engine";
import { SimulationCoordinator } from "@/simulation/simulation-coordinator";
import {
  SimulationDiagnosticCode,
  SimulationAnalysisType,
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationCompatibilityBlocker,
  type SimulationRequest
} from "@/simulation/simulation-engine";
import { TscircuitSpiceSimulationEngine } from "@/simulation/tscircuit-spice-simulation-engine";
import type {
  Actor,
  ActivityEvent,
  CircuitComponent,
  CircuitDesign,
  CircuitWire,
  CommandContext,
  CommandError,
  CommandResult,
  ComponentKindValue,
  ComponentProperties,
  DiagnosticHypothesis,
  Measurement,
  MeasurementMode,
  Point,
  PublicBenchSession,
  RepairAction,
  RepairTarget,
  SimulationResult,
  StagedRepair,
  StudioMode,
  TerminalRef,
  VerificationResult
} from "@/domain/types";
import { SimulationCommandErrorCode } from "@/domain/types";

export type Selection = { type: "component" | "wire"; id: string } | null;
export type HistoryEntry = { label: string; actor: Actor; before: CircuitDesign; after: CircuitDesign };

export enum SimulationRunStatus {
  Idle = "idle",
  Pending = "pending",
  Superseded = "superseded",
  Success = "success",
  Failure = "failure"
}

export type BuildCircuitInput = {
  expectedRevision: number;
  components: Array<{
    key: string;
    kind: ComponentKindValue;
    label?: string;
    properties?: Partial<ComponentProperties>;
    placement: { type: "auto"; order: number } | { type: "absolute"; x: number; y: number };
  }>;
  connections: Array<{
    from: { component: string; terminal: string };
    to: { component: string; terminal: string };
  }>;
};

export type StudioState = {
  projectId: string;
  projectName: string;
  mode: StudioMode;
  design: CircuitDesign;
  simulation: SimulationResult | null;
  simulatedRevision: number | null;
  simulationStatus: SimulationRunStatus;
  activeSimulationRunId: number | null;
  requestedEngineId: SimulationEngineId | null;
  requestedAnalysisType: SimulationAnalysisType | null;
  executedEngineId: SimulationEngineId | null;
  simulationDurationMs: number | null;
  simulationWarnings: string[];
  simulationCompatibility: SimulationCompatibility | null;
  bench: PublicBenchSession | null;
  activities: ActivityEvent[];
  selection: Selection;
  wireDraft: TerminalRef | null;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  webmcpAvailable: boolean;
  zoom: number;
  physicalDesign: PhysicalDesign;
  workspaceView: WorkspaceView;

  setWebmcpAvailable(value: boolean): void;
  setMode(mode: Exclude<StudioMode, "bench">): CommandResult;
  setSelection(selection: Selection): void;
  setWireDraft(value: TerminalRef | null): void;
  setZoom(value: number): void;
  renameProject(name: string): void;
  setWorkspaceView(view: WorkspaceView): void;
  updatePhysicalDesign(value: PhysicalDesign): void;
  resetPhysicalLayout(): void;

  addComponent(kind: ComponentKindValue, position: Point, context: CommandContext): CommandResult<CircuitComponent>;
  buildCircuit(input: BuildCircuitInput, context: CommandContext): CommandResult<{ componentIds: Record<string, string>; wireIds: string[] }>;
  connectTerminals(a: TerminalRef, b: TerminalRef, context: CommandContext): CommandResult<CircuitWire>;
  updateComponent(componentId: string, patch: { label?: string; position?: Point; properties?: ComponentPropertyPatch; agentLocked?: boolean }, context: CommandContext): CommandResult<CircuitComponent>;
  removeElements(componentIds: string[], wireIds: string[], context: CommandContext): CommandResult<{ componentIds: string[]; wireIds: string[] }>;
  runSimulation(context: CommandContext, request?: SimulationRequest): Promise<CommandResult<SimulationResult>>;

  startBench(context: CommandContext): CommandResult<PublicBenchSession>;
  discardBench(context: CommandContext): CommandResult;
  requestMeasurement(input: { mode: MeasurementMode; firstTestPointId: string; secondTestPointId: string; purpose: string }, context: CommandContext): CommandResult;
  completeMeasurement(input: { firstTestPointId: string; secondTestPointId: string }, context: CommandContext): CommandResult<Measurement>;
  updateHypotheses(hypotheses: DiagnosticHypothesis[], context: CommandContext): CommandResult<DiagnosticHypothesis[]>;
  stageRepair(input: { target: RepairTarget; action: RepairAction; evidenceIds: string[]; expectedOutcome: string }, context: CommandContext): CommandResult<StagedRepair>;
  approveRepair(context: CommandContext): CommandResult;
  rejectRepair(context: CommandContext): CommandResult;
  verifyBench(context: CommandContext): CommandResult<VerificationResult>;

  undo(): CommandResult;
  redo(): CommandResult;
  resetDemo(): void;
  createDemoProject(): void;
  newBlankProject(): void;
  loadProject(record: ProjectRecord): void;
};

type EmptySimulationRunState = Pick<
  StudioState,
  | "simulation"
  | "simulatedRevision"
  | "simulationStatus"
  | "activeSimulationRunId"
  | "requestedEngineId"
  | "requestedAnalysisType"
  | "executedEngineId"
  | "simulationDurationMs"
  | "simulationWarnings"
  | "simulationCompatibility"
>;

function emptySimulationRunState(): EmptySimulationRunState {
  return {
    simulation: null,
    simulatedRevision: null,
    simulationStatus: SimulationRunStatus.Idle,
    activeSimulationRunId: null,
    requestedEngineId: null,
    requestedAnalysisType: null,
    executedEngineId: null,
    simulationDurationMs: null,
    simulationWarnings: [],
    simulationCompatibility: null
  };
}

function invalidatedSimulationRunState(state: StudioState): EmptySimulationRunState {
  if (
    state.activeSimulationRunId !== null &&
    (state.simulationStatus === SimulationRunStatus.Pending ||
      state.simulationStatus === SimulationRunStatus.Superseded)
  ) {
    return {
      ...emptySimulationRunState(),
      simulationStatus: SimulationRunStatus.Superseded,
      activeSimulationRunId: state.activeSimulationRunId,
      requestedEngineId: state.requestedEngineId,
      requestedAnalysisType: state.requestedAnalysisType
    };
  }
  return emptySimulationRunState();
}

function compatibilityFromResult(result: SimulationResult): SimulationCompatibility {
  const blockers: SimulationCompatibilityBlocker[] = result.issues.flatMap((issue) =>
    issue.code === SimulationDiagnosticCode.UnsupportedComponent
      ? issue.affectedIds.map((componentId) => ({ componentId, reason: issue.message }))
      : []
  );
  const engineUnavailable = result.issues.some((issue) =>
    issue.code === SimulationDiagnosticCode.EngineUnavailable
  );
  return {
    compatible: blockers.length === 0 && !engineUnavailable,
    blockers
  };
}

function coordinationFailureResult(design: CircuitDesign): SimulationResult {
  const summary = "Simulation coordination failed before an engine result was returned.";
  return {
    status: "fail",
    designRevision: design.revision,
    issues: [{
      code: SimulationDiagnosticCode.EngineFailure,
      severity: "error",
      message: summary,
      affectedIds: []
    }],
    nodeVoltages: {},
    branchCurrents: {},
    components: {},
    observableOutputs: [],
    summary
  };
}

function attributionFailureResult(design: CircuitDesign): SimulationResult {
  const summary = "Simulation result did not include authoritative engine attribution.";
  return {
    status: "fail",
    designRevision: design.revision,
    issues: [{
      code: SimulationDiagnosticCode.EngineFailure,
      severity: "error",
      message: summary,
      affectedIds: []
    }],
    nodeVoltages: {},
    branchCurrents: {},
    components: {},
    observableOutputs: [],
    summary
  };
}

function defaultSimulationCoordinator(): SimulationCoordinator {
  return new SimulationCoordinator([
    new DeterministicSimulationEngine(),
    new TscircuitSpiceSimulationEngine()
  ]);
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function activity(actor: Actor, action: ActivityEvent["action"], summary: string, affectedIds: string[] = []): ActivityEvent {
  return { id: uid("activity"), actor, action, summary, affectedIds, createdAt: new Date().toISOString() };
}

function success<T>(revision: number, value: T, changedIds: string[] = [], warnings: string[] = []): CommandResult<T> {
  return { ok: true, revision, value, changedIds, warnings };
}

function failure(revision: number, error: CommandError): CommandResult<never> {
  return { ok: false, revision, error };
}

function actorLabel(actor: Actor): string {
  return actor === "agent" ? "Agent" : actor === "human" ? "Human" : "System";
}

function updateProperties(component: CircuitComponent, patch?: ComponentPropertyPatch): ComponentProperties {
  return mergeComponentProperties(component.kind, component.properties, patch);
}

function validateExpectedRevision(state: StudioState, context: CommandContext): CommandResult<never> | null {
  if (context.expectedRevision !== undefined && context.expectedRevision !== state.design.revision) {
    return failure(state.design.revision, {
      code: "REVISION_CONFLICT",
      message: "The design changed after the agent inspected it.",
      recovery: "Inspect the studio again before applying changes.",
      currentRevision: state.design.revision
    });
  }
  return null;
}

function assertHuman(state: StudioState, context: CommandContext, operation: string): CommandResult<never> | null {
  return context.actor === "human"
    ? null
    : failure(state.design.revision, {
        code: "HUMAN_ACTION_REQUIRED",
        message: `${operation} is a human-only action.`,
        recovery: "Ask the human to complete this action in the visual interface."
      });
}

export function createStudioStore(
  initialDesign: CircuitDesign = createDemoDesign(),
  simulationCoordinator: SimulationCoordinator = defaultSimulationCoordinator()
): StoreApi<StudioState> {
  const benchEngine = new PrivateBenchEngine();
  let latestSimulationRunId = 0;

  return createStore<StudioState>((set, get) => {
    const reject = (result: CommandResult<never>, actor: Actor): CommandResult<never> => {
      if (!result.ok) set((state) => ({ activities: ActivityLog.prepend(state.activities, activity(actor, "action_rejected", result.error.message)) }));
      return result;
    };

    const commitDesign = (
      next: CircuitDesign,
      label: string,
      context: CommandContext,
      action: ActivityEvent["action"],
      affectedIds: string[]
    ): void => {
      const state = get();
      const before = cloneDesign(state.design);
      next.revision = state.design.revision + 1;
      set({
        design: next,
        ...invalidatedSimulationRunState(state),
        mode: "design",
        historyPast: [...state.historyPast, { label, actor: context.actor, before, after: cloneDesign(next) }].slice(-50),
        historyFuture: [],
        physicalDesign: PhysicalLayout.reconcile(next, state.physicalDesign),
        activities: ActivityLog.prepend(state.activities, activity(context.actor, action, context.activityLabel ?? label, affectedIds))
      });
    };

    return {
      projectId: initialDesign.id,
      projectName: initialDesign.name,
      mode: "design",
      design: cloneDesign(initialDesign),
      ...emptySimulationRunState(),
      bench: null,
      activities: [activity("system", "project_reset", "Loaded the ProbePilot demo circuit.")],
      selection: null,
      wireDraft: null,
      historyPast: [],
      historyFuture: [],
      webmcpAvailable: false,
      zoom: 1,
      physicalDesign: PhysicalLayout.generate(initialDesign),
      workspaceView: WorkspaceView.Circuit,

      setWebmcpAvailable: (value) => set({ webmcpAvailable: value }),
      setMode: (mode) => {
        const state = get();
        if (state.bench) {
          return reject(failure(state.design.revision, {
            code: "INVALID_MODE",
            message: "Discard the active bench before returning to the design."
          }), "human");
        }
        set({ mode });
        return success(state.design.revision, undefined);
      },
      setSelection: (selection) => set({ selection }),
      setWireDraft: (wireDraft) => set({ wireDraft }),
      setZoom: (zoom) => set({ zoom: Math.min(1.5, Math.max(0.6, zoom)) }),
      renameProject: (name) => set((state) => {
        const projectName = name.trim() || "Untitled circuit";
        return { projectName, design: { ...state.design, name: projectName } };
      }),
      setWorkspaceView: (workspaceView) => set({ workspaceView }),
      updatePhysicalDesign: (physicalDesign) => set({ physicalDesign }),
      resetPhysicalLayout: () => set((state) => ({ physicalDesign: PhysicalLayout.generate(state.design) })),

      addComponent: (kind, position, context) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, context);
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "The bench is read-only." }), context.actor);
        const id = uid(componentCatalog[kind].prefix.toLowerCase());
        const next = cloneDesign(state.design);
        const component = createComponent(kind, id, position, context.actor, next.components);
        next.components[id] = component;
        commitDesign(next, `${actorLabel(context.actor)} added ${component.label}.`, context, "component_added", [id]);
        return success(next.revision, component, [id]);
      },

      buildCircuit: (input, context) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, { ...context, expectedRevision: input.expectedRevision });
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "The bench is read-only." }), context.actor);
        if (input.components.length > 20 || input.connections.length > 30) {
          return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "A single build can add at most 20 components and 30 wires." }), context.actor);
        }
        const keys = new Set<string>();
        for (const item of input.components) {
          if (keys.has(item.key)) return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: `Duplicate component key: ${item.key}` }), context.actor);
          keys.add(item.key);
        }
        const next = cloneDesign(state.design);
        const generated: Record<string, string> = {};
        const componentIds: string[] = [];
        const sorted = [...input.components].sort((a, b) => (a.placement.type === "auto" ? a.placement.order : 0) - (b.placement.type === "auto" ? b.placement.order : 0));
        sorted.forEach((item, index) => {
          const id = uid(componentCatalog[item.kind].prefix.toLowerCase());
          const position = item.placement.type === "absolute"
            ? { x: item.placement.x, y: item.placement.y }
            : { x: 90 + index * 185, y: index % 2 === 0 ? 170 : 310 };
          next.components[id] = createComponent(item.kind, id, position, context.actor, next.components, item.properties, item.label);
          generated[item.key] = id;
          componentIds.push(id);
        });
        const wireIds: string[] = [];
        for (const connection of input.connections) {
          const a = { componentId: generated[connection.from.component] ?? connection.from.component, terminalId: connection.from.terminal };
          const b = { componentId: generated[connection.to.component] ?? connection.to.component, terminalId: connection.to.terminal };
          const validation = canConnect(next, a, b);
          if (!validation.ok) return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: validation.message }), context.actor);
          if (context.actor === "agent" && (next.components[a.componentId]?.agentLocked || next.components[b.componentId]?.agentLocked)) {
            return reject(failure(state.design.revision, { code: "AGENT_LOCKED", message: "One of these components is protected from agent changes." }), context.actor);
          }
          const id = uid("w");
          next.wires[id] = { id, a, b, createdBy: context.actor };
          wireIds.push(id);
        }
        const changedIds = [...componentIds, ...wireIds];
        commitDesign(next, `${actorLabel(context.actor)} built a ${componentIds.length}-component circuit.`, context, "component_added", changedIds);
        return success(next.revision, { componentIds: generated, wireIds }, changedIds);
      },

      connectTerminals: (a, b, context) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, context);
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "The bench is read-only." }), context.actor);
        const validation = canConnect(state.design, a, b);
        if (!validation.ok) return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: validation.message }), context.actor);
        if (context.actor === "agent" && (state.design.components[a.componentId]?.agentLocked || state.design.components[b.componentId]?.agentLocked)) {
          return reject(failure(state.design.revision, { code: "AGENT_LOCKED", message: "One of these components is protected from agent changes." }), context.actor);
        }
        const next = cloneDesign(state.design);
        const id = uid("w");
        const wire = { id, a, b, createdBy: context.actor } satisfies CircuitWire;
        next.wires[id] = wire;
        commitDesign(next, `${actorLabel(context.actor)} connected ${a.componentId} to ${b.componentId}.`, context, "wire_added", [id, a.componentId, b.componentId]);
        return success(next.revision, wire, [id]);
      },

      updateComponent: (componentId, patch, context) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, context);
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "The bench is read-only." }), context.actor);
        const component = state.design.components[componentId];
        if (!component) return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: `Component ${componentId} does not exist.` }), context.actor);
        if (context.actor === "agent" && component.agentLocked) {
          return reject(failure(state.design.revision, { code: "AGENT_LOCKED", message: `${component.label} is protected from agent changes.` }), context.actor);
        }
        if (context.actor === "agent" && patch.agentLocked !== undefined) {
          return reject(failure(state.design.revision, { code: "HUMAN_ACTION_REQUIRED", message: "Only the human can change agent protection." }), context.actor);
        }
        const next = cloneDesign(state.design);
        let properties: ComponentProperties;
        try {
          properties = updateProperties(next.components[componentId]!, patch.properties);
        } catch (error) {
          return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: error instanceof Error ? error.message : "Invalid component properties." }), context.actor);
        }
        const updated: CircuitComponent = {
          ...next.components[componentId]!,
          label: patch.label?.trim() || next.components[componentId]!.label,
          position: patch.position ?? next.components[componentId]!.position,
          properties,
          agentLocked: patch.agentLocked ?? next.components[componentId]!.agentLocked,
          lastModifiedBy: context.actor
        };
        next.components[componentId] = updated;
        commitDesign(next, `${actorLabel(context.actor)} updated ${updated.label}.`, context, "component_updated", [componentId]);
        return success(next.revision, updated, [componentId]);
      },

      removeElements: (componentIds, wireIds, context) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, context);
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "The bench is read-only." }), context.actor);
        const selectedComponents = componentIds.map((id) => state.design.components[id]).filter(Boolean) as CircuitComponent[];
        if (context.actor === "agent" && selectedComponents.some((component) => component.agentLocked)) {
          return reject(failure(state.design.revision, { code: "AGENT_LOCKED", message: "A selected component is protected from agent changes." }), context.actor);
        }
        const removedWireIds = new Set(wireIds);
        for (const wire of Object.values(state.design.wires)) {
          if (componentIds.includes(wire.a.componentId) || componentIds.includes(wire.b.componentId)) removedWireIds.add(wire.id);
        }
        const connectedProtectedWire = [...removedWireIds].some((wireId) => {
          const wire = state.design.wires[wireId];
          return wire && context.actor === "agent" && (state.design.components[wire.a.componentId]?.agentLocked || state.design.components[wire.b.componentId]?.agentLocked);
        });
        if (connectedProtectedWire) return reject(failure(state.design.revision, { code: "AGENT_LOCKED", message: "A removed wire touches a protected component." }), context.actor);
        const next = cloneDesign(state.design);
        for (const componentId of componentIds) {
          delete next.components[componentId];
        }
        for (const wireId of removedWireIds) delete next.wires[wireId];
        const changedIds = [...componentIds, ...removedWireIds];
        commitDesign(next, `${actorLabel(context.actor)} removed ${changedIds.length} circuit element${changedIds.length === 1 ? "" : "s"}.`, context, componentIds.length > 0 ? "component_removed" : "wire_removed", changedIds);
        set({ selection: null });
        return success(next.revision, { componentIds, wireIds: [...removedWireIds] }, changedIds);
      },

      runSimulation: async (context, request = {}) => {
        const state = get();
        const revisionError = validateExpectedRevision(state, context);
        if (revisionError) return reject(revisionError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "Verify the bench instead of simulating the editable design." }), context.actor);
        if (state.simulationStatus === SimulationRunStatus.Pending) {
          return reject(failure(state.design.revision, {
            code: "INVALID_MODE",
            message: "A simulation is already running."
          }), context.actor);
        }
        if (
          state.simulationStatus === SimulationRunStatus.Superseded ||
          state.activeSimulationRunId !== null
        ) {
          return reject(failure(state.design.revision, {
            code: "INVALID_MODE",
            message: "A superseded simulation is still finishing."
          }), context.actor);
        }

        const designSnapshot = cloneDesign(state.design);
        const runId = ++latestSimulationRunId;
        const startedAt = Date.now();
        set({
          simulation: null,
          simulatedRevision: null,
          simulationStatus: SimulationRunStatus.Pending,
          activeSimulationRunId: runId,
          requestedEngineId: request.preferredEngineId ?? null,
          requestedAnalysisType: request.analysis?.type ?? SimulationAnalysisType.OperatingPoint,
          executedEngineId: null,
          simulationDurationMs: null,
          simulationWarnings: [],
          simulationCompatibility: null,
          mode: "simulate",
          workspaceView: WorkspaceView.Circuit
        });

        let result = coordinationFailureResult(designSnapshot);
        let coordinatorReturnedResult = false;
        let completion: CommandResult<SimulationResult> = success(
          designSnapshot.revision,
          result
        );
        try {
          result = await simulationCoordinator.simulate(designSnapshot, request);
          coordinatorReturnedResult = true;
        } catch {
          result = coordinationFailureResult(designSnapshot);
        } finally {
          const completedState = get();
          if (
            completedState.simulationStatus === SimulationRunStatus.Superseded ||
            completedState.activeSimulationRunId !== runId ||
            completedState.design.revision !== designSnapshot.revision
          ) {
            if (completedState.activeSimulationRunId === runId) {
              set(emptySimulationRunState());
            }
            completion = failure(completedState.design.revision, {
              code: SimulationCommandErrorCode.Superseded,
              message: "The simulation result was superseded by a newer workspace state.",
              recovery: "Wait for the superseded run to finish, then simulate the current design.",
              currentRevision: completedState.design.revision
            });
          } else {
            let compatibility = coordinatorReturnedResult
              ? compatibilityFromResult(result)
              : null;
            if (coordinatorReturnedResult && compatibility?.compatible && !result.engineId) {
              result = attributionFailureResult(designSnapshot);
              compatibility = null;
            }
            const warnings = result.issues
              .filter((issue) => issue.severity === "warning")
              .map((issue) => issue.message);
            const executedEngineId = coordinatorReturnedResult
              ? result.engineId ?? null
              : null;
            set({
              simulation: result,
              simulatedRevision: designSnapshot.revision,
              simulationStatus: result.status === "fail"
                ? SimulationRunStatus.Failure
                : SimulationRunStatus.Success,
              activeSimulationRunId: null,
              executedEngineId,
              simulationDurationMs: Math.max(0, Date.now() - startedAt),
              simulationWarnings: warnings,
              simulationCompatibility: compatibility,
              activities: ActivityLog.prepend(
                completedState.activities,
                activity(
                  context.actor,
                  "simulation_run",
                  `${actorLabel(context.actor)} ran the design simulation: ${result.status.toUpperCase()}.`,
                  Object.keys(result.components)
                )
              )
            });
            completion = success(designSnapshot.revision, result, [], warnings);
          }
        }
        return completion;
      },

      startBench: (context) => {
        const state = get();
        const humanError = assertHuman(state, context, "Creating a virtual bench");
        if (humanError) return reject(humanError, context.actor);
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "A bench session is already active." }), context.actor);
        const unsupportedBenchComponents = Object.values(state.design.components).filter((component) =>
          !ComponentDefinitionRegistry.supports(component.kind, ComponentCapability.Bench)
        );
        if (unsupportedBenchComponents.length > 0) {
          const names = unsupportedBenchComponents.map((component) => ComponentDefinitionRegistry.get(component.kind).name);
          return reject(failure(state.design.revision, {
            code: "VALIDATION_FAILED",
            message: `Bench is unavailable because ${names.join(", ")} ${names.length === 1 ? "is" : "are"} not Bench-capable.`,
            recovery: "Remove unsupported components or use the original five-component demo."
          }), context.actor);
        }
        if (
          state.simulationStatus !== SimulationRunStatus.Success ||
          !state.simulation ||
          state.simulatedRevision !== state.design.revision ||
          state.executedEngineId !== SimulationEngineId.Deterministic ||
          state.simulation.status === "fail"
        ) {
          return reject(failure(state.design.revision, {
            code: "SIMULATION_REQUIRED",
            message: "Run a passing deterministic simulation for the current design before creating a bench."
          }), context.actor);
        }
        const fixedFault = state.design.wires.w3 ? { type: "open_wire" as const, wireId: "w3" } : undefined;
        const bench = benchEngine.createSession(state.design, fixedFault);
        set({
          bench,
          mode: "bench",
          workspaceView: WorkspaceView.Circuit,
          selection: null,
          activities: ActivityLog.prepend(state.activities, activity("human", "bench_started", "Human built the intended design on the virtual bench. The bench output does not match the design.", bench.symptoms.flatMap((item) => item.affectedComponentIds)))
        });
        return success(state.design.revision, cloneBench(bench));
      },

      discardBench: (context) => {
        const state = get();
        const humanError = assertHuman(state, context, "Discarding a virtual bench");
        if (humanError) return reject(humanError, context.actor);
        if (state.bench) benchEngine.forget(state.bench.id);
        set({ bench: null, mode: "design", selection: null });
        return success(state.design.revision, undefined);
      },

      requestMeasurement: (input, context) => {
        const state = get();
        if (context.actor !== "agent") return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "Measurement requests must come from the diagnostic agent." }), context.actor);
        if (!state.bench) return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "Create a virtual bench before requesting a measurement." }), context.actor);
        if (state.bench.pendingMeasurement) return reject(failure(state.design.revision, { code: "MEASUREMENT_PENDING", message: "The human has not completed the current measurement request." }), context.actor);
        for (const point of [input.firstTestPointId, input.secondTestPointId]) {
          const parsed = parseTestPointId(point);
          const component = parsed ? state.bench.sourceDesignSnapshot.components[parsed.componentId] : undefined;
          if (!parsed || !component || !terminalExists(component, parsed.terminalId)) {
            return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: `Invalid test point: ${point}` }), context.actor);
          }
        }
        const request = {
          id: uid("request"),
          mode: input.mode,
          firstTestPointId: input.firstTestPointId,
          secondTestPointId: input.secondTestPointId,
          purpose: input.purpose.slice(0, 240),
          requestedBy: "agent" as const,
          status: "awaiting_human" as const
        };
        const bench = cloneBench(state.bench);
        bench.pendingMeasurement = request;
        bench.status = "measurement_requested";
        set({
          bench,
          activities: ActivityLog.prepend(state.activities, activity("agent", "measurement_requested", `Agent requested ${input.mode === "dc_voltage" ? "a voltage" : "a continuity"} measurement: ${request.purpose}`, [input.firstTestPointId, input.secondTestPointId]))
        });
        return success(state.design.revision, undefined, [request.id]);
      },

      completeMeasurement: (input, context) => {
        const state = get();
        const humanError = assertHuman(state, context, "Taking a measurement");
        if (humanError) return reject(humanError, context.actor);
        if (!state.bench || !state.bench.pendingMeasurement) {
          return reject(failure(state.design.revision, { code: "MEASUREMENT_PENDING", message: "There is no pending measurement request." }), context.actor);
        }
        const request = state.bench.pendingMeasurement;
        const result = benchEngine.measure(state.bench.id, request.mode, input.firstTestPointId, input.secondTestPointId);
        const measurement: Measurement = {
          id: uid("M"),
          requestId: request.id,
          mode: request.mode,
          firstTestPointId: input.firstTestPointId,
          secondTestPointId: input.secondTestPointId,
          value: result.value,
          unit: result.unit,
          purpose: request.purpose,
          requestedBy: "agent",
          performedBy: "human",
          createdAt: new Date().toISOString()
        };
        const bench = cloneBench(state.bench);
        bench.pendingMeasurement = null;
        bench.measurements.push(measurement);
        bench.status = "active";
        set({
          bench,
          activities: ActivityLog.prepend(state.activities, activity("human", "measurement_completed", `Human recorded ${measurement.unit === "V" ? `${measurement.value.toFixed(2)} V` : measurement.unit} between ${measurement.firstTestPointId} and ${measurement.secondTestPointId}.`, [measurement.id, measurement.firstTestPointId, measurement.secondTestPointId]))
        });
        return success(state.design.revision, measurement, [measurement.id]);
      },

      updateHypotheses: (hypotheses, context) => {
        const state = get();
        if (context.actor !== "agent") return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "Diagnostic hypotheses must come from the agent." }), context.actor);
        if (!state.bench) return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "No bench session is active." }), context.actor);
        const evidence = new Set(state.bench.measurements.map((measurement) => measurement.id));
        for (const hypothesis of hypotheses) {
          const targetExists = hypothesis.targetType === "component"
            ? Boolean(state.bench.sourceDesignSnapshot.components[hypothesis.targetId])
            : Boolean(state.bench.sourceDesignSnapshot.wires[hypothesis.targetId]);
          if (!targetExists || hypothesis.confidence < 0 || hypothesis.confidence > 1 || hypothesis.evidenceIds.some((id) => !evidence.has(id))) {
            return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "A hypothesis contains an invalid target, confidence, or evidence reference." }), context.actor);
          }
        }
        const bench = cloneBench(state.bench);
        bench.hypotheses = hypotheses.map((hypothesis) => ({ ...hypothesis, explanation: hypothesis.explanation.slice(0, 280) }));
        set({ bench, activities: ActivityLog.prepend(state.activities, activity("agent", "hypotheses_updated", `Agent updated ${hypotheses.length} diagnostic hypothesis${hypotheses.length === 1 ? "" : "es"}.`, hypotheses.map((item) => item.targetId))) });
        return success(state.design.revision, bench.hypotheses);
      },

      stageRepair: (input, context) => {
        const state = get();
        if (context.actor !== "agent") return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "Repair proposals must be staged by the agent." }), context.actor);
        if (!state.bench) return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "No bench session is active." }), context.actor);
        if (state.bench.measurements.length < 2) {
          return reject(failure(state.design.revision, {
            code: "INSUFFICIENT_EVIDENCE",
            message: "At least two human-performed measurements are required before staging a repair.",
            recovery: "Request another measurement from the human."
          }), context.actor);
        }
        const evidence = new Set(state.bench.measurements.map((measurement) => measurement.id));
        if (new Set(input.evidenceIds).size < 2 || input.evidenceIds.some((id) => !evidence.has(id))) {
          return reject(failure(state.design.revision, { code: "INSUFFICIENT_EVIDENCE", message: "The repair must cite at least two completed measurement IDs." }), context.actor);
        }
        const targetExists = input.target.type === "component"
          ? Boolean(state.bench.sourceDesignSnapshot.components[input.target.componentId])
          : Boolean(state.bench.sourceDesignSnapshot.wires[input.target.wireId]);
        if (!targetExists) return reject(failure(state.design.revision, { code: "INVALID_INPUT", message: "The repair target does not exist on this bench." }), context.actor);
        const repair: StagedRepair = {
          id: uid("repair"),
          target: input.target,
          action: input.action,
          evidenceIds: input.evidenceIds,
          expectedOutcome: input.expectedOutcome.slice(0, 280),
          stagedBy: "agent",
          status: "awaiting_human"
        };
        const bench = cloneBench(state.bench);
        bench.stagedRepair = repair;
        bench.status = "repair_staged";
        set({ bench, activities: ActivityLog.prepend(state.activities, activity("agent", "repair_staged", `Agent staged ${input.action.replaceAll("_", " ")} for human review.`, [repair.id, input.target.type === "component" ? input.target.componentId : input.target.wireId])) });
        return success(state.design.revision, repair, [repair.id]);
      },

      approveRepair: (context) => {
        const state = get();
        const humanError = assertHuman(state, context, "Applying a repair");
        if (humanError) return reject(humanError, context.actor);
        if (!state.bench?.stagedRepair) return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "There is no staged repair to approve." }), context.actor);
        benchEngine.applyRepair(state.bench.id, state.bench.stagedRepair);
        const bench = cloneBench(state.bench);
        bench.stagedRepair = { ...bench.stagedRepair!, status: "approved" };
        bench.status = "repair_applied";
        set({ bench, activities: ActivityLog.prepend(state.activities, activity("human", "repair_approved", "Human approved and applied the staged repair.", [bench.stagedRepair.id])) });
        return success(state.design.revision, undefined);
      },

      rejectRepair: (context) => {
        const state = get();
        const humanError = assertHuman(state, context, "Rejecting a repair");
        if (humanError) return reject(humanError, context.actor);
        if (!state.bench?.stagedRepair) return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "There is no staged repair to reject." }), context.actor);
        const id = state.bench.stagedRepair.id;
        const bench = cloneBench(state.bench);
        bench.stagedRepair = null;
        bench.status = "active";
        set({ bench, activities: ActivityLog.prepend(state.activities, activity("human", "repair_rejected", "Human rejected the staged repair.", [id])) });
        return success(state.design.revision, undefined);
      },

      verifyBench: (context) => {
        const state = get();
        if (!state.bench || state.bench.status !== "repair_applied") {
          return reject(failure(state.design.revision, { code: "BENCH_REQUIRED", message: "A human-approved repair is required before verification." }), context.actor);
        }
        const verification = benchEngine.verify(state.bench.id);
        const bench = cloneBench(state.bench);
        bench.verification = verification;
        bench.symptoms = verification.unresolvedSymptoms;
        bench.status = "verified";
        set({ bench, activities: ActivityLog.prepend(state.activities, activity(context.actor, "repair_verified", `${actorLabel(context.actor)} verified the bench: ${verification.result.toUpperCase()}.`, verification.actualOutputs.map((item) => item.componentId))) });
        return success(state.design.revision, verification);
      },

      undo: () => {
        const state = get();
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "Discard the bench before undoing design changes." }), "human");
        const entry = state.historyPast.at(-1);
        if (!entry) return failure(state.design.revision, { code: "INVALID_INPUT", message: "Nothing to undo." });
        const past = state.historyPast.slice(0, -1);
        set({
          design: cloneDesign(entry.before),
          physicalDesign: PhysicalLayout.reconcile(entry.before, state.physicalDesign),
          historyPast: past,
          historyFuture: [entry, ...state.historyFuture].slice(0, 50),
          ...invalidatedSimulationRunState(state),
          mode: "design",
          selection: null
        });
        return success(entry.before.revision, undefined);
      },

      redo: () => {
        const state = get();
        if (state.bench) return reject(failure(state.design.revision, { code: "INVALID_MODE", message: "Discard the bench before redoing design changes." }), "human");
        const entry = state.historyFuture[0];
        if (!entry) return failure(state.design.revision, { code: "INVALID_INPUT", message: "Nothing to redo." });
        set({
          design: cloneDesign(entry.after),
          physicalDesign: PhysicalLayout.reconcile(entry.after, state.physicalDesign),
          historyPast: [...state.historyPast, entry].slice(-50),
          historyFuture: state.historyFuture.slice(1),
          ...invalidatedSimulationRunState(state),
          mode: "design",
          selection: null
        });
        return success(entry.after.revision, undefined);
      },

      resetDemo: () => {
        const state = get();
        if (state.bench) benchEngine.forget(state.bench.id);
        const design = createDemoDesign();
        design.id = state.projectId;
        set({
          projectId: state.projectId,
          projectName: design.name,
          mode: "design",
          design,
          ...invalidatedSimulationRunState(state),
          bench: null,
          selection: null,
          wireDraft: null,
          historyPast: [],
          historyFuture: [],
          zoom: 1,
          physicalDesign: PhysicalLayout.generate(design),
          workspaceView: WorkspaceView.Circuit,
          activities: [activity("system", "project_reset", "Reset the deterministic judging demo.")]
        });
      },

      createDemoProject: () => {
        const state = get();
        if (state.bench) benchEngine.forget(state.bench.id);
        const design = createDemoDesign();
        design.id = `project-${crypto.randomUUID().slice(0, 8)}`;
        set({
          projectId: design.id,
          projectName: design.name,
          mode: "design",
          design,
          ...invalidatedSimulationRunState(state),
          bench: null,
          selection: null,
          wireDraft: null,
          historyPast: [],
          historyFuture: [],
          zoom: 1,
          physicalDesign: PhysicalLayout.generate(design),
          workspaceView: WorkspaceView.Circuit,
          activities: [activity("system", "project_reset", "Created a project from the deterministic demo template.")]
        });
      },

      newBlankProject: () => {
        const state = get();
        if (state.bench) benchEngine.forget(state.bench.id);
        const design = createBlankDesign(`project-${crypto.randomUUID().slice(0, 8)}`);
        set({
          projectId: design.id,
          projectName: design.name,
          mode: "design",
          design,
          ...invalidatedSimulationRunState(state),
          bench: null,
          selection: null,
          wireDraft: null,
          historyPast: [],
          historyFuture: [],
          zoom: 1,
          physicalDesign: PhysicalLayout.generate(design),
          workspaceView: WorkspaceView.Circuit,
          activities: [activity("system", "project_reset", "Created a blank ProbePilot project.")]
        });
      },

      loadProject: (record) => {
        const state = get();
        if (state.bench) benchEngine.forget(state.bench.id);
        set({
          projectId: record.id,
          projectName: record.name,
          mode: "design",
          design: cloneDesign(record.design),
          ...invalidatedSimulationRunState(state),
          bench: null,
          activities: record.activities.map((entry) => ({ ...entry, affectedIds: [...entry.affectedIds] })),
          selection: null,
          wireDraft: null,
          historyPast: [],
          historyFuture: [],
          zoom: 1,
          physicalDesign: record.physicalDesign,
          workspaceView: WorkspaceView.Circuit
        });
      }
    };
  });
}

export const studioStore = createStudioStore();
export function useStudioStore<T>(selector: (state: StudioState) => T): T {
  return useStore(studioStore, selector);
}

export function allTestPoints(design: CircuitDesign): Array<{ id: string; label: string }> {
  return Object.values(design.components).flatMap((component) =>
    componentCatalog[component.kind].terminals.map((terminal) => ({
      id: testPointId(component.id, terminal.id),
      label: `${component.label} · ${terminal.label}`
    }))
  );
}
