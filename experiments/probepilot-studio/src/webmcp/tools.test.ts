import { describe, expect, it } from "vitest";
import { ComponentCapability } from "@/components/component-capability";
import { createBlankDesign, createDemoDesign } from "@/domain/fixtures";
import { PhysicalPlacementMode, WorkspaceView } from "@/physical/physical-design";
import { SimulationCommandErrorCode, type CircuitDesign, type SimulationResult } from "@/domain/types";
import { SimulationCoordinator } from "@/simulation/simulation-coordinator";
import {
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationEngine,
  type SimulationRequest
} from "@/simulation/simulation-engine";
import { createStudioStore, SimulationRunStatus } from "@/state/store";
import { TscircuitDiagnosticCode } from "@/tscircuit/tscircuit-diagnostics";
import { buildPublicStudioDto, InspectScope } from "./public-dto";
import { createProbePilotTools } from "./tools";

function requireTool(name: string, store = createStudioStore(createBlankDesign("webmcp-test"))): WebMcpTool {
  const tool = createProbePilotTools(store).find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing WebMCP tool ${name}.`);
  return tool;
}

class DeferredWebMcpSimulationEngine implements SimulationEngine {
  readonly id = SimulationEngineId.Spice;
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

  complete(design: CircuitDesign): void {
    if (!this.resolveResult) throw new Error("Deferred WebMCP simulation resolver is unavailable.");
    this.resolveResult({
      status: "pass",
      designRevision: design.revision,
      issues: [],
      nodeVoltages: {},
      branchCurrents: {},
      components: {},
      observableOutputs: [],
      summary: "Deferred SPICE result.",
      engineId: SimulationEngineId.Spice
    });
  }
}

describe("WebMCP surface", () => {
  it("exposes semantic tools but no human-only operations", () => {
    const tools = createProbePilotTools(createStudioStore(createDemoDesign()));
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([
      "studio_inspect",
      "design_build_circuit",
      "design_update_components",
      "design_remove_elements",
      "design_validate_and_simulate",
      "bench_request_measurement",
      "bench_update_hypotheses",
      "bench_stage_repair",
      "bench_verify"
    ]);
    expect(names).not.toContain("take_measurement");
    expect(names).not.toContain("apply_repair");
    expect(names).not.toContain("reveal_fault");
    expect(names).not.toContain("start_bench");
  });

  it("publishes registry-derived build and update property schemas for the full catalog", () => {
    const build = requireTool("design_build_circuit");
    const update = requireTool("design_update_components");
    const buildSchema = JSON.stringify(build.inputSchema);
    const updateSchema = JSON.stringify(update.inputSchema);

    for (const kind of [
      "dc_source", "ground", "resistor", "led", "switch", "battery", "current_source",
      "capacitor", "inductor", "diode", "zener_diode", "schottky_diode", "fuse",
      "potentiometer", "push_button", "spdt_switch", "npn_bjt", "pnp_bjt",
      "n_channel_mosfet", "p_channel_mosfet", "op_amp"
    ]) {
      expect(buildSchema).toContain(`"const":"${kind}"`);
    }
    expect(buildSchema).toContain('"const":"capacitor"');
    expect(buildSchema).toContain('"title":"Capacitor properties","type":"object","additionalProperties":false');
    expect(buildSchema).toContain('"capacitanceFarads":{"oneOf":[{"type":"number"},{"type":"string"}],"default":0.000001}');
    expect(buildSchema).toContain('"polarized":{"type":"boolean","default":false}');
    expect(buildSchema).toContain('"voltageRating":{"oneOf":[{"type":"number"},{"type":"string"}],"default":25}');
    expect(updateSchema).toContain('"anyOf":[{"title":"DC source properties"');
    expect(updateSchema).toContain('"title":"Capacitor properties","type":"object","additionalProperties":false');
  });

  it("publishes the registry numeric bounds in build and update property schemas", () => {
    const buildSchema = JSON.stringify(requireTool("design_build_circuit").inputSchema);
    const updateSchema = JSON.stringify(requireTool("design_update_components").inputSchema);

    for (const schema of [buildSchema, updateSchema]) {
      expect(schema).toContain('"voltage":{"oneOf":[{"type":"number","minimum":0.1,"maximum":24},{"type":"string"}],"default":9}');
      expect(schema).toContain('"resistanceOhms":{"oneOf":[{"type":"number","minimum":1,"maximum":10000000},{"type":"string"}],"default":330}');
      expect(schema).toContain('"tolerance":{"oneOf":[{"type":"number","minimum":0,"maximum":1},{"type":"string"}],"default":0.05}');
      expect(schema).toContain('"forwardVoltage":{"type":"number","maximum":5,"exclusiveMinimum":0,"default":2}');
      expect(schema).toContain('"maxCurrentMilliamps":{"type":"number","maximum":50,"exclusiveMinimum":0,"default":25}');
      expect(schema).toContain('"wiperPosition":{"type":"number","minimum":0,"maximum":1,"default":0.5}');
      expect(schema).toContain('"zenerVoltage":{"type":"number","maximum":200,"exclusiveMinimum":0,"default":5.1}');
      expect(schema).toContain('"maxCurrentAmps":{"type":"number","exclusiveMinimum":0,"default":0.1}');
      expect(schema).toContain('"beta":{"type":"number","exclusiveMinimum":0,"default":100}');
      expect(schema).toContain('"gain":{"type":"number","exclusiveMinimum":0,"default":100000}');
    }
  });

  it("builds an RC network through the expanded registry-backed contract", async () => {
    const store = createStudioStore(createBlankDesign("rc-webmcp"));
    const build = requireTool("design_build_circuit", store);

    const result = await build.execute({
      expectedRevision: 0,
      components: [
        { key: "r", kind: "resistor", properties: { resistanceOhms: "10kΩ", tolerance: "1%" }, placement: { type: "auto", order: 0 } },
        { key: "c", kind: "capacitor", properties: { capacitanceFarads: "1uF", polarized: false, voltageRating: "25V" }, placement: { type: "auto", order: 1 } }
      ],
      connections: [{ from: { component: "r", terminal: "b" }, to: { component: "c", terminal: "a" } }]
    });

    expect(result).toMatchObject({ ok: true, revision: 1 });
    expect(Object.values(store.getState().design.components).map((component) => component.properties)).toEqual([
      { kind: "resistor", resistanceOhms: 10_000, tolerance: 0.01 },
      { kind: "capacitor", capacitanceFarads: 0.000001, polarized: false, voltageRating: 25 }
    ]);
    expect(Object.values(store.getState().design.wires)).toHaveLength(1);
  });

  it("rejects invalid per-kind properties without mutating the design", () => {
    const store = createStudioStore(createBlankDesign("invalid-webmcp"));
    const build = requireTool("design_build_circuit", store);

    expect(() => build.execute({
      expectedRevision: 0,
      components: [{
        key: "c",
        kind: "capacitor",
        properties: { capacitanceFarads: "not-a-capacitance", polarized: false, voltageRating: 25 },
        placement: { type: "auto", order: 0 }
      }],
      connections: []
    })).toThrow();
    expect(store.getState().design).toEqual(createBlankDesign("invalid-webmcp"));
  });

  it("rejects readonly registry fields in both the published schema and executor", () => {
    const store = createStudioStore(createBlankDesign("readonly-webmcp"));
    const build = requireTool("design_build_circuit", store);
    const buildSchema = JSON.stringify(build.inputSchema);

    expect(buildSchema).toContain('"title":"N-channel MOSFET properties","type":"object","additionalProperties":false,"properties":{"mode"');
    expect(buildSchema).not.toContain('"title":"N-channel MOSFET properties","type":"object","additionalProperties":false,"properties":{"channel"');
    expect(() => build.execute({
      expectedRevision: 0,
      components: [{
        key: "mosfet",
        kind: "n_channel_mosfet",
        properties: { channel: "n" },
        placement: { type: "auto", order: 0 }
      }],
      connections: []
    })).toThrow("Unexpected n_channel_mosfet properties: channel");
    expect(store.getState().design).toEqual(createBlankDesign("readonly-webmcp"));
  });

  it("validates every batched component update before applying the first mutation", () => {
    const store = createStudioStore(createDemoDesign());
    const update = requireTool("design_update_components", store);
    const before = JSON.stringify(store.getState().design);

    expect(() => update.execute({
      expectedRevision: 1,
      updates: [
        { componentId: "r1", properties: { resistanceOhms: "1k" } },
        { componentId: "led1", properties: { maxCurrentMilliamps: 100 } }
      ]
    })).toThrow();
    expect(store.getState().design.revision).toBe(1);
    expect(JSON.stringify(store.getState().design)).toBe(before);
  });

  it("rejects an atomic build when a connection reaches a protected existing component", async () => {
    const store = createStudioStore(createDemoDesign());
    expect(store.getState().updateComponent("r1", { agentLocked: true }, { actor: "human" }).ok).toBe(true);
    const build = requireTool("design_build_circuit", store);
    const before = JSON.stringify(store.getState().design);

    const result = await build.execute({
      expectedRevision: store.getState().design.revision,
      components: [
        { key: "capacitor", kind: "capacitor", placement: { type: "auto", order: 0 } }
      ],
      connections: [
        { from: { component: "r1", terminal: "a" }, to: { component: "capacitor", terminal: "a" } }
      ]
    });

    expect(result).toMatchObject({ ok: false, error: { code: "AGENT_LOCKED" } });
    expect(JSON.stringify(store.getState().design)).toBe(before);
  });

  it("rejects an atomic removal when its component cascade reaches a protected wire endpoint", async () => {
    const store = createStudioStore(createDemoDesign());
    expect(store.getState().updateComponent("r1", { agentLocked: true }, { actor: "human" }).ok).toBe(true);
    const remove = requireTool("design_remove_elements", store);
    const before = JSON.stringify(store.getState().design);

    const result = await remove.execute({
      expectedRevision: store.getState().design.revision,
      componentIds: ["sw1"],
      wireIds: [],
      reason: "Remove the switch."
    });

    expect(result).toMatchObject({ ok: false, error: { code: "AGENT_LOCKED" } });
    expect(JSON.stringify(store.getState().design)).toBe(before);
  });

  it("inspects registry capability levels and default footprints", () => {
    const store = createStudioStore(createBlankDesign("inspect-capabilities"));
    store.getState().addComponent("capacitor", { x: 120, y: 160 }, { actor: "human" });

    const result = buildPublicStudioDto(store.getState(), InspectScope.Design);

    expect(result).toMatchObject({
      design: {
        components: [expect.objectContaining({
          kind: "capacitor",
          defaultFootprint: "0805",
          capabilities: {
            [ComponentCapability.Design]: true,
            [ComponentCapability.Spice]: true,
            [ComponentCapability.Bench]: false
          }
        })],
        conversionDiagnostics: []
      }
    });
  });

  it("publishes read-only physical preview metadata without adding mutation tools", () => {
    const store = createStudioStore(createDemoDesign());
    const result = buildPublicStudioDto(store.getState(), InspectScope.Summary);
    const names = createProbePilotTools(store).map((candidate) => candidate.name);

    expect(result).toMatchObject({
      workspaceView: WorkspaceView.Circuit,
      physicalPreview: {
        placementMode: PhysicalPlacementMode.Automatic,
        board: { widthMm: 80, heightMm: 60, thicknessMm: 1.6 },
        pcbAvailable: true,
        threeDAvailable: true,
        warnings: [],
        editableByAgent: false
      }
    });
    expect(Object.keys(result.physicalPreview.placements)).toHaveLength(5);
    expect(names).toHaveLength(9);
    expect(names).not.toContain("pcb_update");
    expect(names).not.toContain("three_d_update");
  });

  it("inspects typed tsCircuit conversion diagnostics without exposing partial elements", () => {
    const invalidDesign = createDemoDesign();
    invalidDesign.wires.w3!.b.terminalId = "missing-terminal";
    const store = createStudioStore(invalidDesign);

    const result = buildPublicStudioDto(store.getState(), InspectScope.Design);

    expect(result).toMatchObject({
      design: {
        conversionDiagnostics: [expect.objectContaining({
          code: TscircuitDiagnosticCode.InvalidTerminalReference,
          severity: "error",
          affectedIds: ["w3", "led1"]
        })]
      }
    });
    expect(JSON.stringify(result)).not.toContain("source_component_v1");
  });

  it("preserves the original five-component public property payloads", () => {
    const result = buildPublicStudioDto(createStudioStore(createDemoDesign()).getState(), InspectScope.Design);

    expect(result).toMatchObject({
      design: {
        components: [
          expect.objectContaining({ id: "v1", properties: { kind: "dc_source", voltage: 9, enabled: true } }),
          expect.objectContaining({ id: "sw1", properties: { kind: "switch", closed: true } }),
          expect.objectContaining({ id: "r1", properties: { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 } }),
          expect.objectContaining({ id: "led1", properties: { kind: "led", forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: "red" } }),
          expect.objectContaining({ id: "gnd", properties: { kind: "ground" } })
        ]
      }
    });
  });

  it("awaits an agent-requested engine run and publishes its lifecycle metadata", async () => {
    const design = createDemoDesign();
    const engine = new DeferredWebMcpSimulationEngine();
    const store = createStudioStore(design, new SimulationCoordinator([engine]));
    const simulate = requireTool("design_validate_and_simulate", store);

    const execution = simulate.execute({
      expectedRevision: design.revision,
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(execution).toBeInstanceOf(Promise);
    expect(store.getState()).toMatchObject({
      simulationStatus: SimulationRunStatus.Pending,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationDurationMs: null,
      simulationWarnings: [],
      simulationCompatibility: null
    });
    expect(await requireTool("studio_inspect", store).execute({ scope: "simulation" })).toMatchObject({
      simulationStatus: SimulationRunStatus.Pending,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationDurationMs: null,
      simulationWarnings: [],
      simulationCompatibility: null,
      availableAgentActions: [
        "studio_inspect",
        "design_build_circuit",
        "design_update_components",
        "design_remove_elements"
      ],
      simulation: null
    });

    engine.complete(design);
    const command = await execution;

    expect(command).toMatchObject({
      ok: true,
      revision: design.revision,
      value: {
        status: "pass",
        engineId: SimulationEngineId.Spice,
        summary: "Deferred SPICE result."
      }
    });
    expect(engine.calls).toBe(1);
    expect(store.getState().activities[0]).toMatchObject({ actor: "agent", action: "simulation_run" });
    expect(await requireTool("studio_inspect", store).execute({ scope: "simulation" })).toMatchObject({
      simulationStatus: SimulationRunStatus.Success,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: SimulationEngineId.Spice,
      simulationDurationMs: expect.any(Number),
      simulationWarnings: [],
      simulationCompatibility: { compatible: true, blockers: [] },
      simulation: { summary: "Deferred SPICE result." }
    });
  });

  it("publishes exact unsupported-component blockers after an agent simulation", async () => {
    const design = createDemoDesign();
    const unsupportedEngine: SimulationEngine = {
      id: SimulationEngineId.Spice,
      canSimulate: () => ({
        compatible: false,
        blockers: [
          { componentId: "q1", reason: "NPN BJT has no verified SPICE mapping." },
          { componentId: "u1", reason: "Op-amp has no verified SPICE mapping." }
        ]
      }),
      simulate: () => Promise.reject(new Error("An incompatible engine must not run."))
    };
    const store = createStudioStore(design, new SimulationCoordinator([unsupportedEngine]));

    const command = await requireTool("design_validate_and_simulate", store).execute({
      expectedRevision: design.revision,
      preferredEngineId: SimulationEngineId.Spice
    });
    const inspection = await requireTool("studio_inspect", store).execute({ scope: "simulation" });

    expect(command).toMatchObject({ ok: true, value: { status: "fail" } });
    expect(inspection).toMatchObject({
      simulationStatus: SimulationRunStatus.Failure,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationCompatibility: {
        compatible: false,
        blockers: [
          { componentId: "q1", reason: "NPN BJT has no verified SPICE mapping." },
          { componentId: "u1", reason: "Op-amp has no verified SPICE mapping." }
        ]
      }
    });
  });

  it("runs verified SPICE while keeping the guided Bench deterministic", async () => {
    const store = createStudioStore(createDemoDesign());
    const designInspection = buildPublicStudioDto(store.getState(), InspectScope.Design);

    expect(designInspection).toMatchObject({
      design: {
        components: [
          { capabilities: { [ComponentCapability.Spice]: true } },
          { capabilities: { [ComponentCapability.Spice]: true } },
          { capabilities: { [ComponentCapability.Spice]: true } },
          { capabilities: { [ComponentCapability.Spice]: true } },
          { capabilities: { [ComponentCapability.Spice]: true } }
        ]
      }
    });

    const command = await requireTool("design_validate_and_simulate", store).execute({
      expectedRevision: store.getState().design.revision,
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(command).toMatchObject({
      ok: true,
      value: { status: "pass", engineId: SimulationEngineId.Spice }
    });
    expect(await requireTool("studio_inspect", store).execute({ scope: "simulation" })).toMatchObject({
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: SimulationEngineId.Spice
    });
    expect(store.getState().startBench({ actor: "human" })).toMatchObject({
      ok: false,
      error: { code: "SIMULATION_REQUIRED" }
    });

    const deterministicCommand = await requireTool("design_validate_and_simulate", store).execute({
      expectedRevision: store.getState().design.revision
    });
    expect(deterministicCommand).toMatchObject({ ok: true, value: { status: "pass" } });
    expect(await requireTool("studio_inspect", store).execute({ scope: "simulation" })).toMatchObject({
      requestedEngineId: null,
      executedEngineId: SimulationEngineId.Deterministic
    });
    expect(store.getState().startBench({ actor: "human" })).toMatchObject({ ok: true });
  });

  it("does not advertise a concurrent run while superseded engine work is finishing", async () => {
    const design = createDemoDesign();
    const engine = new DeferredWebMcpSimulationEngine();
    const store = createStudioStore(design, new SimulationCoordinator([engine]));
    const execution = requireTool("design_validate_and_simulate", store).execute({
      expectedRevision: design.revision,
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(store.getState().addComponent("capacitor", { x: 900, y: 240 }, { actor: "human" }).ok).toBe(true);
    const inspection = await requireTool("studio_inspect", store).execute({ scope: "summary" });

    expect(inspection).toMatchObject({
      simulationStatus: "superseded",
      availableAgentActions: [
        "studio_inspect",
        "design_build_circuit",
        "design_update_components",
        "design_remove_elements"
      ]
    });

    engine.complete(design);
    expect(await execution).toMatchObject({
      ok: false,
      error: { code: SimulationCommandErrorCode.Superseded }
    });
  });

  it("does not leak the private fault through the public DTO", async () => {
    const store = createStudioStore(createDemoDesign());
    await store.getState().runSimulation({ actor: "human" });
    store.getState().startBench({ actor: "human" });
    const serialized = JSON.stringify(buildPublicStudioDto(store.getState(), InspectScope.Bench));
    expect(serialized).not.toContain("hiddenFault");
    expect(serialized).not.toContain("open_wire");
    expect(serialized).not.toContain('"wireId":"w3","type":"open_wire"');
  });

  it("measurement requests stop in an awaiting-human state", async () => {
    const store = createStudioStore(createDemoDesign());
    await store.getState().runSimulation({ actor: "human" });
    store.getState().startBench({ actor: "human" });
    const tool = createProbePilotTools(store).find((candidate) => candidate.name === "bench_request_measurement");
    expect(tool).toBeDefined();
    const result = await tool!.execute({ mode: "dc_voltage", firstTestPointId: "r1:a", secondTestPointId: "gnd:g", purpose: "Confirm power reaches R1." });
    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(result)).not.toContain('"value"');
    expect(store.getState().bench?.pendingMeasurement?.status).toBe("awaiting_human");
  });

  it("publishes strict remove bounds that match runtime validation", () => {
    const remove = requireTool("design_remove_elements");
    const schema = JSON.stringify(remove.inputSchema);

    expect(schema).toContain('"componentIds":{"type":"array","maxItems":20');
    expect(schema).toContain('"wireIds":{"type":"array","maxItems":30');
    expect(schema).toContain('"reason":{"type":"string","minLength":1,"maxLength":240}');
    expect(() => remove.execute({ expectedRevision: 0, componentIds: Array.from({ length: 21 }, (_, index) => `c-${index}`), reason: "Too many components" })).toThrow();
    expect(() => remove.execute({ expectedRevision: 0, wireIds: Array.from({ length: 31 }, (_, index) => `w-${index}`), reason: "Too many wires" })).toThrow();
    expect(() => remove.execute({ expectedRevision: 0, reason: "x".repeat(241) })).toThrow();
  });

  it("publishes diagnostic text bounds that exactly match strict runtime validation", () => {
    const measurement = requireTool("bench_request_measurement");
    const hypotheses = requireTool("bench_update_hypotheses");
    const repair = requireTool("bench_stage_repair");

    expect(JSON.stringify(measurement.inputSchema)).toContain(
      '"purpose":{"type":"string","minLength":1,"maxLength":240}'
    );
    expect(JSON.stringify(hypotheses.inputSchema)).toContain(
      '"explanation":{"type":"string","minLength":1,"maxLength":280}'
    );
    expect(JSON.stringify(repair.inputSchema)).toContain(
      '"expectedOutcome":{"type":"string","minLength":1,"maxLength":280}'
    );

    expect(() => measurement.execute({
      mode: "dc_voltage",
      firstTestPointId: "r1:a",
      secondTestPointId: "gnd:g",
      purpose: ""
    })).toThrow();
    expect(() => measurement.execute({
      mode: "dc_voltage",
      firstTestPointId: "r1:a",
      secondTestPointId: "gnd:g",
      purpose: "x".repeat(241)
    })).toThrow();
    expect(() => hypotheses.execute({
      hypotheses: [{
        targetType: "wire",
        targetId: "w3",
        confidence: 1,
        evidenceIds: [],
        explanation: ""
      }]
    })).toThrow();
    expect(() => hypotheses.execute({
      hypotheses: [{
        targetType: "wire",
        targetId: "w3",
        confidence: 1,
        evidenceIds: [],
        explanation: "x".repeat(281)
      }]
    })).toThrow();
    expect(() => repair.execute({
      target: { type: "wire", wireId: "w3" },
      action: "reconnect_wire",
      evidenceIds: ["M1", "M2"],
      expectedOutcome: ""
    })).toThrow();
    expect(() => repair.execute({
      target: { type: "wire", wireId: "w3" },
      action: "reconnect_wire",
      evidenceIds: ["M1", "M2"],
      expectedOutcome: "x".repeat(281)
    })).toThrow();
  });

  it("rejects undeclared top-level properties for all nine tool executors", () => {
    const validInputs: Readonly<Record<string, object>> = {
      studio_inspect: {},
      design_build_circuit: { expectedRevision: 0, components: [], connections: [] },
      design_update_components: { expectedRevision: 0, updates: [{ componentId: "missing" }] },
      design_remove_elements: { expectedRevision: 0, reason: "Remove selected elements." },
      design_validate_and_simulate: { expectedRevision: 0 },
      bench_request_measurement: { mode: "dc_voltage", firstTestPointId: "r1:a", secondTestPointId: "gnd:g", purpose: "Measure voltage." },
      bench_update_hypotheses: { hypotheses: [] },
      bench_stage_repair: { target: { type: "wire", wireId: "w3" }, action: "reconnect_wire", evidenceIds: ["M1", "M2"], expectedOutcome: "Restore the path." },
      bench_verify: {}
    };

    for (const [name, input] of Object.entries(validInputs)) {
      expect(() => requireTool(name).execute({ ...input, unexpected: true })).toThrow();
    }
  });

  it("rejects undeclared nested properties wherever the published schemas close objects", () => {
    expect(() => requireTool("design_build_circuit").execute({
      expectedRevision: 0,
      components: [],
      connections: [{ from: { component: "a", terminal: "1", unexpected: true }, to: { component: "b", terminal: "1" } }]
    })).toThrow();
    expect(() => requireTool("design_update_components").execute({
      expectedRevision: 0,
      updates: [{ componentId: "a", position: { x: 0, y: 0, unexpected: true } }]
    })).toThrow();
    expect(() => requireTool("bench_update_hypotheses").execute({
      hypotheses: [{ targetType: "wire", targetId: "w3", confidence: 1, evidenceIds: [], explanation: "Open path.", unexpected: true }]
    })).toThrow();
    expect(() => requireTool("bench_stage_repair").execute({
      target: { type: "wire", wireId: "w3", unexpected: true },
      action: "reconnect_wire",
      evidenceIds: ["M1", "M2"],
      expectedOutcome: "Restore the path."
    })).toThrow();
  });

  it("marks bench verification as mutating because it records verification state", () => {
    expect(requireTool("bench_verify").annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });
});
