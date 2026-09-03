import { any_circuit_element, type AnyCircuitElement } from "circuit-json";
import { describe, expect, it } from "vitest";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { createDemoDesign } from "@/domain/fixtures";
import {
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  type CircuitComponent,
  type CircuitDesign,
  type CircuitWire,
  type ComponentProperties,
  type LedProperties
} from "@/domain/types";
import { finalizeCircuitJsonElements, TscircuitAdapter } from "./tscircuit-adapter";
import { TscircuitDiagnosticCode, TscircuitDiagnosticSeverity } from "./tscircuit-diagnostics";

function component(id: string, label: string, properties: ComponentProperties, x = 100, y = 100): CircuitComponent {
  return {
    id,
    kind: properties.kind,
    label,
    position: { x, y },
    properties,
    agentLocked: false,
    createdBy: "human",
    lastModifiedBy: "human"
  };
}

function design(components: CircuitComponent[], wires: CircuitWire[] = []): CircuitDesign {
  return {
    schemaVersion: 1,
    id: "fixture",
    name: "Adapter fixture",
    revision: 1,
    components: Object.fromEntries(components.map((item) => [item.id, item])),
    wires: Object.fromEntries(wires.map((item) => [item.id, item]))
  };
}

function element(result: readonly AnyCircuitElement[], type: AnyCircuitElement["type"], id: string): AnyCircuitElement {
  const match = result.find((item) => item.type === type && Object.values(item).includes(id));
  if (!match) throw new Error(`Missing ${type} ${id}.`);
  return match;
}

function circuitElementId(item: AnyCircuitElement): string | undefined {
  if (item.type === "source_component") return item.source_component_id;
  if (item.type === "source_port") return item.source_port_id;
  if (item.type === "source_trace") return item.source_trace_id;
  if (item.type === "schematic_component") return item.schematic_component_id;
  if (item.type === "schematic_port") return item.schematic_port_id;
  if (item.type === "schematic_trace") return item.schematic_trace_id;
  return undefined;
}

