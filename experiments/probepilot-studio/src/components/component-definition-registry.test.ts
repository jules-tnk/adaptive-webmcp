import { describe, expect, it } from "vitest";
import { ComponentCapability } from "./component-capability";
import { TerminalSide } from "./component-definition";
import { ComponentDefinitionRegistry } from "./component-definition-registry";
import { TscircuitSymbolAdapter } from "@/tscircuit/tscircuit-symbol-adapter";
import {
  BatteryStandard,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  type ComponentKindValue
} from "@/domain/types";
import { mergeComponentProperties } from "@/domain/catalog";

type ExpectedDefinition = {
  kind: ComponentKindValue;
  prefix: string;
  symbolName: string;
  defaultFootprint: string;
  terminals: readonly string[];
  defaultProperties: Record<string, boolean | number | string>;
  capabilities: readonly ComponentCapability[];
};

const catalog: readonly ExpectedDefinition[] = [
  { kind: "dc_source", prefix: "V", symbolName: "dc_voltmeter_right", defaultFootprint: "terminal block", terminals: ["positive", "negative"], defaultProperties: { kind: "dc_source", voltage: 9, enabled: true }, capabilities: [ComponentCapability.Design, ComponentCapability.Bench] },
  { kind: "ground", prefix: "GND", symbolName: "ground_down", defaultFootprint: "test point", terminals: ["g"], defaultProperties: { kind: "ground" }, capabilities: [ComponentCapability.Design, ComponentCapability.Bench] },
  { kind: "resistor", prefix: "R", symbolName: "resistor_right", defaultFootprint: "0805", terminals: ["a", "b"], defaultProperties: { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 }, capabilities: [ComponentCapability.Design, ComponentCapability.Bench] },
  { kind: "led", prefix: "LED", symbolName: "led_right", defaultFootprint: "0805", terminals: ["anode", "cathode"], defaultProperties: { kind: "led", forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: "red" }, capabilities: [ComponentCapability.Design, ComponentCapability.Bench] },
  { kind: "switch", prefix: "SW", symbolName: "spst_switch_right", defaultFootprint: "SW_THT", terminals: ["a", "b"], defaultProperties: { kind: "switch", closed: true }, capabilities: [ComponentCapability.Design, ComponentCapability.Bench] },
  { kind: "battery", prefix: "B", symbolName: "battery_right", defaultFootprint: "battery connector", terminals: ["positive", "negative"], defaultProperties: { kind: "battery", voltage: 9, capacityMilliampHours: 500, standard: "9V" }, capabilities: [ComponentCapability.Design] },
  { kind: "current_source", prefix: "I", symbolName: "current_source_right", defaultFootprint: "test point pair", terminals: ["positive", "negative"], defaultProperties: { kind: "current_source", currentAmps: 0.02, enabled: true }, capabilities: [ComponentCapability.Design] },
  { kind: "capacitor", prefix: "C", symbolName: "capacitor_right", defaultFootprint: "0805", terminals: ["a", "b"], defaultProperties: { kind: "capacitor", capacitanceFarads: 0.000001, polarized: false, voltageRating: 25 }, capabilities: [ComponentCapability.Design] },
  { kind: "inductor", prefix: "L", symbolName: "inductor_right", defaultFootprint: "0805", terminals: ["a", "b"], defaultProperties: { kind: "inductor", inductanceHenries: 0.001, maxCurrentAmps: 0.1 }, capabilities: [ComponentCapability.Design] },
  { kind: "diode", prefix: "D", symbolName: "diode_right", defaultFootprint: "SOD-123", terminals: ["anode", "cathode"], defaultProperties: { kind: "diode", forwardVoltage: 0.7 }, capabilities: [ComponentCapability.Design] },
  { kind: "zener_diode", prefix: "D", symbolName: "zener_diode_horz", defaultFootprint: "SOD-123", terminals: ["anode", "cathode"], defaultProperties: { kind: "zener_diode", zenerVoltage: 5.1 }, capabilities: [ComponentCapability.Design] },
  { kind: "schottky_diode", prefix: "D", symbolName: "schottky_diode_right", defaultFootprint: "SOD-123", terminals: ["anode", "cathode"], defaultProperties: { kind: "schottky_diode", forwardVoltage: 0.3 }, capabilities: [ComponentCapability.Design] },
  { kind: "fuse", prefix: "F", symbolName: "fuse_horz", defaultFootprint: "1206", terminals: ["a", "b"], defaultProperties: { kind: "fuse", currentRatingAmps: 1, voltageRating: 32 }, capabilities: [ComponentCapability.Design] },
  { kind: "potentiometer", prefix: "RV", symbolName: "potentiometer3_right", defaultFootprint: "POT_THT", terminals: ["a", "wiper", "b"], defaultProperties: { kind: "potentiometer", resistanceOhms: 10000, wiperPosition: 0.5 }, capabilities: [ComponentCapability.Design] },
  { kind: "push_button", prefix: "SW", symbolName: "push_button_normally_open_momentary_right", defaultFootprint: "SW_THT", terminals: ["a", "b"], defaultProperties: { kind: "push_button", pressed: false }, capabilities: [ComponentCapability.Design] },
  { kind: "spdt_switch", prefix: "SW", symbolName: "spdt_switch_right", defaultFootprint: "SW_THT", terminals: ["common", "a", "b"], defaultProperties: { kind: "spdt_switch", position: "a" }, capabilities: [ComponentCapability.Design] },
  { kind: "npn_bjt", prefix: "Q", symbolName: "npn_bipolar_transistor_right", defaultFootprint: "TO-92", terminals: ["collector", "base", "emitter"], defaultProperties: { kind: "npn_bjt", beta: 100 }, capabilities: [ComponentCapability.Design] },
  { kind: "pnp_bjt", prefix: "Q", symbolName: "pnp_bipolar_transistor_right", defaultFootprint: "TO-92", terminals: ["collector", "base", "emitter"], defaultProperties: { kind: "pnp_bjt", beta: 100 }, capabilities: [ComponentCapability.Design] },
  { kind: "n_channel_mosfet", prefix: "Q", symbolName: "n_channel_e_mosfet_transistor_horz", defaultFootprint: "TO-220", terminals: ["drain", "gate", "source"], defaultProperties: { kind: "n_channel_mosfet", channel: "n", mode: "enhancement" }, capabilities: [ComponentCapability.Design] },
  { kind: "p_channel_mosfet", prefix: "Q", symbolName: "p_channel_e_mosfet_transistor_horz", defaultFootprint: "TO-220", terminals: ["drain", "gate", "source"], defaultProperties: { kind: "p_channel_mosfet", channel: "p", mode: "enhancement" }, capabilities: [ComponentCapability.Design] },
  { kind: "op_amp", prefix: "U", symbolName: "opamp_with_power_right", defaultFootprint: "DIP-8", terminals: ["inverting_input", "non_inverting_input", "output", "positive_supply", "negative_supply"], defaultProperties: { kind: "op_amp", gain: 100000 }, capabilities: [ComponentCapability.Design] }
];

