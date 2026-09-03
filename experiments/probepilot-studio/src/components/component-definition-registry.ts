import { ComponentCapability, ComponentCategory } from "./component-capability";
import type { ComponentDefinition, TerminalDefinition } from "./component-definition";
import { PropertyFieldDefinitions } from "./property-field-definition";
import { TscircuitPropertyAdapter } from "@/tscircuit/tscircuit-property-adapter";
import { TscircuitSymbolName } from "@/tscircuit/tscircuit-symbol-name";
import {
  BatteryStandard,
  ComponentKind,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  TerminalSide,
  type ComponentKindValue
} from "@/domain/types";

const {
  sourceSchema,
  groundSchema,
  resistorSchema,
  ledSchema,
  switchSchema,
  batterySchema,
  currentSourceSchema,
  capacitorSchema,
  inductorSchema,
  diodeSchema,
  zenerSchema,
  schottkySchema,
  fuseSchema,
  potentiometerSchema,
  pushButtonSchema,
  spdtSchema,
  npnSchema,
  pnpSchema,
  nMosfetSchema,
  pMosfetSchema,
  opAmpSchema
} = TscircuitPropertyAdapter;

const terminal = (id: string, label: string, symbolPortAlias: string, side: TerminalDefinition["side"], offset: number): TerminalDefinition => ({ id, label, symbolPortAlias, side, offset });
const a = terminal("a", "A", "1", TerminalSide.Left, 0.5);
const b = terminal("b", "B", "2", TerminalSide.Right, 0.5);
const positiveTerminal = terminal("positive", "+", "1", TerminalSide.Left, 0.5);
const negativeTerminal = terminal("negative", "−", "2", TerminalSide.Right, 0.5);
const anode = terminal("anode", "Anode (+)", "1", TerminalSide.Left, 0.5);
const cathode = terminal("cathode", "Cathode (−)", "2", TerminalSide.Right, 0.5);

const design = ComponentCapability.Design;
const spice = ComponentCapability.Spice;
const bench = ComponentCapability.Bench;
const capabilities = (...values: ComponentCapability[]): ReadonlySet<ComponentCapability> => new Set(values);

