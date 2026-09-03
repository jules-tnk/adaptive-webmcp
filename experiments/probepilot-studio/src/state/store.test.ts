import { describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { SimulationCommandErrorCode, type CircuitDesign, type CommandContext, type SimulationResult } from "@/domain/types";
import { ProjectSchemaVersion, type ProjectRecord } from "@/projects/project-types";
import { PhysicalLayout } from "@/physical/physical-layout";
import { SimulationCoordinator } from "@/simulation/simulation-coordinator";
import {
  SimulationDiagnosticCode,
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationCompatibilityResolver,
  type SimulationEngine,
  type SimulationRequest
} from "@/simulation/simulation-engine";
import { createStudioStore, SimulationRunStatus } from "./store";

function simulationState(store: ReturnType<typeof createStudioStore>) {
  return store.getState();
}

function runSimulation(
  store: ReturnType<typeof createStudioStore>,
  context: CommandContext,
  request?: SimulationRequest
) {
  return store.getState().runSimulation(context, request);
}

class DeferredSimulationEngine implements SimulationEngine {
  readonly id = SimulationEngineId.Deterministic;
  calls = 0;
  private readonly resultPromise: Promise<SimulationResult>;
  private resolveResult: ((result: SimulationResult) => void) | null = null;

  constructor() {
    this.resultPromise = new Promise((resolve) => {
      this.resolveResult = resolve;
    });
  }

  canSimulate(_design: CircuitDesign): SimulationCompatibility {
    return { compatible: true, blockers: [] };
  }

  simulate(_design: CircuitDesign, _request: SimulationRequest): Promise<SimulationResult> {
    this.calls += 1;
    return this.resultPromise;
  }

  complete(result: SimulationResult): void {
    if (!this.resolveResult) throw new Error("Deferred simulation resolver is unavailable.");
    this.resolveResult(result);
  }
}

class SequencedSimulationEngine implements SimulationEngine {
  readonly id = SimulationEngineId.Deterministic;
  readonly runs = [new DeferredSimulationEngine(), new DeferredSimulationEngine()];
  calls = 0;

  canSimulate(_design: CircuitDesign): SimulationCompatibility {
    return { compatible: true, blockers: [] };
  }

  simulate(design: CircuitDesign, request: SimulationRequest): Promise<SimulationResult> {
    const run = this.runs[this.calls];
    this.calls += 1;
    return run
      ? run.simulate(design, request)
      : Promise.reject(new Error("No deferred simulation run is available."));
  }
}

class UnattributedSimulationCoordinator extends SimulationCoordinator {
  override simulate(design: CircuitDesign): Promise<SimulationResult> {
    const result = passingResult(design);
    delete result.engineId;
    return Promise.resolve(result);
  }
}

function passingResult(
  design: CircuitDesign,
  issues: SimulationResult["issues"] = [],
  summary = "Deferred deterministic result."
): SimulationResult {
  return {
    status: issues.length > 0 ? "warning" : "pass",
    designRevision: design.revision,
    issues,
    nodeVoltages: {},
    branchCurrents: {},
    components: {},
    observableOutputs: [],
    summary,
    engineId: SimulationEngineId.Deterministic
  };
}

async function createBenchStore() {
  const store = createStudioStore(createDemoDesign());
  expect((await runSimulation(store, { actor: "human" })).ok).toBe(true);
  expect(store.getState().startBench({ actor: "human" }).ok).toBe(true);
  return store;
}

function takeMeasurement(store: ReturnType<typeof createStudioStore>, first: string, second: string, purpose: string) {
  expect(store.getState().requestMeasurement({ mode: "dc_voltage", firstTestPointId: first, secondTestPointId: second, purpose }, { actor: "agent" }).ok).toBe(true);
  const result = store.getState().completeMeasurement({ firstTestPointId: first, secondTestPointId: second }, { actor: "human" });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("measurement failed");
  return result.value;
}

describe("studio store", () => {
  it("publishes pending and successful simulation lifecycle metadata", async () => {
    const design = createDemoDesign();
    const engine = new DeferredSimulationEngine();
    const store = createStudioStore(design, new SimulationCoordinator([engine]));

    const execution = runSimulation(store, { actor: "human" });

    expect(execution).toBeInstanceOf(Promise);
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Pending,
      simulation: null,
      simulatedRevision: null,
      requestedEngineId: null,
      executedEngineId: null,
      simulationDurationMs: null,
      simulationWarnings: [],
      simulationCompatibility: null
    });
    expect(simulationState(store).activeSimulationRunId).toEqual(expect.any(Number));
    expect(store.getState().mode).toBe("simulate");

    engine.complete(passingResult(design, [{
      code: "TEST_WARNING",
      severity: "warning",
      message: "The output is close to the configured limit.",
      affectedIds: ["r1"]
    }]));
    const command = await execution;

    expect(command).toMatchObject({
      ok: true,
      warnings: ["The output is close to the configured limit."]
    });
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Success,
      activeSimulationRunId: null,
      requestedEngineId: null,
      executedEngineId: SimulationEngineId.Deterministic,
      simulationWarnings: ["The output is close to the configured limit."],
      simulationCompatibility: { compatible: true, blockers: [] }
    });
    expect(simulationState(store).simulationDurationMs).toEqual(expect.any(Number));
    expect(store.getState().simulation?.summary).toBe("Deferred deterministic result.");
  });

  it("publishes a failure lifecycle state with every exact compatibility blocker", async () => {
    const design = createDemoDesign();
    const incompatibleEngine: SimulationEngine = {
      id: SimulationEngineId.Deterministic,
      canSimulate: () => ({
        compatible: false,
        blockers: [
          { componentId: "q1", reason: "NPN BJT has no verified deterministic model." },
          { componentId: "u1", reason: "Op-amp has no verified deterministic model." }
        ]
      }),
      simulate: (candidate) => Promise.resolve(passingResult(candidate))
    };
    const store = createStudioStore(design, new SimulationCoordinator([incompatibleEngine]));

    const command = await runSimulation(store, { actor: "human" });

    expect(command).toMatchObject({ ok: true, value: { status: "fail" } });
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Failure,
      activeSimulationRunId: null,
      requestedEngineId: null,
      executedEngineId: null,
      simulationWarnings: [],
      simulationCompatibility: {
        compatible: false,
        blockers: [
          { componentId: "q1", reason: "NPN BJT has no verified deterministic model." },
          { componentId: "u1", reason: "Op-amp has no verified deterministic model." }
        ]
      }
    });
    expect(store.getState().simulation?.issues.map((issue) => issue.code)).toEqual([
      SimulationDiagnosticCode.UnsupportedComponent,
      SimulationDiagnosticCode.UnsupportedComponent
    ]);
  });

  it("keeps execution null when the requested engine is unavailable", async () => {
    const design = createDemoDesign();
    const store = createStudioStore(design, new SimulationCoordinator([]));

    const command = await runSimulation(store, { actor: "agent" }, {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(command).toMatchObject({
      ok: true,
      value: {
        status: "fail",
        issues: [{ code: SimulationDiagnosticCode.EngineUnavailable }]
      }
    });
    expect(store.getState()).toMatchObject({
      simulationStatus: SimulationRunStatus.Failure,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationCompatibility: { compatible: false, blockers: [] }
    });
  });

  it("does not insert a completed result after the design revision changes", async () => {
    const design = createDemoDesign();
    const engine = new DeferredSimulationEngine();
    const store = createStudioStore(design, new SimulationCoordinator([engine]));
    const execution = runSimulation(store, { actor: "human" });
    const runId = simulationState(store).activeSimulationRunId;

    expect(store.getState().addComponent("capacitor", { x: 920, y: 260 }, { actor: "human" }).ok).toBe(true);
    expect(store.getState().design.revision).toBe(design.revision + 1);
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Superseded,
      activeSimulationRunId: runId,
      simulation: null,
      simulatedRevision: null
    });

    engine.complete(passingResult(design));
    const command = await execution;

    expect(command).toMatchObject({
      ok: false,
      revision: design.revision + 1,
      error: {
        code: SimulationCommandErrorCode.Superseded,
        currentRevision: design.revision + 1
      }
    });
    expect(simulationState(store).activeSimulationRunId).toBeNull();
    expect(store.getState().simulationStatus).toBe(SimulationRunStatus.Idle);
    expect(store.getState().simulation).toBeNull();
    expect(store.getState().mode).toBe("design");
  });

  it("finishes a superseded same-revision run before allowing its successor", async () => {
    const initialDesign = createDemoDesign();
    const engine = new SequencedSimulationEngine();
    const store = createStudioStore(initialDesign, new SimulationCoordinator([engine]));

    const olderExecution = runSimulation(store, { actor: "human" });
    const olderRunId = simulationState(store).activeSimulationRunId;
    store.getState().resetDemo();
    const currentDesign = store.getState().design;
    expect(currentDesign.revision).toBe(initialDesign.revision);
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Superseded,
      activeSimulationRunId: olderRunId
    });

    const blockedSuccessor = await runSimulation(store, { actor: "human" });
    expect(blockedSuccessor).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_MODE",
        message: "A superseded simulation is still finishing."
      }
    });

    engine.runs[0].complete(passingResult(initialDesign, [], "Older deterministic result."));
    const olderCommand = await olderExecution;

    expect(olderCommand).toMatchObject({
      ok: false,
      error: {
        code: SimulationCommandErrorCode.Superseded,
        currentRevision: currentDesign.revision
      }
    });
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Idle,
      activeSimulationRunId: null
    });

    const newerExecution = runSimulation(store, { actor: "human" });
    engine.runs[1].complete(passingResult(currentDesign, [], "Newer deterministic result."));
    expect((await newerExecution).ok).toBe(true);
    expect(store.getState().simulation?.summary).toBe("Newer deterministic result.");
    expect(store.getState().simulationStatus).toBe(SimulationRunStatus.Success);
  });

  it("rejects a duplicate simulation request without invoking the engine twice", async () => {
    const design = createDemoDesign();
    const engine = new DeferredSimulationEngine();
    const store = createStudioStore(design, new SimulationCoordinator([engine]));

    const firstExecution = runSimulation(store, { actor: "human" });
    const duplicate = await runSimulation(store, { actor: "human" });

    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "INVALID_MODE", message: "A simulation is already running." }
    });
    expect(engine.calls).toBe(1);

    engine.complete(passingResult(design));
    expect((await firstExecution).ok).toBe(true);
  });

  it.each([
    { label: "omits its engine ID", authoredEngineId: undefined },
    { label: "claims deterministic execution", authoredEngineId: SimulationEngineId.Deterministic }
  ])("attributes automatic SPICE selection when the engine $label", async ({ authoredEngineId }) => {
    const design = createDemoDesign();
    const spiceEngine: SimulationEngine = {
      id: SimulationEngineId.Spice,
      canSimulate: () => ({ compatible: true, blockers: [] }),
      simulate: (candidate) => {
        const result = passingResult(candidate);
        delete result.engineId;
        if (authoredEngineId) result.engineId = authoredEngineId;
        return Promise.resolve(result);
      }
    };
    const store = createStudioStore(design, new SimulationCoordinator([spiceEngine]));

    const command = await runSimulation(store, { actor: "human" });

    expect(command).toMatchObject({
      ok: true,
      value: { engineId: SimulationEngineId.Spice }
    });
    expect(store.getState()).toMatchObject({
      requestedEngineId: null,
      executedEngineId: SimulationEngineId.Spice
    });
    const bench = store.getState().startBench({ actor: "human" });

    expect(bench).toMatchObject({
      ok: false,
      error: {
        code: "SIMULATION_REQUIRED",
        message: "Run a passing deterministic simulation for the current design before creating a bench."
      }
    });
    expect(store.getState().bench).toBeNull();
  });

  it("fails a compatible result that lacks authoritative coordinator attribution", async () => {
    const design = createDemoDesign();
    const store = createStudioStore(design, new UnattributedSimulationCoordinator());

    const command = await runSimulation(store, { actor: "human" }, {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(command).toMatchObject({
      ok: true,
      value: {
        status: "fail",
        issues: [{
          code: SimulationDiagnosticCode.EngineFailure,
          message: "Simulation result did not include authoritative engine attribution."
        }],
        summary: "Simulation result did not include authoritative engine attribution."
      }
    });
    expect(store.getState()).toMatchObject({
      simulationStatus: SimulationRunStatus.Failure,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationCompatibility: null
    });
    expect(store.getState().startBench({ actor: "human" })).toMatchObject({
      ok: false,
      error: { code: "SIMULATION_REQUIRED" }
    });
  });

  it("keeps selected-engine attribution on an engine-authored compatibility failure", async () => {
    const design = createDemoDesign();
    const spiceEngine: SimulationEngine = {
      id: SimulationEngineId.Spice,
      canSimulate: () => ({ compatible: true, blockers: [] }),
      simulate: (candidate) => Promise.resolve({
        status: "fail",
        designRevision: candidate.revision,
        issues: [{
          code: SimulationDiagnosticCode.UnsupportedComponent,
          severity: "error",
          message: "The selected engine rejected R1 during execution.",
          affectedIds: ["r1"]
        }],
        nodeVoltages: {},
        branchCurrents: {},
        components: {},
        observableOutputs: [],
        summary: "The selected engine rejected the design.",
        engineId: SimulationEngineId.Deterministic
      })
    };
    const store = createStudioStore(design, new SimulationCoordinator([spiceEngine]));

    const command = await runSimulation(store, { actor: "human" });

    expect(command).toMatchObject({
      ok: true,
      value: { status: "fail", engineId: SimulationEngineId.Spice }
    });
    expect(store.getState()).toMatchObject({
      executedEngineId: SimulationEngineId.Spice,
      simulationCompatibility: {
        compatible: false,
        blockers: [{
          componentId: "r1",
          reason: "The selected engine rejected R1 during execution."
        }]
      }
    });
  });

  it.each([
    {
      label: "intrinsic engine compatibility",
      coordinator: () => new SimulationCoordinator([{
        id: SimulationEngineId.Deterministic,
        canSimulate: () => {
          throw new Error("Intrinsic compatibility failed.");
        },
        simulate: (candidate: CircuitDesign) => Promise.resolve(passingResult(candidate))
      }])
    },
    {
      label: "compatibility policy",
      coordinator: () => {
        const resolver: SimulationCompatibilityResolver = {
          resolve: () => {
            throw new Error("Compatibility policy failed.");
          }
        };
        return new SimulationCoordinator([new DeferredSimulationEngine()], resolver);
      }
    }
  ])("settles a $label throw as a typed failed simulation", async ({ coordinator }) => {
    const design = createDemoDesign();
    const store = createStudioStore(design, coordinator());
    const execution = runSimulation(store, { actor: "human" });

    await expect(execution).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fail",
        issues: [{
          code: SimulationDiagnosticCode.EngineFailure,
          severity: "error",
          message: "Simulation coordination failed before an engine result was returned.",
          affectedIds: []
        }],
        summary: "Simulation coordination failed before an engine result was returned."
      }
    });
    expect(simulationState(store)).toMatchObject({
      simulationStatus: SimulationRunStatus.Failure,
      activeSimulationRunId: null,
      requestedEngineId: null,
      executedEngineId: null,
      simulationCompatibility: null,
      simulationDurationMs: expect.any(Number)
    });
  });

  it("loads durable project fields and clears transient workspace state", async () => {
    const store = await createBenchStore();
    store.getState().setZoom(1.4);
    store.getState().setSelection({ type: "component", id: "r1" });
    const design = createDemoDesign();
    design.id = "project-loaded";
    design.name = "Loaded circuit";
    const record: ProjectRecord = {
      schemaVersion: ProjectSchemaVersion.Current,
      id: design.id,
      name: design.name,
      createdAt: "2026-08-31T12:00:00.000Z",
      updatedAt: "2026-08-31T12:30:00.000Z",
      design,
      activities: [],
      physicalDesign: PhysicalLayout.generate(design)
    };

    store.getState().loadProject(record);

    expect(store.getState().projectId).toBe(record.id);
    expect(store.getState().projectName).toBe(record.name);
    expect(store.getState().bench).toBeNull();
    expect(store.getState().simulation).toBeNull();
    expect(store.getState().selection).toBeNull();
    expect(store.getState().wireDraft).toBeNull();
    expect(store.getState().historyPast).toEqual([]);
    expect(store.getState().historyFuture).toEqual([]);
    expect(store.getState().zoom).toBe(1);
    expect(store.getState().mode).toBe("design");
  });

  it("rejects a stale agent mutation", () => {
    const store = createStudioStore(createDemoDesign());
    const current = store.getState().design.revision;
    store.getState().updateComponent("r1", { label: "R-main" }, { actor: "human" });
    const result = store.getState().updateComponent("r1", { label: "Agent overwrite" }, { actor: "agent", expectedRevision: current });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("REVISION_CONFLICT");
  });

  it("enforces human-owned agent protection", () => {
    const store = createStudioStore(createDemoDesign());
    store.getState().updateComponent("r1", { agentLocked: true }, { actor: "human" });
    const revision = store.getState().design.revision;
    const result = store.getState().updateComponent("r1", { label: "Changed" }, { actor: "agent", expectedRevision: revision });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AGENT_LOCKED");
  });

  it("rejects an atomic agent build when any connection endpoint is protected", () => {
    const store = createStudioStore(createDemoDesign());
    expect(store.getState().updateComponent("r1", { agentLocked: true }, { actor: "human" }).ok).toBe(true);
    const before = store.getState();
    const designBefore = JSON.stringify(before.design);
    const historyBefore = before.historyPast;
    const result = store.getState().buildCircuit({
      expectedRevision: before.design.revision,
      components: [
        { key: "capacitor", kind: "capacitor", placement: { type: "auto", order: 0 } }
      ],
      connections: [
        { from: { component: "r1", terminal: "a" }, to: { component: "capacitor", terminal: "a" } }
      ]
    }, { actor: "agent" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AGENT_LOCKED");
    expect(JSON.stringify(store.getState().design)).toBe(designBefore);
    expect(store.getState().historyPast).toEqual(historyBefore);
  });

  it("rejects an atomic agent component removal when a cascaded wire touches protection", () => {
    const store = createStudioStore(createDemoDesign());
    expect(store.getState().updateComponent("r1", { agentLocked: true }, { actor: "human" }).ok).toBe(true);
    const before = store.getState();
    const designBefore = JSON.stringify(before.design);
    const historyBefore = before.historyPast;
    const result = store.getState().removeElements(["sw1"], [], {
      actor: "agent",
      expectedRevision: before.design.revision
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AGENT_LOCKED");
    expect(JSON.stringify(store.getState().design)).toBe(designBefore);
    expect(store.getState().historyPast).toEqual(historyBefore);
  });

  it("treats an agent circuit build as one undo checkpoint", () => {
    const store = createStudioStore({ schemaVersion: 1, id: "empty", name: "Empty", revision: 0, components: {}, wires: {} });
    const result = store.getState().buildCircuit({
      expectedRevision: 0,
      components: [
        { key: "source", kind: "dc_source", placement: { type: "auto", order: 0 } },
        { key: "ground", kind: "ground", placement: { type: "auto", order: 1 } }
      ],
      connections: [{ from: { component: "source", terminal: "negative" }, to: { component: "ground", terminal: "g" } }]
    }, { actor: "agent" });
    expect(result.ok).toBe(true);
    expect(store.getState().historyPast).toHaveLength(1);
    expect(store.getState().undo().ok).toBe(true);
    expect(Object.keys(store.getState().design.components)).toHaveLength(0);
  });

  it("requires a human to create the bench and perform measurements", async () => {
    const store = createStudioStore(createDemoDesign());
    await runSimulation(store, { actor: "agent" });
    const agentStart = store.getState().startBench({ actor: "agent" });
    expect(agentStart.ok).toBe(false);
    expect(store.getState().startBench({ actor: "human" }).ok).toBe(true);
    store.getState().requestMeasurement({ mode: "dc_voltage", firstTestPointId: "r1:a", secondTestPointId: "gnd:g", purpose: "Check power." }, { actor: "agent" });
    const agentMeasure = store.getState().completeMeasurement({ firstTestPointId: "r1:a", secondTestPointId: "gnd:g" }, { actor: "agent" });
    expect(agentMeasure.ok).toBe(false);
  });

  it("rejects Bench with a typed capability reason when the circuit contains a capacitor", async () => {
    const store = createStudioStore(createDemoDesign());
    expect(store.getState().addComponent("capacitor", { x: 920, y: 260 }, { actor: "human" }).ok).toBe(true);
    expect((await runSimulation(store, { actor: "human" })).ok).toBe(true);

    const result = store.getState().startBench({ actor: "human" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("Capacitor");
    }
    expect(store.getState().bench).toBeNull();
    expect(store.getState().mode).not.toBe("bench");
  });

  it("rejects repair staging before enough human evidence exists", async () => {
    const store = await createBenchStore();
    const first = takeMeasurement(store, "r1:a", "gnd:g", "Check the resistor input.");
    const result = store.getState().stageRepair({ target: { type: "wire", wireId: "w3" }, action: "reconnect_wire", evidenceIds: [first.id, first.id], expectedOutcome: "Restore the LED." }, { actor: "agent" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("completes the evidence-gated repair journey", async () => {
    const store = await createBenchStore();
    const first = takeMeasurement(store, "r1:a", "gnd:g", "Confirm power reaches R1.");
    const second = takeMeasurement(store, "led1:anode", "gnd:g", "Check voltage at LED1.");
    expect(first.value).toBe(9);
    expect(second.value).toBe(0);
    const staged = store.getState().stageRepair({ target: { type: "wire", wireId: "w3" }, action: "reconnect_wire", evidenceIds: [first.id, second.id], expectedOutcome: "Restore power to LED1." }, { actor: "agent" });
    expect(staged.ok).toBe(true);
    expect(store.getState().approveRepair({ actor: "agent" }).ok).toBe(false);
    expect(store.getState().approveRepair({ actor: "human" }).ok).toBe(true);
    const verification = store.getState().verifyBench({ actor: "agent" });
    expect(verification.ok).toBe(true);
    if (verification.ok) expect(verification.value.result).toBe("pass");
  });
});
