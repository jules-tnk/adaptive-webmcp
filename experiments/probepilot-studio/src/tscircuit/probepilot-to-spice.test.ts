import { describe, expect, it, vi } from "vitest";
import { TscircuitAdapter } from "./tscircuit-adapter";
import { SpiceRuntime } from "./spice-runtime";
import { SpiceModelRegistry } from "./spice-model-registry";
import {
  BatteryStandard,
  ComponentKind,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  type CircuitComponent,
  type CircuitDesign,
  type CircuitWire,
  type ComponentProperties
} from "@/domain/types";
import {
  SimulationAnalysisType,
  SimulationProbeKind,
  SimulationSweepScale,
  type SimulationRequest
} from "@/simulation/simulation-engine";
import {
  ProbePilotToSpice,
  SpiceConversionErrorCode
} from "./probepilot-to-spice";

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
    revision: 1,
    components: Object.fromEntries([...components].reverse().map((item) => [item.id, item])),
    wires: Object.fromEntries([...wires].reverse().map((item) => [item.id, item]))
  };
}

function operatingPointRequest(
  componentId: string,
  terminalId: string
): SimulationRequest {
  return {
    analysis: { type: SimulationAnalysisType.OperatingPoint },
    probes: [{
      kind: SimulationProbeKind.NodeVoltage,
      componentId,
      terminalId
    }]
  };
}

const ground = (): CircuitComponent => component("gnd", { kind: ComponentKind.Ground });

function spdtFixture(position: SpdtPosition): CircuitDesign {
  return design(`SPDT position ${position.toUpperCase()}`, [
    component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
    component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
    component("r2", { kind: ComponentKind.Resistor, resistanceOhms: 2000, tolerance: 0.05 }),
    component("sw1", { kind: ComponentKind.SpdtSwitch, position }),
    ground()
  ], [
    wire("w1", "v1", "positive", "sw1", "common"),
    wire("w2", "sw1", "a", "r1", "a"),
    wire("w3", "sw1", "b", "r2", "a"),
    wire("w4", "r1", "b", "gnd", "g"),
    wire("w5", "r2", "b", "gnd", "g"),
    wire("w6", "v1", "negative", "gnd", "g")
  ]);
}