const verifiedSpiceKinds = new Set(catalog.slice(0, 16).map((definition) => definition.kind));

describe("ComponentDefinitionRegistry", () => {
  it.each(catalog)("preserves the declared $kind component contract", (expected) => {
    const definition = ComponentDefinitionRegistry.get(expected.kind);

    expect(definition.prefix).toBe(expected.prefix);
    expect(definition.symbolName).toBe(expected.symbolName);
    expect(definition.defaultFootprint).toBe(expected.defaultFootprint);
    expect(definition.terminals.map((terminal) => terminal.id)).toEqual(expected.terminals);
    expect(definition.defaultProperties).toEqual(expected.defaultProperties);
    const expectedCapabilities = verifiedSpiceKinds.has(expected.kind)
      ? expected.capabilities.includes(ComponentCapability.Bench)
        ? [ComponentCapability.Design, ComponentCapability.Spice, ComponentCapability.Bench]
        : [ComponentCapability.Design, ComponentCapability.Spice]
      : expected.capabilities;
    expect([...definition.capabilities]).toEqual(expectedCapabilities);
  });

  it("exposes exactly the initial 21 component definitions", () => {
    expect(ComponentDefinitionRegistry.list().map((definition) => definition.kind)).toEqual(catalog.map((definition) => definition.kind));
  });

  it("filters and checks capabilities from the registry", () => {
    expect(ComponentDefinitionRegistry.supports("resistor", ComponentCapability.Bench)).toBe(true);
    expect(ComponentDefinitionRegistry.supports("capacitor", ComponentCapability.Bench)).toBe(false);
    expect(ComponentDefinitionRegistry.list().filter((definition) => definition.capabilities.has(ComponentCapability.Spice))).toHaveLength(16);
  });

  it("normalizes SI resistor values through the tsCircuit parser", () => {
    const parsed = ComponentDefinitionRegistry.get("resistor").propertySchema.parse({
      kind: "resistor",
      resistanceOhms: "10k"
    });

    expect(parsed).toEqual({ kind: "resistor", resistanceOhms: 10000, tolerance: 0.05 });
  });

  it("normalizes resistor tolerance percentages through the registry parser", () => {
    expect(ComponentDefinitionRegistry.get("resistor").propertySchema.parse({ kind: "resistor", resistanceOhms: "10k", tolerance: "5%" })).toEqual({ kind: "resistor", resistanceOhms: 10_000, tolerance: 0.05 });
  });

  it("uses authoritative enums for deterministic property defaults and parser output", () => {
    expect(ComponentDefinitionRegistry.get("battery").defaultProperties).toMatchObject({ standard: BatteryStandard.NineVolt });
    expect(ComponentDefinitionRegistry.get("led").defaultProperties).toMatchObject({ displayColor: LedDisplayColor.Red });
    expect(ComponentDefinitionRegistry.get("spdt_switch").defaultProperties).toMatchObject({ position: SpdtPosition.A });
    expect(ComponentDefinitionRegistry.get("n_channel_mosfet").defaultProperties).toMatchObject({ channel: MosfetChannel.N, mode: MosfetMode.Enhancement });
    expect(ComponentDefinitionRegistry.get("battery").propertySchema.parse({ kind: "battery", voltage: "9V", capacityMilliampHours: "500", standard: BatteryStandard.NineVolt })).toMatchObject({ standard: BatteryStandard.NineVolt });
    expect(ComponentDefinitionRegistry.get("led").propertySchema.parse({ kind: "led", forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: LedDisplayColor.Green })).toMatchObject({ displayColor: LedDisplayColor.Green });
    expect(ComponentDefinitionRegistry.get("spdt_switch").propertySchema.parse({ kind: "spdt_switch", position: SpdtPosition.B })).toMatchObject({ position: SpdtPosition.B });
    expect(ComponentDefinitionRegistry.get("p_channel_mosfet").propertySchema.parse({ kind: "p_channel_mosfet", channel: MosfetChannel.P, mode: MosfetMode.Depletion })).toMatchObject({ channel: MosfetChannel.P, mode: MosfetMode.Depletion });
  });

  it("maps every op-amp terminal onto the pinned five-port tsCircuit symbol", () => {
    const definition = ComponentDefinitionRegistry.get("op_amp");

    expect(definition.symbolName).toBe("opamp_with_power_right");
    expect(definition.terminals.map((terminal) => terminal.side)).toEqual([TerminalSide.Left, TerminalSide.Left, TerminalSide.Right, TerminalSide.Top, TerminalSide.Bottom]);
    expect(TscircuitSymbolAdapter.portAliases(definition)).toHaveLength(definition.terminals.length);
    expect(TscircuitSymbolAdapter.portAliases(definition)).toEqual([["1", "inp1"], ["2", "inp2"], ["4", "out"], ["5", "V+"], ["3", "V-"]]);
  });

  it.each(["dc_source", "battery", "current_source"] as const)("keeps %s power terminals on opposite symbol sides", (kind) => {
    const definition = ComponentDefinitionRegistry.get(kind);
    const coordinates = TscircuitSymbolAdapter.terminalCoordinates(definition);

    expect(definition.terminals.map((terminal) => terminal.side)).toEqual([TerminalSide.Left, TerminalSide.Right]);
    expect(coordinates.map((coordinate) => coordinate.button.x)).toEqual([expect.closeTo(0, 4), expect.closeTo(1, 4)]);
  });

  it.each([0, -1, 24.1, "0", "-1", "25V"] as const)("rejects out-of-range DC source voltage %s before normalization", (voltage) => {
    const current = ComponentDefinitionRegistry.get("dc_source").defaultProperties;

    expect(() => mergeComponentProperties("dc_source", current, { voltage })).toThrow();
  });

  it.each([0, -1, 10_000_001, "0", "-1", "11M"] as const)("rejects out-of-range resistance %s before normalization", (resistanceOhms) => {
    const current = ComponentDefinitionRegistry.get("resistor").defaultProperties;

    expect(() => mergeComponentProperties("resistor", current, { resistanceOhms })).toThrow();
  });

  it("accepts bounded numeric and SI-string source and resistor values", () => {
    const source = ComponentDefinitionRegistry.get("dc_source").defaultProperties;
    const resistor = ComponentDefinitionRegistry.get("resistor").defaultProperties;

    expect(mergeComponentProperties("dc_source", source, { voltage: "0.1V" })).toEqual({ kind: "dc_source", voltage: 0.1, enabled: true });
    expect(mergeComponentProperties("dc_source", source, { voltage: "24V" })).toEqual({ kind: "dc_source", voltage: 24, enabled: true });
    expect(mergeComponentProperties("resistor", resistor, { resistanceOhms: "1" })).toEqual({ kind: "resistor", resistanceOhms: 1, tolerance: 0.05 });
    expect(mergeComponentProperties("resistor", resistor, { resistanceOhms: "10M" })).toEqual({ kind: "resistor", resistanceOhms: 10_000_000, tolerance: 0.05 });
  });

  it("accepts bare and unit-bearing capacity, voltage, and current inputs", () => {
    expect(ComponentDefinitionRegistry.get("battery").propertySchema.parse({ kind: "battery", voltage: "9V", capacityMilliampHours: "500mAh", standard: BatteryStandard.NineVolt })).toMatchObject({ voltage: 9, capacityMilliampHours: 500 });
    expect(ComponentDefinitionRegistry.get("capacitor").propertySchema.parse({ kind: "capacitor", capacitanceFarads: "1uF", polarized: false, voltageRating: "25V" })).toMatchObject({ voltageRating: 25 });
    expect(ComponentDefinitionRegistry.get("fuse").propertySchema.parse({ kind: "fuse", currentRatingAmps: "500mA", voltageRating: "32V" })).toMatchObject({ currentRatingAmps: 0.5, voltageRating: 32 });
  });
});