const baseDefinitions: readonly ComponentDefinition[] = [
  { kind: ComponentKind.DcSource, name: "DC source", category: ComponentCategory.Power, prefix: "V", symbolName: TscircuitSymbolName.DcVoltmeter, description: "Supplies a fixed low-voltage DC potential.", terminals: [positiveTerminal, negativeTerminal], propertySchema: sourceSchema, propertyFields: [PropertyFieldDefinitions.sourceVoltage, PropertyFieldDefinitions.enabled, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "dc_source", voltage: 9, enabled: true }, defaultFootprint: "terminal block", capabilities: capabilities(design, spice, bench) },
  { kind: ComponentKind.Ground, name: "Ground", category: ComponentCategory.Power, prefix: "GND", symbolName: TscircuitSymbolName.Ground, description: "Reference node for voltage measurements.", terminals: [terminal("g", "Ground", "1", TerminalSide.Top, 0.5)], propertySchema: groundSchema, propertyFields: [PropertyFieldDefinitions.footprint], defaultProperties: { kind: "ground" }, defaultFootprint: "test point", capabilities: capabilities(design, spice, bench) },
  { kind: ComponentKind.Resistor, name: "Resistor", category: ComponentCategory.Passive, prefix: "R", symbolName: TscircuitSymbolName.Resistor, description: "Limits current in the circuit.", terminals: [a, b], propertySchema: resistorSchema, propertyFields: [PropertyFieldDefinitions.resistance, PropertyFieldDefinitions.tolerance, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 }, defaultFootprint: "0805", capabilities: capabilities(design, spice, bench) },
  { kind: ComponentKind.Led, name: "LED", category: ComponentCategory.Semiconductor, prefix: "LED", symbolName: TscircuitSymbolName.Led, description: "A directional light-emitting output.", terminals: [anode, cathode], propertySchema: ledSchema, propertyFields: [PropertyFieldDefinitions.forwardVoltage, PropertyFieldDefinitions.maxCurrentMilliamps, PropertyFieldDefinitions.displayColor, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "led", forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: LedDisplayColor.Red }, defaultFootprint: "0805", capabilities: capabilities(design, spice, bench) },
  { kind: ComponentKind.Switch, name: "SPST switch", category: ComponentCategory.Control, prefix: "SW", symbolName: TscircuitSymbolName.SpstSwitch, description: "Opens or closes a conductive path.", terminals: [a, b], propertySchema: switchSchema, propertyFields: [PropertyFieldDefinitions.spst, PropertyFieldDefinitions.closed, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "switch", closed: true }, defaultFootprint: "SW_THT", capabilities: capabilities(design, spice, bench) },
  { kind: ComponentKind.Battery, name: "Battery", category: ComponentCategory.Power, prefix: "B", symbolName: TscircuitSymbolName.Battery, description: "Stores and supplies DC electrical energy.", terminals: [positiveTerminal, negativeTerminal], propertySchema: batterySchema, propertyFields: [PropertyFieldDefinitions.batteryVoltage, PropertyFieldDefinitions.batteryCapacity, PropertyFieldDefinitions.batteryStandard, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "battery", voltage: 9, capacityMilliampHours: 500, standard: BatteryStandard.NineVolt }, defaultFootprint: "battery connector", capabilities: capabilities(design) },
  { kind: ComponentKind.CurrentSource, name: "Current source", category: ComponentCategory.Power, prefix: "I", symbolName: TscircuitSymbolName.CurrentSource, description: "Supplies a fixed current.", terminals: [positiveTerminal, negativeTerminal], propertySchema: currentSourceSchema, propertyFields: [PropertyFieldDefinitions.current, PropertyFieldDefinitions.enabled, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "current_source", currentAmps: 0.02, enabled: true }, defaultFootprint: "test point pair", capabilities: capabilities(design) },
  { kind: ComponentKind.Capacitor, name: "Capacitor", category: ComponentCategory.Passive, prefix: "C", symbolName: TscircuitSymbolName.Capacitor, description: "Stores charge in an electric field.", terminals: [a, b], propertySchema: capacitorSchema, propertyFields: [PropertyFieldDefinitions.capacitance, PropertyFieldDefinitions.polarized, PropertyFieldDefinitions.voltageRating, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "capacitor", capacitanceFarads: 0.000001, polarized: false, voltageRating: 25 }, defaultFootprint: "0805", capabilities: capabilities(design) },
  { kind: ComponentKind.Inductor, name: "Inductor", category: ComponentCategory.Passive, prefix: "L", symbolName: TscircuitSymbolName.Inductor, description: "Stores energy in a magnetic field.", terminals: [a, b], propertySchema: inductorSchema, propertyFields: [PropertyFieldDefinitions.inductance, PropertyFieldDefinitions.maxCurrentAmps, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "inductor", inductanceHenries: 0.001, maxCurrentAmps: 0.1 }, defaultFootprint: "0805", capabilities: capabilities(design) },
  { kind: ComponentKind.Diode, name: "Diode", category: ComponentCategory.Semiconductor, prefix: "D", symbolName: TscircuitSymbolName.Diode, description: "Conducts current in one direction.", terminals: [anode, cathode], propertySchema: diodeSchema, propertyFields: [PropertyFieldDefinitions.forwardVoltage, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "diode", forwardVoltage: 0.7 }, defaultFootprint: "SOD-123", capabilities: capabilities(design) },
  { kind: ComponentKind.ZenerDiode, name: "Zener diode", category: ComponentCategory.Semiconductor, prefix: "D", symbolName: TscircuitSymbolName.ZenerDiode, description: "Regulates voltage in reverse breakdown.", terminals: [anode, cathode], propertySchema: zenerSchema, propertyFields: [PropertyFieldDefinitions.zenerVoltage, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "zener_diode", zenerVoltage: 5.1 }, defaultFootprint: "SOD-123", capabilities: capabilities(design) },
  { kind: ComponentKind.SchottkyDiode, name: "Schottky diode", category: ComponentCategory.Semiconductor, prefix: "D", symbolName: TscircuitSymbolName.SchottkyDiode, description: "Provides low-forward-voltage rectification.", terminals: [anode, cathode], propertySchema: schottkySchema, propertyFields: [PropertyFieldDefinitions.forwardVoltage, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "schottky_diode", forwardVoltage: 0.3 }, defaultFootprint: "SOD-123", capabilities: capabilities(design) },
  { kind: ComponentKind.Fuse, name: "Fuse", category: ComponentCategory.Passive, prefix: "F", symbolName: TscircuitSymbolName.Fuse, description: "Opens when current exceeds its rating.", terminals: [a, b], propertySchema: fuseSchema, propertyFields: [PropertyFieldDefinitions.currentRating, PropertyFieldDefinitions.voltageRating, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "fuse", currentRatingAmps: 1, voltageRating: 32 }, defaultFootprint: "1206", capabilities: capabilities(design) },
  { kind: ComponentKind.Potentiometer, name: "Potentiometer", category: ComponentCategory.Passive, prefix: "RV", symbolName: TscircuitSymbolName.Potentiometer, description: "Provides an adjustable resistance.", terminals: [terminal("a", "A", "1", TerminalSide.Left, 0.3), terminal("wiper", "Wiper", "2", TerminalSide.Top, 0.5), terminal("b", "B", "3", TerminalSide.Right, 0.7)], propertySchema: potentiometerSchema, propertyFields: [PropertyFieldDefinitions.potentiometerResistance, PropertyFieldDefinitions.wiperPosition, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "potentiometer", resistanceOhms: 10000, wiperPosition: 0.5 }, defaultFootprint: "POT_THT", capabilities: capabilities(design) },
  { kind: ComponentKind.PushButton, name: "Push button", category: ComponentCategory.Control, prefix: "SW", symbolName: TscircuitSymbolName.PushButton, description: "Momentarily closes a conductive path.", terminals: [a, b], propertySchema: pushButtonSchema, propertyFields: [PropertyFieldDefinitions.pushButton, PropertyFieldDefinitions.pressed, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "push_button", pressed: false }, defaultFootprint: "SW_THT", capabilities: capabilities(design) },
  { kind: ComponentKind.SpdtSwitch, name: "SPDT switch", category: ComponentCategory.Control, prefix: "SW", symbolName: TscircuitSymbolName.SpdtSwitch, description: "Selects one of two conductive paths.", terminals: [terminal("common", "Common", "1", TerminalSide.Left, 0.5), terminal("a", "A", "2", TerminalSide.Right, 0.3), terminal("b", "B", "3", TerminalSide.Right, 0.7)], propertySchema: spdtSchema, propertyFields: [PropertyFieldDefinitions.spdt, PropertyFieldDefinitions.position, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "spdt_switch", position: SpdtPosition.A }, defaultFootprint: "SW_THT", capabilities: capabilities(design) },
  { kind: ComponentKind.NpnBjt, name: "NPN BJT", category: ComponentCategory.Semiconductor, prefix: "Q", symbolName: TscircuitSymbolName.NpnBjt, description: "An NPN bipolar junction transistor.", terminals: [terminal("collector", "Collector", "collector", TerminalSide.Top, 0.7), terminal("base", "Base", "base", TerminalSide.Left, 0.5), terminal("emitter", "Emitter", "emitter", TerminalSide.Bottom, 0.7)], propertySchema: npnSchema, propertyFields: [PropertyFieldDefinitions.npn, PropertyFieldDefinitions.beta, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "npn_bjt", beta: 100 }, defaultFootprint: "TO-92", capabilities: capabilities(design) },
  { kind: ComponentKind.PnpBjt, name: "PNP BJT", category: ComponentCategory.Semiconductor, prefix: "Q", symbolName: TscircuitSymbolName.PnpBjt, description: "A PNP bipolar junction transistor.", terminals: [terminal("collector", "Collector", "collector", TerminalSide.Top, 0.7), terminal("base", "Base", "base", TerminalSide.Left, 0.5), terminal("emitter", "Emitter", "emitter", TerminalSide.Bottom, 0.7)], propertySchema: pnpSchema, propertyFields: [PropertyFieldDefinitions.pnp, PropertyFieldDefinitions.beta, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "pnp_bjt", beta: 100 }, defaultFootprint: "TO-92", capabilities: capabilities(design) },
  { kind: ComponentKind.NChannelMosfet, name: "N-channel MOSFET", category: ComponentCategory.Semiconductor, prefix: "Q", symbolName: TscircuitSymbolName.NChannelMosfet, description: "An N-channel enhancement MOSFET.", terminals: [terminal("drain", "Drain", "drain", TerminalSide.Top, 0.7), terminal("gate", "Gate", "gate", TerminalSide.Left, 0.5), terminal("source", "Source", "source", TerminalSide.Bottom, 0.7)], propertySchema: nMosfetSchema, propertyFields: [PropertyFieldDefinitions.nChannel, PropertyFieldDefinitions.mosfetMode, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "n_channel_mosfet", channel: MosfetChannel.N, mode: MosfetMode.Enhancement }, defaultFootprint: "TO-220", capabilities: capabilities(design) },
  { kind: ComponentKind.PChannelMosfet, name: "P-channel MOSFET", category: ComponentCategory.Semiconductor, prefix: "Q", symbolName: TscircuitSymbolName.PChannelMosfet, description: "A P-channel enhancement MOSFET.", terminals: [terminal("drain", "Drain", "drain", TerminalSide.Top, 0.7), terminal("gate", "Gate", "gate", TerminalSide.Left, 0.5), terminal("source", "Source", "source", TerminalSide.Bottom, 0.7)], propertySchema: pMosfetSchema, propertyFields: [PropertyFieldDefinitions.pChannel, PropertyFieldDefinitions.mosfetMode, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "p_channel_mosfet", channel: MosfetChannel.P, mode: MosfetMode.Enhancement }, defaultFootprint: "TO-220", capabilities: capabilities(design) },
  { kind: ComponentKind.OpAmp, name: "Op-amp", category: ComponentCategory.IntegratedCircuit, prefix: "U", symbolName: TscircuitSymbolName.OpAmp, description: "An operational amplifier.", terminals: [terminal("inverting_input", "Inverting input", "inp2", TerminalSide.Left, 0.3), terminal("non_inverting_input", "Non-inverting input", "inp1", TerminalSide.Left, 0.7), terminal("output", "Output", "out", TerminalSide.Right, 0.5), terminal("positive_supply", "Positive supply", "V+", TerminalSide.Top, 0.65), terminal("negative_supply", "Negative supply", "V-", TerminalSide.Bottom, 0.65)], propertySchema: opAmpSchema, propertyFields: [PropertyFieldDefinitions.gain, PropertyFieldDefinitions.footprint], defaultProperties: { kind: "op_amp", gain: 100000 }, defaultFootprint: "DIP-8", capabilities: capabilities(design) }
];