describe("ProbePilotToSpice exact netlists", () => {
  it("converts a voltage divider with stable names and an explicit ground node", () => {
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

    const result = ProbePilotToSpice.convert(fixture, operatingPointRequest("r2", "a"));

    expect(result.errors).toEqual([]);
    expect(result.netlist).toBe(
      "Voltage divider\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n1 n2 10k\n" +
      "R2 n2 0 10k\n" +
      ".op\n" +
      ".probe V(n2)\n" +
      ".end\n"
    );
    expect(result.componentElementNames).toEqual({ v1: ["V1"], r1: ["R1"], r2: ["R2"] });
    expect(result.terminalNodeNames["gnd:g"]).toBe("0");
  });

  it("converts an RC low-pass with transient analysis", () => {
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

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.Transient,
        stepSeconds: 1e-6,
        stopSeconds: 0.01
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
    });

    expect(result.netlist).toBe(
      "RC low-pass\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n1 n2 10k\n" +
      "C1 n2 0 100n\n" +
      ".tran 1u 10m\n" +
      ".probe V(n2)\n" +
      ".end\n"
    );
  });

  it("converts an RL circuit and a component-current probe", () => {
    const fixture = design("RL circuit", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 12, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 100, tolerance: 0.05 }),
      component("l1", { kind: ComponentKind.Inductor, inductanceHenries: 0.01, maxCurrentAmps: 1 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "l1", "a"),
      wire("w3", "l1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.Transient,
        stepSeconds: 10e-6,
        stopSeconds: 5e-3
      },
      probes: [{ kind: SimulationProbeKind.ComponentCurrent, componentId: "l1" }]
    });

    expect(result.netlist).toBe(
      "RL circuit\n" +
      "V1 n1 0 DC 12\n" +
      "R1 n1 n2 100\n" +
      "L1 n2 0 10m\n" +
      ".tran 10u 5m\n" +
      ".probe I(L1)\n" +
      ".end\n"
    );
  });

  it("converts an LED limiter with its exact named model", () => {
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

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [{ kind: SimulationProbeKind.ComponentCurrent, componentId: "led1" }]
    });

    expect(result.netlist).toBe(
      "LED limiter\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n1 n2 330\n" +
      "D1 n2 0 PP_LED\n" +
      ".model PP_LED D (IS=1e-20 N=2 RS=10 CJO=2p EG=2.1 BV=5 IBV=10u)\n" +
      ".op\n" +
      ".probe I(D1)\n" +
      ".end\n"
    );
  });

  it("converts a diode rectifier with its exact named model", () => {
    const fixture = design("Diode rectifier", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 9, enabled: true }),
      component("d1", { kind: ComponentKind.Diode, forwardVoltage: 0.7 }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "d1", "anode"),
      wire("w2", "d1", "cathode", "r1", "a"),
      wire("w3", "r1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, operatingPointRequest("r1", "a"));

    expect(result.netlist).toBe(
      "Diode rectifier\n" +
      "V1 n1 0 DC 9\n" +
      "R1 n2 0 1k\n" +
      "D1 n1 n2 PP_DIODE\n" +
      ".model PP_DIODE D (IS=2.52n N=1.752)\n" +
      ".op\n" +
      ".probe V(n2)\n" +
      ".end\n"
    );
  });

  it("converts an open switch to the documented open-path resistance", () => {
    const fixture = design("Open switch", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("sw1", { kind: ComponentKind.Switch, closed: false }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "sw1", "a"),
      wire("w2", "sw1", "b", "r1", "a"),
      wire("w3", "r1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [{ kind: SimulationProbeKind.ComponentCurrent, componentId: "sw1" }]
    });

    expect(result.netlist).toBe(
      "Open switch\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n2 0 1k\n" +
      "RSW1 n1 n2 1t\n" +
      ".op\n" +
      ".probe I(RSW1)\n" +
      ".end\n"
    );
  });

  it("converts a potentiometer divider to two stable resistor cards", () => {
    const fixture = design("Potentiometer divider", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 10, enabled: true }),
      component("pot1", { kind: ComponentKind.Potentiometer, resistanceOhms: 10_000, wiperPosition: 0.25 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "pot1", "a"),
      wire("w2", "pot1", "b", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, operatingPointRequest("pot1", "wiper"));

    expect(result.netlist).toBe(
      "Potentiometer divider\n" +
      "V1 n1 0 DC 10\n" +
      "RPOT1A n1 n2 2.5k\n" +
      "RPOT1B n2 0 7.5k\n" +
      ".op\n" +
      ".probe V(n2)\n" +
      ".end\n"
    );
    expect(result.componentElementNames.pot1).toEqual(["RPOT1A", "RPOT1B"]);
  });

  it("emits a DC sweep against the stable independent-source name", () => {
    const fixture = design("DC sweep", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.DcSweep,
        sourceComponentId: "v1",
        start: 0,
        stop: 5,
        step: 0.5
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r1", terminalId: "a" }]
    });

    expect(result.netlist).toBe(
      "DC sweep\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n1 0 1k\n" +
      ".dc V1 0 5 0.5\n" +
      ".probe V(n1)\n" +
      ".end\n"
    );
  });

  it("emits an AC source specification and sweep command", () => {
    const fixture = design("AC sweep", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 1e-6, polarized: false, voltageRating: 25 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "c1", "a"),
      wire("w3", "c1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.AcSweep,
        sourceComponentId: "v1",
        scale: SimulationSweepScale.Decade,
        points: 10,
        startHertz: 10,
        stopHertz: 1_000_000,
        magnitude: 1,
        phaseDegrees: 0
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
    });

    expect(result.netlist).toBe(
      "AC sweep\n" +
      "V1 n1 0 DC 5 AC 1 0\n" +
      "R1 n1 n2 1k\n" +
      "C1 n2 0 1u\n" +
      ".ac dec 10 10 1meg\n" +
      ".probe V(n2)\n" +
      ".end\n"
    );
  });

  it("converts SPDT position A to one selected and one unselected stable path", () => {
    expect(ProbePilotToSpice.supports(ComponentKind.SpdtSwitch)).toBe(true);
    const result = ProbePilotToSpice.convert(spdtFixture(SpdtPosition.A), {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [
        { kind: SimulationProbeKind.NodeVoltage, componentId: "r1", terminalId: "a" },
        { kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }
      ]
    });

    expect(result.errors).toEqual([]);
    expect(result.netlist).toBe(
      "SPDT position A\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n2 0 1k\n" +
      "R2 n3 0 2k\n" +
      "RSPDT1A n1 n2 1m\n" +
      "RSPDT1B n1 n3 1t\n" +
      ".op\n" +
      ".probe V(n2) V(n3)\n" +
      ".end\n"
    );
    expect(result.componentElementNames.sw1).toEqual(["RSPDT1A", "RSPDT1B"]);
  });

  it("converts SPDT position B by swapping the selected stable path", () => {
    const result = ProbePilotToSpice.convert(spdtFixture(SpdtPosition.B), {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [
        { kind: SimulationProbeKind.NodeVoltage, componentId: "r1", terminalId: "a" },
        { kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }
      ]
    });

    expect(result.errors).toEqual([]);
    expect(result.netlist).toBe(
      "SPDT position B\n" +
      "V1 n1 0 DC 5\n" +
      "R1 n2 0 1k\n" +
      "R2 n3 0 2k\n" +
      "RSPDT1A n1 n2 1t\n" +
      "RSPDT1B n1 n3 1m\n" +
      ".op\n" +
      ".probe V(n2) V(n3)\n" +
      ".end\n"
    );
    expect(result.componentElementNames.sw1).toEqual(["RSPDT1A", "RSPDT1B"]);
  });
});

