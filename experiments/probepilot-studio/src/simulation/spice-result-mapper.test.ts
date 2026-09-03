import {
  ComponentKind,
  LedDisplayColor,
  SimulationWaveformAxis,
  SimulationWaveformQuantity,
  type CircuitComponent,
  type CircuitDesign,
  type CircuitWire,
  type ComponentProperties
} from "@/domain/types";
import {
  SimulationAnalysisType,
  SimulationEngineId,
  SimulationProbeKind,
  SimulationSweepScale,
  type SimulationRequest
} from "./simulation-engine";
import {
  SpiceDcSweepUnit,
  SpicePayloadType,
  SpiceResultMapper
} from "./spice-result-mapper";
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
    revision: 4,
    components: Object.fromEntries(components.map((item) => [item.id, item])),
    wires: Object.fromEntries(wires.map((item) => [item.id, item]))
  };
}

function voltageDivider(): CircuitDesign {
  return design("Voltage divider", [
    component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
    component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
    component("r2", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.01 }),
    component("gnd", { kind: ComponentKind.Ground })
  ], [
    wire("w1", "v1", "positive", "r1", "a"),
    wire("w2", "r1", "b", "r2", "a"),
    wire("w3", "r2", "b", "gnd", "g"),
    wire("w4", "v1", "negative", "gnd", "g")
  ]);
}

const dividerTerminalNodes = {
  "gnd:g": "0",
  "r1:a": "n1",
  "r1:b": "n2",
  "r2:a": "n2",
  "r2:b": "0",
  "v1:negative": "0",
  "v1:positive": "n1"
};

const dividerElementNames = {
  r1: ["R1"],
  r2: ["R2"],
  v1: ["V1"]
};

const operatingPointRequest: SimulationRequest = {
  analysis: { type: SimulationAnalysisType.OperatingPoint },
  probes: [{
    kind: SimulationProbeKind.NodeVoltage,
    componentId: "r2",
    terminalId: "a"
  }]
};