const verifiedSpiceKinds = new Set<ComponentKindValue>([
  ComponentKind.DcSource, ComponentKind.Ground, ComponentKind.Resistor, ComponentKind.Led, ComponentKind.Switch,
  ComponentKind.Battery, ComponentKind.CurrentSource, ComponentKind.Capacitor, ComponentKind.Inductor,
  ComponentKind.Diode, ComponentKind.ZenerDiode, ComponentKind.SchottkyDiode, ComponentKind.Fuse,
  ComponentKind.Potentiometer, ComponentKind.PushButton, ComponentKind.SpdtSwitch
]);

const definitions: readonly ComponentDefinition[] = baseDefinitions.map((definition) => ({
  ...definition,
  capabilities: verifiedSpiceKinds.has(definition.kind)
    ? new Set([...definition.capabilities, ComponentCapability.Spice])
    : definition.capabilities
}));

const definitionsByKind: ReadonlyMap<ComponentKindValue, ComponentDefinition> = new Map(definitions.map((definition) => [definition.kind, definition]));

export class ComponentDefinitionRegistry {
  static get(kind: ComponentKindValue): ComponentDefinition {
    const definition = definitionsByKind.get(kind);
    if (!definition) throw new Error(`Unknown component kind: ${kind}.`);
    return definition;
  }

  static list(): readonly ComponentDefinition[] { return definitions; }

  static byCategory(category: ComponentCategory): readonly ComponentDefinition[] {
    return definitions.filter((definition) => definition.category === category);
  }

  static supports(kind: ComponentKindValue, capability: ComponentCapability): boolean {
    return this.get(kind).capabilities.has(capability);
  }
}