describe("ProbePilotToSpice complete mapping and atomic failures", () => {
  it("maps battery, current source, zener, Schottky, pushbutton, and fuse cards", () => {
    const fixture = design("Additional mappings", [
      component("battery", { kind: ComponentKind.Battery, voltage: 9, capacityMilliampHours: 500, standard: BatteryStandard.NineVolt }),
      component("current", { kind: ComponentKind.CurrentSource, currentAmps: 0.02, enabled: true }),
      component("zener", { kind: ComponentKind.ZenerDiode, zenerVoltage: 5.1 }),
      component("schottky", { kind: ComponentKind.SchottkyDiode, forwardVoltage: 0.3 }),
      component("button", { kind: ComponentKind.PushButton, pressed: true }),
      component("fuse", { kind: ComponentKind.Fuse, currentRatingAmps: 1, voltageRating: 32 }),
      ground()
    ], [
      wire("w1", "battery", "positive", "current", "positive"),
      wire("w2", "current", "positive", "zener", "anode"),
      wire("w3", "zener", "anode", "schottky", "anode"),
      wire("w4", "schottky", "anode", "button", "a"),
      wire("w5", "button", "a", "fuse", "a"),
      wire("w6", "battery", "negative", "current", "negative"),
      wire("w7", "current", "negative", "zener", "cathode"),
      wire("w8", "zener", "cathode", "schottky", "cathode"),
      wire("w9", "schottky", "cathode", "button", "b"),
      wire("w10", "button", "b", "fuse", "b"),
      wire("w11", "fuse", "b", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBe(
      "Additional mappings\n" +
      "V1 n1 0 DC 9\n" +
      "I1 n1 0 DC 0.02\n" +
      "D1 n1 0 PP_ZENER_5P1\n" +
      "D2 n1 0 PP_SCHOTTKY\n" +
      "RPB1 n1 0 1m\n" +
      "RF1 n1 0 1m\n" +
      ".model PP_ZENER_5P1 D (IS=2.52n N=1.752 BV=5.1 IBV=1m)\n" +
      ".model PP_SCHOTTKY D (IS=200n N=1.05 RS=0.1 BV=40 IBV=10u)\n" +
      ".op\n" +
      ".end\n"
    );
  });

  it("uses the component zener voltage in a stable named model card", () => {
    const fixture = design("Twelve volt zener", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 15, enabled: true }),
      component("z1", { kind: ComponentKind.ZenerDiode, zenerVoltage: 12 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "z1", "cathode"),
      wire("w2", "z1", "anode", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toContain("D1 0 n1 PP_ZENER_12");
    expect(result.netlist).toContain(
      ".model PP_ZENER_12 D (IS=2.52n N=1.752 BV=12 IBV=1m)"
    );
  });

  it("maps closed switches and unpressed pushbuttons to opposite ideal resistances", () => {
    const fixture = design("Ideal paths", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("switch", { kind: ComponentKind.Switch, closed: true }),
      component("button", { kind: ComponentKind.PushButton, pressed: false }),
      ground()
    ], [
      wire("w1", "v1", "positive", "switch", "a"),
      wire("w2", "switch", "a", "button", "a"),
      wire("w3", "switch", "b", "button", "b"),
      wire("w4", "button", "b", "gnd", "g"),
      wire("w5", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toContain("RSW1 n1 0 1m");
    expect(result.netlist).toContain("RPB1 n1 0 1t");
  });

  it.each([
    component("npn", { kind: ComponentKind.NpnBjt, beta: 100 }),
    component("pnp", { kind: ComponentKind.PnpBjt, beta: 100 }),
    component("nmos", { kind: ComponentKind.NChannelMosfet, channel: MosfetChannel.N, mode: MosfetMode.Enhancement }),
    component("pmos", { kind: ComponentKind.PChannelMosfet, channel: MosfetChannel.P, mode: MosfetMode.Enhancement }),
    component("opamp", { kind: ComponentKind.OpAmp, gain: 100_000 })
  ])("returns an error and no partial netlist for unsupported $kind", (unsupported) => {
    const fixture = design("Unsupported component", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      unsupported,
      ground()
    ], [wire("ground", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.terminalNodeNames).toEqual({});
    expect(result.componentElementNames).toEqual({});
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: SpiceConversionErrorCode.UnsupportedComponent,
      componentId: unsupported.id
    }));
  });

  it("rejects a groundless design before emitting executable text", () => {
    const fixture = design("No ground", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 })
    ], [wire("w1", "v1", "positive", "r1", "a")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.MissingGround })]);
  });

  it("rejects an isolated ground that is not connected to any executable card", () => {
    const fixture = design("Isolated ground", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "v1", "negative")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.terminalNodeNames).toEqual({});
    expect(result.componentElementNames).toEqual({});
    expect(result.errors).toEqual([
      expect.objectContaining({ code: SpiceConversionErrorCode.DisconnectedGround })
    ]);
  });

  it("rejects a floating executable island even when another island is grounded", () => {
    const fixture = design("Mixed grounded and floating islands", [
      component("v-grounded", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r-grounded", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      component("v-floating", { kind: ComponentKind.DcSource, voltage: 3, enabled: true }),
      component("r-floating", { kind: ComponentKind.Resistor, resistanceOhms: 2200, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v-grounded", "positive", "r-grounded", "a"),
      wire("w2", "r-grounded", "b", "gnd", "g"),
      wire("w3", "v-grounded", "negative", "gnd", "g"),
      wire("w4", "v-floating", "positive", "r-floating", "a"),
      wire("w5", "r-floating", "b", "v-floating", "negative")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.terminalNodeNames).toEqual({});
    expect(result.componentElementNames).toEqual({});
    expect(result.errors).toEqual([expect.objectContaining({
      code: SpiceConversionErrorCode.DisconnectedGround,
      affectedComponentIds: ["r-floating", "v-floating"]
    })]);
  });

  it("rejects a broken wire endpoint without returning any partial payload", () => {
    const fixture = design("Broken endpoint", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1000, tolerance: 0.05 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "r1", "missing"),
      wire("w2", "v1", "negative", "gnd", "g")
    ]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.terminalNodeNames).toEqual({});
    expect(result.componentElementNames).toEqual({});
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: SpiceConversionErrorCode.InvalidConnection,
        wireId: "w1",
        componentId: "r1"
      })
    ]);
  });

  it("rejects a forced missing diode model without returning any partial payload", () => {
    const fixture = design("Missing diode model", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("d1", { kind: ComponentKind.Diode, forwardVoltage: 0.7 }),
      ground()
    ], [
      wire("w1", "v1", "positive", "d1", "anode"),
      wire("w2", "d1", "cathode", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);
    const actualCardFor = SpiceModelRegistry.cardFor.bind(SpiceModelRegistry);
    const cardFor = vi.spyOn(SpiceModelRegistry, "cardFor").mockImplementation((kind) =>
      kind === ComponentKind.Diode ? undefined : actualCardFor(kind)
    );

    try {
      const result = ProbePilotToSpice.convert(fixture, {
        analysis: { type: SimulationAnalysisType.OperatingPoint }
      });

      expect(result.netlist).toBeUndefined();
      expect(result.terminalNodeNames).toEqual({});
      expect(result.componentElementNames).toEqual({});
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: SpiceConversionErrorCode.MissingModel,
          componentId: "d1"
        })
      ]);
    } finally {
      cardFor.mockRestore();
    }
  });

  it("rejects invalid probes before emitting executable text", () => {
    const fixture = design("Bad probe", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      ground()
    ], [wire("w1", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "missing", terminalId: "a" }]
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.InvalidProbe })]);
  });

  it("rejects an inverted AC frequency range before emitting executable text", () => {
    const fixture = design("Bad AC sweep", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      ground()
    ], [wire("w1", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.AcSweep,
        sourceComponentId: "v1",
        scale: SimulationSweepScale.Linear,
        points: 10,
        startHertz: 1000,
        stopHertz: 10
      }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.InvalidAnalysis })]);
  });

  it("rejects a DC sweep whose positive step cannot reach its stop value", () => {
    const fixture = design("Bad DC sweep", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      ground()
    ], [wire("w1", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.DcSweep,
        sourceComponentId: "v1",
        start: 5,
        stop: 0,
        step: 0.5
      }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.InvalidAnalysis })]);
  });

  it("rejects transient bounds that start after the stop time", () => {
    const fixture = design("Bad transient", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      ground()
    ], [wire("w1", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.Transient,
        stepSeconds: 1e-6,
        stopSeconds: 1e-3,
        startSeconds: 2e-3
      }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.InvalidAnalysis })]);
  });

  it("rejects a sweep that selects a disabled source", () => {
    const fixture = design("Disabled sweep source", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: false }),
      ground()
    ], [wire("w1", "v1", "negative", "gnd", "g")]);

    const result = ProbePilotToSpice.convert(fixture, {
      analysis: {
        type: SimulationAnalysisType.AcSweep,
        sourceComponentId: "v1",
        scale: SimulationSweepScale.Decade,
        points: 10,
        startHertz: 10,
        stopHertz: 1000
      }
    });

    expect(result.netlist).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: SpiceConversionErrorCode.InvalidAnalysis })]);
  });

  it("cross-checks R/C and BJT card semantics against circuit-json-to-spice without using it as output", () => {
    const rcFixture = design("Reference RC", [
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 100e-9, polarized: false, voltageRating: 25 }),
      ground()
    ], [
      wire("w1", "r1", "b", "c1", "a"),
      wire("w2", "c1", "b", "gnd", "g")
    ]);
    const rcCircuitJson = TscircuitAdapter.toCircuitJson(rcFixture);
    const rcReference = SpiceRuntime.getCircuitJsonConverter()(rcCircuitJson.elements).toSpiceString();

    expect(rcReference).toMatch(/RR1\s+\S+\s+\S+\s+10K/);
    expect(rcReference).toMatch(/CC1\s+\S+\s+\S+\s+100N/);

    const bjtFixture = design("Reference BJT", [
      component("q1", { kind: ComponentKind.NpnBjt, beta: 100 }),
      ground()
    ], [wire("w1", "q1", "emitter", "gnd", "g")]);
    const bjtCircuitJson = TscircuitAdapter.toCircuitJson(bjtFixture);
    const bjtReference = SpiceRuntime.getCircuitJsonConverter()(bjtCircuitJson.elements).toSpiceString();

    expect(bjtReference).toContain(".MODEL NPN NPN");
    expect(bjtReference).toMatch(/QQ1\s+\S+\s+\S+\s+\S+\s+NPN/);
    expect(ProbePilotToSpice.convert(bjtFixture, {
      analysis: { type: SimulationAnalysisType.OperatingPoint }
    }).netlist).toBeUndefined();
  });
});
