import {
  ComponentKind,
  LedDisplayColor,
  SimulationWaveformAxis,
  type CircuitComponent,
  type CircuitDesign,
  type CircuitWire,
  type ComponentProperties
} from "@/domain/types";
import { createDemoDesign } from "@/domain/fixtures";
import {
  LocalNgspiceDiagnosticCode,
  LocalNgspiceEngineAdapter
} from "@/tscircuit/local-ngspice-engine-adapter";
import { SpicePayloadType } from "@/tscircuit/spice-engine-payload";
import {
  SimulationAnalysisType,
  SimulationEngineId,
  SimulationProbeKind,
  SimulationSweepScale
} from "./simulation-engine";
import { SimulationCoordinator } from "./simulation-coordinator";
import { TscircuitSpiceSimulationEngine } from "./tscircuit-spice-simulation-engine";
import { describe, expect, it } from "vitest";

function component(id: string, properties: ComponentProperties): CircuitComponent {
  return {
    id,
    kind: properties.kind,
    label: id.toUpperCase(),
    position: { x: 0, y: 0 },
    properties,
    agentLocked: false,
    createdBy: "human",
    lastModifiedBy: "human"
  };
}

function wire(
  id: string,
  firstComponentId: string,
  firstTerminalId: string,
  secondComponentId: string,
  secondTerminalId: string
): CircuitWire {
  return {
    id,
    a: { componentId: firstComponentId, terminalId: firstTerminalId },
    b: { componentId: secondComponentId, terminalId: secondTerminalId },
    createdBy: "human"
  };
}

function design(
  name: string,
  components: readonly CircuitComponent[],
  wires: readonly CircuitWire[]
): CircuitDesign {
  return {
    schemaVersion: 1,
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    revision: 8,
    components: Object.fromEntries(components.map((item) => [item.id, item])),
    wires: Object.fromEntries(wires.map((item) => [item.id, item]))
  };
}

const ground = (): CircuitComponent => component("gnd", { kind: ComponentKind.Ground });