describe("TscircuitAdapter", () => {
  it("converts the switched LED into complete, schema-valid source and schematic layers", () => {
    const designFixture = createDemoDesign();

    const result = TscircuitAdapter.toCircuitJson(designFixture);

    expect(result.diagnostics).toEqual([]);
    expect(result.elements).toHaveLength(38);
    expect(result.elements.map((item) => any_circuit_element.parse(item))).toEqual(result.elements);
    expect(element(result.elements, "source_component", "source_component_v1")).toMatchObject({
      ftype: "simple_voltage_source",
      name: "V1",
      source_component_id: "source_component_v1",
      voltage: 9
    });
    expect(element(result.elements, "source_port", "source_port_2:v18:positive")).toMatchObject({
      name: "positive",
      pin_number: 1,
      port_hints: ["positive", "1"],
      source_component_id: "source_component_v1"
    });
    expect(element(result.elements, "source_trace", "source_trace_w1")).toMatchObject({
      connected_source_net_ids: [],
      connected_source_port_ids: ["source_port_2:v18:positive", "source_port_3:sw11:a"]
    });
    expect(element(result.elements, "schematic_component", "schematic_component_led1")).toMatchObject({
      source_component_id: "source_component_led1",
      symbol_name: ComponentDefinitionRegistry.get("led").symbolName
    });
    expect(element(result.elements, "schematic_port", "schematic_port_4:led15:anode")).toMatchObject({
      source_port_id: "source_port_4:led15:anode",
      schematic_component_id: "schematic_component_led1"
    });
    expect(element(result.elements, "schematic_trace", "schematic_trace_w3")).toMatchObject({
      source_trace_id: "source_trace_w3"
    });
  });

  it.each([
    {
      name: "RC network",
      fixture: design([
        component("r-rc", "R1", { kind: "resistor", resistanceOhms: 10_000, tolerance: 0.01 }, 100, 100),
        component("c-rc", "C1", { kind: "capacitor", capacitanceFarads: 0.000001, polarized: false, voltageRating: 25 }, 300, 100)
      ], [{ id: "w-rc", a: { componentId: "r-rc", terminalId: "b" }, b: { componentId: "c-rc", terminalId: "a" }, createdBy: "human" }]),
      expected: [
        { id: "source_component_r-rc", ftype: "simple_resistor", resistance: 10_000 },
        { id: "source_component_c-rc", ftype: "simple_capacitor", capacitance: 0.000001, max_voltage_rating: 25 }
      ]
    },
    {
      name: "diode",
      fixture: design([component("d1", "D1", { kind: "diode", forwardVoltage: 0.7 })]),
      expected: [{ id: "source_component_d1", ftype: "simple_diode" }]
    },
    {
      name: "SPDT switch",
      fixture: design([component("sw2", "SW2", { kind: "spdt_switch", position: SpdtPosition.B })]),
      expected: [{ id: "source_component_sw2", ftype: "simple_switch" }]
    },
    {
      name: "transistor",
      fixture: design([component("q1", "Q1", { kind: "npn_bjt", beta: 150 })]),
      expected: [{ id: "source_component_q1", ftype: "simple_transistor", transistor_type: "npn" }]
    }
  ])("maps the registry-backed $name fixture", ({ fixture, expected }) => {
    const result = TscircuitAdapter.toCircuitJson(fixture);

    expect(result.diagnostics).toEqual([]);
    for (const expectation of expected) {
      const { id, ...properties } = expectation;
      expect(element(result.elements, "source_component", id)).toMatchObject(properties);
    }
  });

  it("returns no elements when a wire references an invalid terminal", () => {
    const invalid = design(
      [component("r1", "R1", { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 })],
      [{ id: "bad-wire", a: { componentId: "r1", terminalId: "not-a-terminal" }, b: { componentId: "r1", terminalId: "b" }, createdBy: "human" }]
    );

    const result = TscircuitAdapter.toCircuitJson(invalid);

    expect(result.elements).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: TscircuitDiagnosticCode.InvalidTerminalReference,
        severity: TscircuitDiagnosticSeverity.Error,
        affectedIds: ["bad-wire", "r1"]
      })
    ]);
  });

  it("uses injective compound IDs for unrestricted component and terminal IDs", () => {
    const collisionFixture = design(
      [
        component("x", "U1", { kind: "op_amp", gain: 100_000 }, 100, 100),
        component("x_non", "U2", { kind: "op_amp", gain: 100_000 }, 300, 100)
      ],
      [{
        id: "wire_with_unrestricted_id",
        a: { componentId: "x", terminalId: "non_inverting_input" },
        b: { componentId: "x_non", terminalId: "inverting_input" },
        createdBy: "human"
      }]
    );

    const result = TscircuitAdapter.toCircuitJson(collisionFixture);
    const ids = result.elements.map(circuitElementId).filter((id): id is string => id !== undefined);
    const sourcePorts = result.elements.filter((item) => item.type === "source_port");
    const firstPort = sourcePorts.find((item) => item.source_component_id === "source_component_x" && item.name === "non_inverting_input");
    const secondPort = sourcePorts.find((item) => item.source_component_id === "source_component_x_non" && item.name === "inverting_input");

    expect(result.diagnostics).toEqual([]);
    expect(firstPort?.source_port_id).toBeDefined();
    expect(secondPort?.source_port_id).toBeDefined();
    expect(firstPort?.source_port_id).not.toBe(secondPort?.source_port_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reports only invalid properties when an existing component with bad properties is wired", () => {
    const invalidProperties = design(
      [
        component("invalid-r", "R1", { kind: "resistor", resistanceOhms: -1, tolerance: 0.05 }),
        component("valid-r", "R2", { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 })
      ],
      [{ id: "attached-wire", a: { componentId: "invalid-r", terminalId: "b" }, b: { componentId: "valid-r", terminalId: "a" }, createdBy: "human" }]
    );

    const result = TscircuitAdapter.toCircuitJson(invalidProperties);

    expect(result.elements).toEqual([]);
    expect(result.diagnostics).toEqual([{
      code: TscircuitDiagnosticCode.InvalidComponentProperties,
      severity: TscircuitDiagnosticSeverity.Error,
      message: "Component invalid-r has properties that do not match the Resistor registry schema.",
      affectedIds: ["invalid-r"]
    }]);
  });

  it("converts every registry default and preserves each strict terminal alias", () => {
    const registryComponents = ComponentDefinitionRegistry.list().map((definition, index) =>
      component(definition.kind, `${definition.prefix}${index + 1}`, definition.defaultProperties, index * 50, index * 25)
    );

    const result = TscircuitAdapter.toCircuitJson(design(registryComponents));

    expect(result.diagnostics).toEqual([]);
    expect(result.elements.filter((item) => item.type === "source_component")).toHaveLength(ComponentDefinitionRegistry.list().length);
    for (const definition of ComponentDefinitionRegistry.list()) {
      for (const terminal of definition.terminals) {
        const port = result.elements.find((item) =>
          item.type === "source_port" &&
          item.source_component_id === `source_component_${definition.kind}` &&
          item.name === terminal.id
        );
        expect(port).toMatchObject({
          name: terminal.id,
          port_hints: [terminal.id, terminal.symbolPortAlias]
        });
      }
    }
  });

  it("uses matched numeric symbol aliases for MOSFET and op-amp Circuit JSON pins", () => {
    const fixture = design([
      component("q-mosfet", "Q1", { kind: "n_channel_mosfet", channel: MosfetChannel.N, mode: MosfetMode.Enhancement }),
      component("u-opamp", "U1", { kind: "op_amp", gain: 100_000 })
    ]);

    const result = TscircuitAdapter.toCircuitJson(fixture);
    const sourcePins = result.elements
      .filter((item) => item.type === "source_port")
      .map((item) => [item.source_component_id, item.name, item.pin_number]);
    const schematicPins = result.elements
      .filter((item) => item.type === "schematic_port")
      .map((item) => [item.schematic_component_id, item.display_pin_label, item.pin_number]);

    expect(result.diagnostics).toEqual([]);
    expect(sourcePins).toEqual([
      ["source_component_q-mosfet", "drain", 1],
      ["source_component_q-mosfet", "gate", 3],
      ["source_component_q-mosfet", "source", 2],
      ["source_component_u-opamp", "inverting_input", 2],
      ["source_component_u-opamp", "non_inverting_input", 1],
      ["source_component_u-opamp", "output", 4],
      ["source_component_u-opamp", "positive_supply", 5],
      ["source_component_u-opamp", "negative_supply", 3]
    ]);
    expect(schematicPins).toEqual([
      ["schematic_component_q-mosfet", "Drain", 1],
      ["schematic_component_q-mosfet", "Gate", 3],
      ["schematic_component_q-mosfet", "Source", 2],
      ["schematic_component_u-opamp", "Inverting input", 2],
      ["schematic_component_u-opamp", "Non-inverting input", 1],
      ["schematic_component_u-opamp", "Output", 4],
      ["schematic_component_u-opamp", "Positive supply", 5],
      ["schematic_component_u-opamp", "Negative supply", 3]
    ]);
  });

  it("returns no partial output when final Circuit JSON schema validation fails", () => {
    const invalidPosition = design([
      component("d1", "D1", { kind: "diode", forwardVoltage: 0.7 }, Number.NaN, 100)
    ]);

    const result = TscircuitAdapter.toCircuitJson(invalidPosition);

    expect(result.elements).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: TscircuitDiagnosticCode.CircuitJsonValidationFailed,
        severity: TscircuitDiagnosticSeverity.Error
      })
    ]);
  });

  it("rejects duplicate Circuit JSON IDs as an all-or-nothing collection failure", () => {
    const valid = TscircuitAdapter.toCircuitJson(createDemoDesign());
    const trace = valid.elements.find((item) => item.type === "schematic_trace");
    if (!trace) throw new Error("Expected the demo fixture to emit a schematic trace.");

    const result = finalizeCircuitJsonElements([...valid.elements, trace]);

    expect(result.elements).toEqual([]);
    expect(result.diagnostics).toEqual([{
      code: TscircuitDiagnosticCode.DuplicateCircuitJsonId,
      severity: TscircuitDiagnosticSeverity.Error,
      message: `Circuit JSON ID ${trace.schematic_trace_id} resolves more than once.`,
      affectedIds: [trace.schematic_trace_id]
    }]);
  });

  it("rejects unresolved Circuit JSON references as an all-or-nothing collection failure", () => {
    const valid = TscircuitAdapter.toCircuitJson(createDemoDesign());
    let replaced = false;
    const unresolved = valid.elements.map((item): AnyCircuitElement => {
      if (!replaced && item.type === "schematic_trace") {
        replaced = true;
        return { ...item, source_trace_id: "missing_source_trace" };
      }
      return item;
    });

    const result = finalizeCircuitJsonElements(unresolved);

    expect(result.elements).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: TscircuitDiagnosticCode.InvalidCircuitJsonReference,
        severity: TscircuitDiagnosticSeverity.Error,
        affectedIds: [expect.stringMatching(/^schematic_trace_/), "missing_source_trace"]
      })
    ]);
  });

  it("serializes only public design fields and strips private bench-shaped additions", () => {
    const privateFault = "private-fault-open-wire-w3";
    const privateBenchId = "bench-private-123";
    const publicDesign = createDemoDesign();
    const contaminatedProperties: LedProperties & { privateFault: string; privateBenchId: string } = {
      kind: "led",
      forwardVoltage: 2,
      maxCurrentMilliamps: 25,
      displayColor: LedDisplayColor.Red,
      privateFault,
      privateBenchId
    };
    const contaminatedLed: CircuitComponent & { privateFault: string; privateBenchId: string } = {
      ...publicDesign.components.led1,
      kind: "led",
      properties: contaminatedProperties,
      privateFault,
      privateBenchId
    };
    const contaminated: CircuitDesign & { benchId: string; fault: string } = {
      ...publicDesign,
      benchId: privateBenchId,
      fault: privateFault,
      components: {
        ...publicDesign.components,
        led1: contaminatedLed
      }
    };

    const result = TscircuitAdapter.toCircuitJson(contaminated);
    const serialized = JSON.stringify(result.elements);

    expect(result.diagnostics).toEqual([]);
    expect(serialized).not.toContain(privateFault);
    expect(serialized).not.toContain(privateBenchId);
    expect(serialized).not.toContain("agentLocked");
    expect(serialized).not.toContain("createdBy");
    expect(serialized).not.toContain("lastModifiedBy");
  });

  it("maps LED public display properties without copying unrelated fields", () => {
    const fixture = design([
      component("led-green", "LED2", {
        kind: "led",
        forwardVoltage: 2.2,
        maxCurrentMilliamps: 20,
        displayColor: LedDisplayColor.Green
      })
    ]);

    const result = TscircuitAdapter.toCircuitJson(fixture);

    expect(element(result.elements, "source_component", "source_component_led-green")).toMatchObject({
      ftype: "simple_led",
      color: "green"
    });
  });
});