describe("SpiceResultMapper", () => {
  it("maps captured ngspice divider operating-point values back to every ProbePilot terminal and component", () => {
    const result = SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        engineVersionString: "ngspice-46",
        simulationResultCircuitJson: [
          { type: SpicePayloadType.OperatingPointVoltage, name: "n1", voltage: 5 },
          { type: SpicePayloadType.OperatingPointVoltage, name: "n2", voltage: 2.5 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r1[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r2[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@v1[i]", current: -0.00025 }
        ]
      }
    });

    expect(result).toMatchObject({
      status: "pass",
      designRevision: 4,
      engineId: SimulationEngineId.Spice,
      nodeVoltages: {
        "gnd:g": 0,
        "r1:a": 5,
        "r1:b": 2.5,
        "r2:a": 2.5,
        "r2:b": 0,
        "v1:negative": 0,
        "v1:positive": 5
      },
      branchCurrents: { r1: 0.00025, r2: 0.00025, v1: 0.00025 },
      components: {
        r1: { voltageDrop: 2.5, currentAmps: 0.00025 },
        r2: { voltageDrop: 2.5, currentAmps: 0.00025 },
        v1: { voltageDrop: 5, currentAmps: 0.00025 }
      }
    });
    expect(result.waveforms).toBeUndefined();
    expect(result).not.toHaveProperty("simulationResultCircuitJson");
    expect(result).not.toHaveProperty("engineVersionString");
  });

  it("maps captured ngspice RC transient output into a terminal-labelled waveform", () => {
    const fixture = design("RC low-pass", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 100e-9, polarized: false, voltageRating: 25 }),
      component("gnd", { kind: ComponentKind.Ground })
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "c1", "a"),
      wire("w3", "c1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);
    const request: SimulationRequest = {
      analysis: {
        type: SimulationAnalysisType.Transient,
        stepSeconds: 0.001,
        stopSeconds: 0.005,
        useInitialConditions: true
      },
      probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
    };
    const capturedVoltages = [
      0.002498750624687657,
      3.161917616283018,
      4.323439921218567,
      4.751315091767565,
      4.908590256028766,
      4.966440474385712
    ];

    const result = SpiceResultMapper.map({
      design: fixture,
      request,
      terminalNodeNames: {
        "c1:a": "n2",
        "c1:b": "0",
        "gnd:g": "0",
        "r1:a": "n1",
        "r1:b": "n2",
        "v1:negative": "0",
        "v1:positive": "n1"
      },
      componentElementNames: { c1: ["C1"], r1: ["R1"], v1: ["V1"] },
      payload: {
        simulationResultCircuitJson: [
          {
            type: SpicePayloadType.TransientVoltage,
            name: "n1",
            timestamps_ms: [0, 1, 2, 3, 4, 5],
            voltage_levels: [5, 5, 5, 5, 5, 5],
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 5
          },
          {
            type: SpicePayloadType.TransientVoltage,
            name: "n2",
            timestamps_ms: [0, 1, 2, 3, 4, 5],
            voltage_levels: capturedVoltages,
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 5
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "c1#branch",
            timestamps_ms: [0, 1, 2, 3, 4, 5],
            current_levels: [0.0005, 0.00018, 0.000067, 0.000025, 0.0000091, 0.0000034],
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 5
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "r1#branch",
            timestamps_ms: [0, 1, 2, 3, 4, 5],
            current_levels: [0.0005, 0.00018, 0.000067, 0.000025, 0.0000091, 0.0000034],
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 5
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "v1#branch",
            timestamps_ms: [0, 1, 2, 3, 4, 5],
            current_levels: [-0.0005, -0.00018, -0.000067, -0.000025, -0.0000091, -0.0000034],
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 5
          }
        ]
      }
    });

    expect(result.nodeVoltages["c1:a"]).toBeCloseTo(4.966440474385712, 12);
    expect(result.waveforms).toEqual([{
      id: "voltage:c1:a",
      label: "C1.a",
      quantity: SimulationWaveformQuantity.Voltage,
      axis: SimulationWaveformAxis.Time,
      componentId: "c1",
      terminalId: "a",
      points: capturedVoltages.map((y, index) => ({ x: index / 1000, y }))
    }]);
  });

  it("maps captured ngspice LED values with positive current magnitude and observable state", () => {
    const fixture = design("LED limiter", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 330, tolerance: 0.05 }),
      component("led1", { kind: ComponentKind.Led, forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: LedDisplayColor.Red }),
      component("gnd", { kind: ComponentKind.Ground })
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "led1", "anode"),
      wire("w3", "led1", "cathode", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = SpiceResultMapper.map({
      design: fixture,
      request: { analysis: { type: SimulationAnalysisType.OperatingPoint } },
      terminalNodeNames: {
        "gnd:g": "0",
        "led1:anode": "n2",
        "led1:cathode": "0",
        "r1:a": "n1",
        "r1:b": "n2",
        "v1:negative": "0",
        "v1:positive": "n1"
      },
      componentElementNames: { led1: ["D1"], r1: ["R1"], v1: ["V1"] },
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.OperatingPointVoltage, name: "n1", voltage: 5 },
          { type: SpicePayloadType.OperatingPointVoltage, name: "n2", voltage: 2.219429895198468 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@d1[id]", current: 0.008427204458883016 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r1[i]", current: 0.008425970014550099 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@v1[i]", current: -0.008425970014550099 }
        ]
      }
    });

    expect(result.components.led1).toMatchObject({
      voltageDrop: 2.219429895198468,
      currentAmps: 0.008427204458883016,
      state: "on"
    });
    expect(result.observableOutputs).toEqual([{
      componentId: "led1",
      label: "LED1",
      expectedState: "on"
    }]);
  });

  it("normalizes DC and AC sweep payloads into voltage series", () => {
    const fixture = voltageDivider();
    const baseInput = {
      design: fixture,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames
    };
    const dcResult = SpiceResultMapper.map({
      ...baseInput,
      request: {
        analysis: {
          type: SimulationAnalysisType.DcSweep,
          sourceComponentId: "v1",
          start: 0,
          stop: 2,
          step: 1
        },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }]
      },
      payload: {
        simulationResultCircuitJson: [
          {
            type: SpicePayloadType.DcSweepVoltage,
            name: "n1",
            sweep_values: [0, 1, 2],
            sweep_unit: SpiceDcSweepUnit.Volts,
            voltage_levels: [0, 1, 2]
          },
          {
            type: SpicePayloadType.DcSweepVoltage,
            name: "n2",
            sweep_values: [0, 1, 2],
            sweep_unit: SpiceDcSweepUnit.Volts,
            voltage_levels: [0, 0.5, 1]
          },
          {
            type: SpicePayloadType.DcSweepCurrent,
            name: "r1#branch",
            sweep_values: [0, 1, 2],
            sweep_unit: SpiceDcSweepUnit.Volts,
            current_levels: [0, 0.00005, 0.0001]
          },
          {
            type: SpicePayloadType.DcSweepCurrent,
            name: "r2#branch",
            sweep_values: [0, 1, 2],
            sweep_unit: SpiceDcSweepUnit.Volts,
            current_levels: [0, 0.00005, 0.0001]
          },
          {
            type: SpicePayloadType.DcSweepCurrent,
            name: "v1#branch",
            sweep_values: [0, 1, 2],
            sweep_unit: SpiceDcSweepUnit.Volts,
            current_levels: [0, -0.00005, -0.0001]
          }
        ]
      }
    });
    const acResult = SpiceResultMapper.map({
      ...baseInput,
      request: {
        analysis: {
          type: SimulationAnalysisType.AcSweep,
          sourceComponentId: "v1",
          scale: SimulationSweepScale.Decade,
          points: 1,
          startHertz: 10,
          stopHertz: 100
        },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }]
      },
      payload: {
        simulationResultCircuitJson: [
          {
            type: SpicePayloadType.AcSweepVoltage,
            name: "n1",
            frequencies_hz: [10, 100],
            complex_voltages: [{ re: 2, im: 0 }, { re: 1, im: 0 }]
          },
          {
            type: SpicePayloadType.AcSweepVoltage,
            name: "n2",
            frequencies_hz: [10, 100],
            complex_voltages: [{ re: 1, im: 0 }, { re: 0, im: -0.5 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "r1#branch",
            frequencies_hz: [10, 100],
            complex_currents: [{ re: 0.0001, im: 0 }, { re: 0.0001, im: 0.00005 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "r2#branch",
            frequencies_hz: [10, 100],
            complex_currents: [{ re: 0.0001, im: 0 }, { re: 0.0001, im: 0.00005 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "v1#branch",
            frequencies_hz: [10, 100],
            complex_currents: [{ re: -0.0001, im: 0 }, { re: -0.0001, im: -0.00005 }]
          }
        ]
      }
    });

    expect(dcResult.waveforms?.[0]).toMatchObject({
      axis: SimulationWaveformAxis.DcVoltage,
      points: [{ x: 0, y: 0 }, { x: 1, y: 0.5 }, { x: 2, y: 1 }]
    });
    expect(acResult.waveforms?.[0]).toMatchObject({
      axis: SimulationWaveformAxis.Frequency,
      points: [
        { x: 10, y: 1, phaseDegrees: 0 },
        { x: 100, y: 0.5, phaseDegrees: -90 }
      ]
    });
  });

  it("subtracts AC node phasors before calculating component voltage magnitude", () => {
    const fixture = design("AC RC low-pass", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 0, enabled: true }),
      component("r1", { kind: ComponentKind.Resistor, resistanceOhms: 1_000, tolerance: 0.05 }),
      component("c1", { kind: ComponentKind.Capacitor, capacitanceFarads: 1e-6, polarized: false, voltageRating: 25 }),
      component("gnd", { kind: ComponentKind.Ground })
    ], [
      wire("w1", "v1", "positive", "r1", "a"),
      wire("w2", "r1", "b", "c1", "a"),
      wire("w3", "c1", "b", "gnd", "g"),
      wire("w4", "v1", "negative", "gnd", "g")
    ]);

    const result = SpiceResultMapper.map({
      design: fixture,
      request: {
        analysis: {
          type: SimulationAnalysisType.AcSweep,
          sourceComponentId: "v1",
          scale: SimulationSweepScale.Decade,
          points: 1,
          startHertz: 1_000,
          stopHertz: 1_000
        },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "c1", terminalId: "a" }]
      },
      terminalNodeNames: {
        "c1:a": "n2",
        "c1:b": "0",
        "gnd:g": "0",
        "r1:a": "n1",
        "r1:b": "n2",
        "v1:negative": "0",
        "v1:positive": "n1"
      },
      componentElementNames: { c1: ["C1"], r1: ["R1"], v1: ["V1"] },
      payload: {
        simulationResultCircuitJson: [
          {
            type: SpicePayloadType.AcSweepVoltage,
            name: "n1",
            frequencies_hz: [1_000],
            complex_voltages: [{ re: 1, im: 0 }]
          },
          {
            type: SpicePayloadType.AcSweepVoltage,
            name: "n2",
            frequencies_hz: [1_000],
            complex_voltages: [{ re: 0.024704523031857648, im: -0.15522309613464763 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "c1#branch",
            frequencies_hz: [1_000],
            complex_currents: [{ re: 0.0009752954769681423, im: 0.00015522309613464763 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "r1#branch",
            frequencies_hz: [1_000],
            complex_currents: [{ re: 0.0009752954769681423, im: 0.00015522309613464763 }]
          },
          {
            type: SpicePayloadType.AcSweepCurrent,
            name: "v1#branch",
            frequencies_hz: [1_000],
            complex_currents: [{ re: -0.0009752954769681423, im: -0.00015522309613464763 }]
          }
        ]
      }
    });

    expect(result.components.r1?.voltageDrop).toBeCloseTo(0.9875704921513918, 12);
  });

  it("rejects a raw analysis type that does not match the requested analysis", () => {
    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [{
          type: SpicePayloadType.TransientVoltage,
          name: "n2",
          timestamps_ms: [0, 1],
          voltage_levels: [0, 1],
          time_per_step: 1,
          start_time_ms: 0,
          end_time_ms: 1
        }]
      }
    })).toThrow(/analysis.*operating point/i);
  });

  it("rejects partial vector coverage instead of fabricating missing component current or drop zeroes", () => {
    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.OperatingPointVoltage, name: "n1", voltage: 5 },
          { type: SpicePayloadType.OperatingPointVoltage, name: "n2", voltage: 2.5 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r1[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@v1[i]", current: -0.00025 }
        ]
      }
    })).toThrow(/missing.*r2/i);

    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.OperatingPointVoltage, name: "n2", voltage: 2.5 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r1[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r2[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@v1[i]", current: -0.00025 }
        ]
      }
    })).toThrow(/missing.*n1/i);
  });

  it("rejects unmapped vectors even when all expected vectors are present", () => {
    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.OperatingPointVoltage, name: "n1", voltage: 5 },
          { type: SpicePayloadType.OperatingPointVoltage, name: "n2", voltage: 2.5 },
          { type: SpicePayloadType.OperatingPointVoltage, name: "n99", voltage: 99 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r1[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@r2[i]", current: 0.00025 },
          { type: SpicePayloadType.OperatingPointCurrent, name: "@v1[i]", current: -0.00025 }
        ]
      }
    })).toThrow(/unmapped.*n99/i);
  });

  it("rejects series vectors whose sweep coordinates disagree", () => {
    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: {
        analysis: {
          type: SimulationAnalysisType.DcSweep,
          sourceComponentId: "v1",
          start: 0,
          stop: 2,
          step: 1
        }
      },
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.DcSweepVoltage, name: "n1", sweep_values: [0, 1, 2], sweep_unit: SpiceDcSweepUnit.Volts, voltage_levels: [0, 1, 2] },
          { type: SpicePayloadType.DcSweepVoltage, name: "n2", sweep_values: [0, 1, 2], sweep_unit: SpiceDcSweepUnit.Volts, voltage_levels: [0, 0.5, 1] },
          { type: SpicePayloadType.DcSweepCurrent, name: "r1#branch", sweep_values: [0, 1, 2], sweep_unit: SpiceDcSweepUnit.Volts, current_levels: [0, 0.00005, 0.0001] },
          { type: SpicePayloadType.DcSweepCurrent, name: "r2#branch", sweep_values: [0, 1, 3], sweep_unit: SpiceDcSweepUnit.Volts, current_levels: [0, 0.00005, 0.00015] },
          { type: SpicePayloadType.DcSweepCurrent, name: "v1#branch", sweep_values: [0, 1, 2], sweep_unit: SpiceDcSweepUnit.Volts, current_levels: [0, -0.00005, -0.0001] }
        ]
      }
    })).toThrow(/coordinates.*r2/i);
  });

  it("synthesizes an explicit ground waveform and retains a floating-point stop endpoint", () => {
    const result = SpiceResultMapper.map({
      design: voltageDivider(),
      request: {
        analysis: {
          type: SimulationAnalysisType.Transient,
          stepSeconds: 0.1,
          stopSeconds: 0.3
        },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "gnd", terminalId: "g" }]
      },
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.TransientVoltage, name: "n1", timestamps_ms: [0, 300], voltage_levels: [5, 5], time_per_step: 300, start_time_ms: 0, end_time_ms: 300 },
          { type: SpicePayloadType.TransientVoltage, name: "n2", timestamps_ms: [0, 300], voltage_levels: [2.5, 2.5], time_per_step: 300, start_time_ms: 0, end_time_ms: 300 },
          { type: SpicePayloadType.TransientCurrent, name: "r1#branch", timestamps_ms: [0, 300], current_levels: [0.00025, 0.00025], time_per_step: 300, start_time_ms: 0, end_time_ms: 300 },
          { type: SpicePayloadType.TransientCurrent, name: "r2#branch", timestamps_ms: [0, 300], current_levels: [0.00025, 0.00025], time_per_step: 300, start_time_ms: 0, end_time_ms: 300 },
          { type: SpicePayloadType.TransientCurrent, name: "v1#branch", timestamps_ms: [0, 300], current_levels: [-0.00025, -0.00025], time_per_step: 300, start_time_ms: 0, end_time_ms: 300 }
        ]
      }
    });

    expect(result.waveforms).toEqual([{
      id: "voltage:gnd:g",
      label: "GND.g",
      quantity: SimulationWaveformQuantity.Voltage,
      axis: SimulationWaveformAxis.Time,
      componentId: "gnd",
      terminalId: "g",
      points: [
        { x: 0, y: 0 },
        { x: 0.1, y: 0 },
        { x: 0.2, y: 0 },
        { x: 0.3, y: 0 }
      ]
    }]);
  });

  it("maps a colon-bearing component id without parsing the composite terminal key", () => {
    const fixture = design("Colon id", [
      component("v1", { kind: ComponentKind.DcSource, voltage: 5, enabled: true }),
      component("r:1", { kind: ComponentKind.Resistor, resistanceOhms: 1_000, tolerance: 0.05 }),
      component("gnd", { kind: ComponentKind.Ground })
    ], [
      wire("w1", "v1", "positive", "r:1", "a"),
      wire("w2", "r:1", "b", "gnd", "g"),
      wire("w3", "v1", "negative", "gnd", "g")
    ]);
    const result = SpiceResultMapper.map({
      design: fixture,
      request: {
        analysis: { type: SimulationAnalysisType.Transient, stepSeconds: 0.1, stopSeconds: 0.2 },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r:1", terminalId: "a" }]
      },
      terminalNodeNames: {
        "gnd:g": "0",
        "r:1:a": "n1",
        "r:1:b": "0",
        "v1:negative": "0",
        "v1:positive": "n1"
      },
      componentElementNames: { "r:1": ["R1"], v1: ["V1"] },
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.TransientVoltage, name: "n1", timestamps_ms: [0, 200], voltage_levels: [5, 5], time_per_step: 200, start_time_ms: 0, end_time_ms: 200 },
          { type: SpicePayloadType.TransientCurrent, name: "r1#branch", timestamps_ms: [0, 200], current_levels: [0.005, 0.005], time_per_step: 200, start_time_ms: 0, end_time_ms: 200 },
          { type: SpicePayloadType.TransientCurrent, name: "v1#branch", timestamps_ms: [0, 200], current_levels: [-0.005, -0.005], time_per_step: 200, start_time_ms: 0, end_time_ms: 200 }
        ]
      }
    });

    expect(result.waveforms?.[0]).toMatchObject({
      id: "voltage:r:1:a",
      componentId: "r:1",
      terminalId: "a"
    });
  });

  it("bounds a huge transient request before allocating its requested coordinate grid", () => {
    const result = SpiceResultMapper.map({
      design: voltageDivider(),
      request: {
        analysis: {
          type: SimulationAnalysisType.Transient,
          stepSeconds: 1e-12,
          stopSeconds: 10
        },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }]
      },
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          { type: SpicePayloadType.TransientVoltage, name: "n1", timestamps_ms: [0, 10_000], voltage_levels: [5, 5], time_per_step: 10_000, start_time_ms: 0, end_time_ms: 10_000 },
          { type: SpicePayloadType.TransientVoltage, name: "n2", timestamps_ms: [0, 10_000], voltage_levels: [0, 2.5], time_per_step: 10_000, start_time_ms: 0, end_time_ms: 10_000 },
          { type: SpicePayloadType.TransientCurrent, name: "r1#branch", timestamps_ms: [0, 10_000], current_levels: [0, 0.00025], time_per_step: 10_000, start_time_ms: 0, end_time_ms: 10_000 },
          { type: SpicePayloadType.TransientCurrent, name: "r2#branch", timestamps_ms: [0, 10_000], current_levels: [0, 0.00025], time_per_step: 10_000, start_time_ms: 0, end_time_ms: 10_000 },
          { type: SpicePayloadType.TransientCurrent, name: "v1#branch", timestamps_ms: [0, 10_000], current_levels: [0, -0.00025], time_per_step: 10_000, start_time_ms: 0, end_time_ms: 10_000 }
        ]
      }
    });

    expect(result.waveforms?.[0]?.points).toHaveLength(SpiceResultMapper.MaximumWaveformPoints);
    expect(result.waveforms?.[0]?.points[0]?.x).toBe(0);
    expect(result.waveforms?.[0]?.points.at(-1)?.x).toBe(10);
  });

  it("zeros numerical noise using explicit tolerances and caps a waveform before returning state data", () => {
    const fixture = voltageDivider();
    const sourcePoints = Array.from({ length: 1_501 }, (_, index) => index);
    const nearZeroVoltages = sourcePoints.map(() => 1e-12);
    const nearZeroCurrents = sourcePoints.map(() => -1e-15);
    const dividerCurrents = sourcePoints.map(() => 0.00025);
    const result = SpiceResultMapper.map({
      design: fixture,
      request: {
        analysis: { type: SimulationAnalysisType.Transient, stepSeconds: 0.001, stopSeconds: 1.5 },
        probes: [{ kind: SimulationProbeKind.NodeVoltage, componentId: "r2", terminalId: "a" }]
      },
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [
          {
            type: SpicePayloadType.TransientVoltage,
            name: "n1",
            timestamps_ms: sourcePoints,
            voltage_levels: nearZeroVoltages,
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 1_500
          },
          {
            type: SpicePayloadType.TransientVoltage,
            name: "n2",
            timestamps_ms: sourcePoints,
            voltage_levels: sourcePoints,
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 1_500
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "r1#branch",
            timestamps_ms: sourcePoints,
            current_levels: nearZeroCurrents,
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 1_500
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "r2#branch",
            timestamps_ms: sourcePoints,
            current_levels: dividerCurrents,
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 1_500
          },
          {
            type: SpicePayloadType.TransientCurrent,
            name: "v1#branch",
            timestamps_ms: sourcePoints,
            current_levels: dividerCurrents.map((value) => -value),
            time_per_step: 1,
            start_time_ms: 0,
            end_time_ms: 1_500
          }
        ]
      }
    });

    expect(result.nodeVoltages["r1:a"]).toBe(0);
    expect(result.branchCurrents.r1).toBe(0);
    expect(result.waveforms?.[0]?.points).toHaveLength(1_000);
    expect(result.waveforms?.[0]?.points[0]).toEqual({ x: 0, y: 0 });
    expect(result.waveforms?.[0]?.points.at(-1)).toEqual({ x: 1.5, y: 1_500 });
  });

  it("rejects malformed package payloads before they reach ProbePilot state", () => {
    expect(() => SpiceResultMapper.map({
      design: voltageDivider(),
      request: operatingPointRequest,
      terminalNodeNames: dividerTerminalNodes,
      componentElementNames: dividerElementNames,
      payload: {
        simulationResultCircuitJson: [{
          type: SpicePayloadType.OperatingPointVoltage,
          name: "n2",
          voltage: Number.NaN
        }]
      }
    })).toThrow(/invalid SPICE engine payload/i);
  });
});