describe("TscircuitSpiceSimulationEngine local ngspice golden cases", () => {
  it("rejects registry-disabled SPICE components before creating the runtime", async () => {
    const fixture = design("Unsupported transistor", [
      component("q1", { kind: ComponentKind.NpnBjt, beta: 100 })
    ], []);
    let runtimeFactoryCalls = 0;
    const engine = new TscircuitSpiceSimulationEngine(async () => {
      runtimeFactoryCalls += 1;
      throw new Error("The SPICE runtime must not be created for registry-disabled components.");
    });

    expect(engine.canSimulate(fixture)).toEqual({ compatible: false, blockers: [
      { componentId: "q1", reason: "NPN BJT has not passed the verified SPICE capability gate." }
    ] });

    const result = await new SimulationCoordinator([engine]).simulate(fixture, {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(result.status).toBe("fail");
    expect(result.issues.map((issue) => ({ message: issue.message, affectedIds: issue.affectedIds }))).toEqual([
      { message: "NPN BJT has not passed the verified SPICE capability gate.", affectedIds: ["q1"] }
    ]);
    expect(runtimeFactoryCalls).toBe(0);
  });

  it("executes a real voltage-divider operating-point deck without fetch", async () => {
    const fixture = design("Voltage divider", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
      component("r2", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "r2", "a"),
      wire("w3", "r2", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      return Promise.reject(new Error("Hosted fetch blocked"));
    }) as typeof fetch;

    try {
      const result = await new TscircuitSpiceSimulationEngine().simulate(fixture, {
        analysis: { type: SimulationAnalysisType.OperatingPoint },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }]
      });

      expect(result.status).toBe("pass");
      expect(result.engineId).toBe(SimulationEngineId.Spice);
      expect(result.nodeVoltages["r2:a"]).toBeCloseTo(2.5, 9);
      expect(result.components.r1?.currentAmps).toBeCloseTo(0.00025, 9);
      expect(fetchCalls).toBe(0);
      expect(result).not.toHaveProperty("simulationResultCircuitJson");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 20_000);

  it("executes a real RC transient deck and returns a bounded charging waveform", async () => {
    const fixture = design("RC low-pass", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 100e-9, polarized: false, voltageRating: 25 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "c1", "a"),
      wire("w3", "c1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = await new TscircuitSpiceSimulationEngine().simulate(fixture, {
      analysis: {
        type: SimulationAnalysisType.Transient,
        stepSeconds: 0.001,
        stopSeconds: 0.005,
        useInitialConditions: true
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
    });

    const points = result.waveforms?.find((waveform) => waveform.componentId === "c1")?.points;
    expect(result.status, JSON.stringify(result.issues)).toBe("pass");
    expect(points).toHaveLength(6);
    expect(points?.[0]?.y).toBeCloseTo(0.002498750624687657, 8);
    expect(points?.at(-1)?.y).toBeCloseTo(4.966440474385712, 8);
  }, 20_000);

  it("executes a real RL transient deck and returns a rising inductor current", async () => {
    const fixture = design("RL step response", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 100, tolerance: 0.05 }),
      component("l1", { kind: ComponentKind.Inductor, inductanceHenries: 0.001, maxCurrentAmps: 0.1 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "l1", "a"),
      wire("w3", "l1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = await new TscircuitSpiceSimulationEngine().simulate(fixture, {
      analysis: { type: SimulationAnalysisType.Transient, stepSeconds: 0.000002, stopSeconds: 0.00005, useInitialConditions: true },
      probes: [{ kind: SimulationProbeKind.ComponentCurrent, componentId: "l1" }]
    });

    const points = result.waveforms?.find((waveform) => waveform.componentId === "l1")?.points;
    expect(result.status, JSON.stringify(result.issues)).toBe("pass");
    expect(points && points.length > 2).toBe(true);
    expect(Math.abs(points?.at(-1)?.y ?? 0)).toBeGreaterThan(Math.abs(points?.[0]?.y ?? 0));
    expect(Math.abs(points?.at(-1)?.y ?? 0)).toBeCloseTo(0.05, 2);
  }, 20_000);

  it("executes real diode and open-switch operating points", async () => {
    const diodeFixture = design("Diode limiter", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 330, tolerance: 0.05 }),
      component("d1", { kind: ComponentKind.Diode, forwardVoltage: 0.7 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "d1", "anode"),
      wire("w3", "d1", "cathode", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const openFixture = design("Open switch", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("sw1", { kind: ComponentKind.Switch, closed: false }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 330, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "sw1", "a"),
      wire("w2", "sw1", "b", "r1", "a"),
      wire("w3", "r1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const engine = new TscircuitSpiceSimulationEngine();

    const diode = await engine.simulate(diodeFixture, { analysis: { type: SimulationAnalysisType.OperatingPoint } });
    const open = await engine.simulate(openFixture, { analysis: { type: SimulationAnalysisType.OperatingPoint } });

    expect(diode.status, JSON.stringify(diode.issues)).toBe("pass");
    expect(diode.components.d1?.currentAmps).toBeGreaterThan(0.001);
    expect(diode.components.d1?.voltageDrop).toBeGreaterThan(0.4);
    expect(open.status, JSON.stringify(open.issues)).toBe("pass");
    expect(Math.abs(open.components.sw1?.currentAmps ?? 1)).toBeLessThan(1e-9);
  }, 20_000);

  it("executes a real LED operating-point deck with the registered nonlinear model", async () => {
    const fixture = design("LED limiter", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 330, tolerance: 0.05 }),
      component("led1", { kind: ComponentKind.Led, forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: LedDisplayColor.Red }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "led1", "anode"),
      wire("w3", "led1", "cathode", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = await new TscircuitSpiceSimulationEngine().simulate(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [{ kind: SimulationProbeKind.ComponentCurrent, componentId: "led1" }]
    });

    expect(result.status).toBe("pass");
    expect(result.components.led1?.voltageDrop).toBeCloseTo(2.219429895198468, 8);
    expect(result.components.led1?.currentAmps).toBeCloseTo(0.008425970014550144, 8);
    expect(result.components.led1?.state).toBe("on");
  }, 20_000);

  it("normalizes real DC and AC sweep decks into bounded package-independent series", async () => {
    const dcFixture = design("DC sweep", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);
    const acFixture = design("AC low-pass", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 0, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 1e-6, polarized: false, voltageRating: 25 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "c1", "a"),
      wire("w3", "c1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const engine = new TscircuitSpiceSimulationEngine();

    const dcResult = await engine.simulate(dcFixture, {
      analysis: {
        type: SimulationAnalysisType.DcSweep,
        sourceComponentId: "v1",
        start: 0,
        stop: 5,
        step: 1
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r1", terminalId: "a" }]
    });
    const acResult = await engine.simulate(acFixture, {
      analysis: {
        type: SimulationAnalysisType.AcSweep,
        sourceComponentId: "v1",
        scale: SimulationSweepScale.Decade,
        points: 2,
        startHertz: 10,
        stopHertz: 1000,
        magnitude: 1,
        phaseDegrees: 0
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
    });

    expect(dcResult.waveforms?.[0]).toMatchObject({
      axis: SimulationWaveformAxis.DcVoltage,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
        { x: 4, y: 4 },
        { x: 5, y: 5 }
      ]
    });
    const acPoints = acResult.waveforms?.[0]?.points;
    expect(acResult.issues).toEqual([]);
    expect(acResult.status).toBe("pass");
    expect(acResult.waveforms?.[0]?.axis).toBe(SimulationWaveformAxis.Frequency);
    expect(acPoints?.[0]?.x).toBeCloseTo(10, 10);
    expect(acPoints?.at(-1)?.x).toBeCloseTo(1000, 10);
    expect(acPoints?.[0]?.y).toBeGreaterThan(acPoints?.at(-1)?.y ?? 0);
    expect(acResult.components.r1?.voltageDrop).toBeCloseTo(0.9875704921513918, 8);
  }, 20_000);

  it("returns an engine failure instead of accepting a partial raw payload", async () => {
    const fixture = design("Partial divider", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
      component("r2", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "r2", "a"),
      wire("w3", "r2", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const engine = new TscircuitSpiceSimulationEngine(async () => ({
      simulate: async () => ({
        simulationResultCircuitJson: [{
          type: SpicePayloadType.OperatingPointVoltage,
          name: "n2",
          voltage: 2.5
        }]
      })
    }));

    const result = await engine.simulate(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.status).toBe("fail");
    expect(result.issues).toEqual([expect.objectContaining({
      code: "SIMULATION_ENGINE_FAILURE",
      message: expect.stringMatching(/missing/i)
    })]);
    expect(result.nodeVoltages).toEqual({});
    expect(result.branchCurrents).toEqual({});
    expect(result.components).toEqual({});
  });

  it("returns conversion diagnostics without executing a partial deck", async () => {
    const unsupported = design("Unsupported", [
      component("q1", { kind: ComponentKind.NpnBjt, beta: 100 }),
      ground()
    ], []);

    const result = await new TscircuitSpiceSimulationEngine().simulate(unsupported, {});

    expect(result.status).toBe("fail");
    expect(result.engineId).toBe(SimulationEngineId.Spice);
    expect(result.issues).toEqual([expect.objectContaining({
      code: "SPICE_UNSUPPORTED_COMPONENT",
      affectedIds: ["q1"]
    })]);
  });

  it("raises a typed diagnostic for an actual malformed ngspice deck", async () => {
    const localEngine = await LocalNgspiceEngineAdapter.create();

    await expect(localEngine.simulate(
      "Malformed deck\nTHIS IS NOT SPICE\n.op\n.end\n"
    )).rejects.toMatchObject({
      code: LocalNgspiceDiagnosticCode.ExecutionFailed,
      exitCode: 1
    });
  }, 20_000);
});
