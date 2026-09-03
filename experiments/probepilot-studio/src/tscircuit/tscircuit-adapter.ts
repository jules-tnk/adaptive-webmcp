import { any_circuit_element, type AnyCircuitElement, type AnyCircuitElementInput } from "circuit-json";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { ComponentDefinition, TerminalDefinition } from "@/components/component-definition";
import {
  TerminalSide,
  type CircuitComponent,
  type CircuitDesign,
  type CircuitWire,
  type ComponentProperties,
  type Point,
  type TerminalRef
} from "@/domain/types";
import {
  TscircuitDiagnosticCode,
  TscircuitDiagnosticSeverity,
  type TscircuitConversionResult,
  type TscircuitDiagnostic
} from "./tscircuit-diagnostics";
import { TscircuitSymbolAdapter } from "./tscircuit-symbol-adapter";

export type { TscircuitConversionResult } from "./tscircuit-diagnostics";

const schematicComponentWidth = 1.6;
const schematicComponentHeight = 1;
const boardCoordinateScale = 100;

type ValidatedComponent = {
  readonly component: CircuitComponent;
  readonly definition: ComponentDefinition;
  readonly properties: ComponentProperties;
};

type SchematicPortLocation = {
  readonly center: Point;
  readonly schematicPortId: string;
};

function sourceComponentId(componentId: string): string {
  return `source_component_${componentId}`;
}

function sourcePortId(componentId: string, terminalId: string): string {
  return `source_port_${compoundId(componentId, terminalId)}`;
}

function sourceTraceId(wireId: string): string {
  return `source_trace_${wireId}`;
}

function schematicComponentId(componentId: string): string {
  return `schematic_component_${componentId}`;
}

function schematicPortId(componentId: string, terminalId: string): string {
  return `schematic_port_${compoundId(componentId, terminalId)}`;
}

function schematicTraceId(wireId: string): string {
  return `schematic_trace_${wireId}`;
}

function terminalKey(reference: TerminalRef): string {
  return compoundId(reference.componentId, reference.terminalId);
}

function compoundId(...parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("");
}

function componentCenter(component: CircuitComponent): Point {
  return {
    x: component.position.x / boardCoordinateScale,
    y: -component.position.y / boardCoordinateScale
  };
}

function terminalCenter(component: CircuitComponent, terminal: TerminalDefinition): Point {
  const center = componentCenter(component);
  if (terminal.side === TerminalSide.Left) {
    return { x: center.x - schematicComponentWidth / 2, y: center.y + schematicComponentHeight / 2 - terminal.offset * schematicComponentHeight };
  }
  if (terminal.side === TerminalSide.Right) {
    return { x: center.x + schematicComponentWidth / 2, y: center.y + schematicComponentHeight / 2 - terminal.offset * schematicComponentHeight };
  }
  if (terminal.side === TerminalSide.Top) {
    return { x: center.x - schematicComponentWidth / 2 + terminal.offset * schematicComponentWidth, y: center.y + schematicComponentHeight / 2 };
  }
  return { x: center.x - schematicComponentWidth / 2 + terminal.offset * schematicComponentWidth, y: center.y - schematicComponentHeight / 2 };
}

function facingDirection(side: TerminalSide): "up" | "down" | "left" | "right" {
  if (side === TerminalSide.Top) return "up";
  if (side === TerminalSide.Bottom) return "down";
  if (side === TerminalSide.Left) return "left";
  return "right";
}

function sourceComponent(component: CircuitComponent, definition: ComponentDefinition, properties: ComponentProperties): AnyCircuitElementInput {
  const base = {
    type: "source_component" as const,
    source_component_id: sourceComponentId(component.id),
    name: component.label,
    display_name: definition.name
  };

  switch (properties.kind) {
    case "dc_source":
      return { ...base, ftype: "simple_voltage_source", voltage: properties.enabled ? properties.voltage : 0 };
    case "ground":
      return { ...base, ftype: "simple_ground" };
    case "resistor":
      return { ...base, ftype: "simple_resistor", resistance: properties.resistanceOhms, display_value: `${properties.resistanceOhms}Ω ±${properties.tolerance * 100}%` };
    case "led":
      return { ...base, ftype: "simple_led", color: properties.displayColor, display_value: `${properties.forwardVoltage}V / ${properties.maxCurrentMilliamps}mA` };
    case "switch":
      return { ...base, ftype: "simple_switch", display_value: properties.closed ? "closed" : "open" };
    case "battery":
      return { ...base, ftype: "simple_battery", capacity: properties.capacityMilliampHours, display_value: `${properties.voltage}V ${properties.standard}` };
    case "current_source":
      return { ...base, ftype: "simple_current_source", current: properties.enabled ? properties.currentAmps : 0 };
    case "capacitor":
      return { ...base, ftype: "simple_capacitor", capacitance: properties.capacitanceFarads, max_voltage_rating: properties.voltageRating, display_value: properties.polarized ? "polarized" : "non-polarized" };
    case "inductor":
      return { ...base, ftype: "simple_inductor", inductance: properties.inductanceHenries, max_current_rating: properties.maxCurrentAmps };
    case "diode":
      return { ...base, ftype: "simple_diode", display_value: `${properties.forwardVoltage}V` };
    case "zener_diode":
      return { ...base, ftype: "simple_diode", display_value: `${properties.zenerVoltage}V zener` };
    case "schottky_diode":
      return { ...base, ftype: "simple_diode", display_value: `${properties.forwardVoltage}V schottky` };
    case "fuse":
      return { ...base, ftype: "simple_fuse", current_rating_amps: properties.currentRatingAmps, voltage_rating_volts: properties.voltageRating };
    case "potentiometer":
      return { ...base, ftype: "simple_potentiometer", max_resistance: properties.resistanceOhms, display_value: `${properties.wiperPosition * 100}%` };
    case "push_button":
      return { ...base, ftype: "simple_push_button", display_value: properties.pressed ? "pressed" : "released" };
    case "spdt_switch":
      return { ...base, ftype: "simple_switch", display_value: `path ${properties.position}` };
    case "npn_bjt":
      return { ...base, ftype: "simple_transistor", transistor_type: "npn", display_value: `β=${properties.beta}` };
    case "pnp_bjt":
      return { ...base, ftype: "simple_transistor", transistor_type: "pnp", display_value: `β=${properties.beta}` };
    case "n_channel_mosfet":
    case "p_channel_mosfet":
      return { ...base, ftype: "simple_mosfet", channel_type: properties.channel, mosfet_mode: properties.mode };
    case "op_amp":
      return { ...base, ftype: "simple_op_amp", display_value: `gain ${properties.gain}` };
  }
}

function sourcePort(component: CircuitComponent, terminal: TerminalDefinition, pinNumber: number): AnyCircuitElementInput {
  return {
    type: "source_port",
    source_port_id: sourcePortId(component.id, terminal.id),
    source_component_id: sourceComponentId(component.id),
    name: terminal.id,
    pin_number: pinNumber,
    port_hints: [terminal.id, terminal.symbolPortAlias]
  };
}

function schematicComponent(component: CircuitComponent, definition: ComponentDefinition): AnyCircuitElementInput {
  return {
    type: "schematic_component",
    schematic_component_id: schematicComponentId(component.id),
    source_component_id: sourceComponentId(component.id),
    center: componentCenter(component),
    size: { width: schematicComponentWidth, height: schematicComponentHeight },
    symbol_name: definition.symbolName,
    is_box_with_pins: false
  };
}

function schematicPort(component: CircuitComponent, terminal: TerminalDefinition, pinNumber: number, isConnected: boolean): AnyCircuitElementInput {
  return {
    type: "schematic_port",
    schematic_port_id: schematicPortId(component.id, terminal.id),
    source_port_id: sourcePortId(component.id, terminal.id),
    schematic_component_id: schematicComponentId(component.id),
    center: terminalCenter(component, terminal),
    facing_direction: facingDirection(terminal.side),
    side_of_component: terminal.side,
    pin_number: pinNumber,
    display_pin_label: terminal.label,
    is_connected: isConnected
  };
}

function invalidReferenceDiagnostic(wire: CircuitWire, reference: TerminalRef, code: TscircuitDiagnosticCode, noun: string): TscircuitDiagnostic {
  return {
    code,
    severity: TscircuitDiagnosticSeverity.Error,
    message: `Wire ${wire.id} references an invalid ${noun} on component ${reference.componentId}.`,
    affectedIds: [wire.id, reference.componentId]
  };
}

function validateDesign(design: CircuitDesign): { components: Map<string, ValidatedComponent>; diagnostics: TscircuitDiagnostic[] } {
  const components = new Map<string, ValidatedComponent>();
  const definitions = new Map<string, ComponentDefinition>();
  const diagnostics: TscircuitDiagnostic[] = [];

  for (const component of Object.values(design.components).sort((left, right) => left.id.localeCompare(right.id))) {
    if (components.has(component.id)) {
      diagnostics.push({
        code: TscircuitDiagnosticCode.DuplicatePublicId,
        severity: TscircuitDiagnosticSeverity.Error,
        message: `Component ID ${component.id} is duplicated.`,
        affectedIds: [component.id]
      });
      continue;
    }

    let definition: ComponentDefinition;
    try {
      definition = ComponentDefinitionRegistry.get(component.kind);
    } catch {
      diagnostics.push({
        code: TscircuitDiagnosticCode.UnknownComponentKind,
        severity: TscircuitDiagnosticSeverity.Error,
        message: `Component ${component.id} has an unknown component kind.`,
        affectedIds: [component.id]
      });
      continue;
    }
    definitions.set(component.id, definition);

    const parsedProperties = definition.propertySchema.safeParse(component.properties);
    if (!parsedProperties.success) {
      diagnostics.push({
        code: TscircuitDiagnosticCode.InvalidComponentProperties,
        severity: TscircuitDiagnosticSeverity.Error,
        message: `Component ${component.id} has properties that do not match the ${definition.name} registry schema.`,
        affectedIds: [component.id]
      });
      continue;
    }

    components.set(component.id, { component, definition, properties: parsedProperties.data });
  }

  const seenWireIds = new Set<string>();
  for (const wire of Object.values(design.wires).sort((left, right) => left.id.localeCompare(right.id))) {
    if (seenWireIds.has(wire.id)) {
      diagnostics.push({
        code: TscircuitDiagnosticCode.DuplicatePublicId,
        severity: TscircuitDiagnosticSeverity.Error,
        message: `Wire ID ${wire.id} is duplicated.`,
        affectedIds: [wire.id]
      });
      continue;
    }
    seenWireIds.add(wire.id);

    for (const reference of [wire.a, wire.b]) {
      const definition = definitions.get(reference.componentId);
      if (!definition) {
        diagnostics.push(invalidReferenceDiagnostic(wire, reference, TscircuitDiagnosticCode.InvalidComponentReference, "component reference"));
        continue;
      }
      if (!definition.terminals.some((terminal) => terminal.id === reference.terminalId)) {
        diagnostics.push(invalidReferenceDiagnostic(wire, reference, TscircuitDiagnosticCode.InvalidTerminalReference, "terminal reference"));
      }
    }
  }

  return { components, diagnostics };
}

function buildElements(design: CircuitDesign, components: Map<string, ValidatedComponent>): AnyCircuitElementInput[] {
  const elements: AnyCircuitElementInput[] = [];
  const connectedTerminals = new Set<string>();
  const schematicPortLocations = new Map<string, SchematicPortLocation>();
  const wires = Object.values(design.wires).sort((left, right) => left.id.localeCompare(right.id));

  for (const wire of wires) {
    connectedTerminals.add(terminalKey(wire.a));
    connectedTerminals.add(terminalKey(wire.b));
  }

  for (const { component, definition, properties } of [...components.values()].sort((left, right) => left.component.id.localeCompare(right.component.id))) {
    elements.push(sourceComponent(component, definition, properties));
    for (const terminal of definition.terminals) {
      const pinNumber = TscircuitSymbolAdapter.pinNumber(definition, terminal.id);
      elements.push(sourcePort(component, terminal, pinNumber));
    }
    elements.push(schematicComponent(component, definition));
    for (const terminal of definition.terminals) {
      const pinNumber = TscircuitSymbolAdapter.pinNumber(definition, terminal.id);
      const item = schematicPort(component, terminal, pinNumber, connectedTerminals.has(terminalKey({ componentId: component.id, terminalId: terminal.id })));
      elements.push(item);
      schematicPortLocations.set(terminalKey({ componentId: component.id, terminalId: terminal.id }), {
        center: terminalCenter(component, terminal),
        schematicPortId: schematicPortId(component.id, terminal.id)
      });
    }
  }

  for (const wire of wires) {
    const start = schematicPortLocations.get(terminalKey(wire.a));
    const end = schematicPortLocations.get(terminalKey(wire.b));
    if (!start || !end) continue;
    elements.push({
      type: "source_trace",
      source_trace_id: sourceTraceId(wire.id),
      connected_source_port_ids: [sourcePortId(wire.a.componentId, wire.a.terminalId), sourcePortId(wire.b.componentId, wire.b.terminalId)],
      connected_source_net_ids: []
    });
    elements.push({
      type: "schematic_trace",
      schematic_trace_id: schematicTraceId(wire.id),
      source_trace_id: sourceTraceId(wire.id),
      junctions: [],
      edges: [{
        from: start.center,
        to: end.center,
        from_schematic_port_id: start.schematicPortId,
        to_schematic_port_id: end.schematicPortId
      }]
    });
  }

  return elements;
}

function circuitJsonElementId(element: AnyCircuitElement): string | undefined {
  if (element.type === "source_component") return element.source_component_id;
  if (element.type === "source_port") return element.source_port_id;
  if (element.type === "source_trace") return element.source_trace_id;
  if (element.type === "schematic_component") return element.schematic_component_id;
  if (element.type === "schematic_port") return element.schematic_port_id;
  if (element.type === "schematic_trace") return element.schematic_trace_id;
  return undefined;
}

type CircuitJsonReference = {
  readonly ownerId: string;
  readonly referenceId: string;
};

function circuitJsonReferences(element: AnyCircuitElement): CircuitJsonReference[] {
  const ownerId = circuitJsonElementId(element);
  if (!ownerId) return [];
  if (element.type === "source_port") {
    return element.source_component_id ? [{ ownerId, referenceId: element.source_component_id }] : [];
  }
  if (element.type === "source_trace") {
    return [...element.connected_source_port_ids, ...element.connected_source_net_ids].map((referenceId) => ({ ownerId, referenceId }));
  }
  if (element.type === "schematic_component") {
    return element.source_component_id ? [{ ownerId, referenceId: element.source_component_id }] : [];
  }
  if (element.type === "schematic_port") {
    const references: CircuitJsonReference[] = [{ ownerId, referenceId: element.source_port_id }];
    if (element.schematic_component_id) references.push({ ownerId, referenceId: element.schematic_component_id });
    return references;
  }
  if (element.type === "schematic_trace") {
    const references: CircuitJsonReference[] = [];
    if (element.source_trace_id) references.push({ ownerId, referenceId: element.source_trace_id });
    for (const edge of element.edges) {
      if (edge.from_schematic_port_id) references.push({ ownerId, referenceId: edge.from_schematic_port_id });
      if (edge.to_schematic_port_id) references.push({ ownerId, referenceId: edge.to_schematic_port_id });
    }
    return references;
  }
  return [];
}

function validateCircuitJsonCollection(elements: readonly AnyCircuitElement[]): TscircuitDiagnostic[] {
  const idCounts = new Map<string, number>();
  for (const element of elements) {
    const id = circuitJsonElementId(element);
    if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }

  const diagnostics: TscircuitDiagnostic[] = [];
  for (const [id, count] of idCounts) {
    if (count > 1) {
      diagnostics.push({
        code: TscircuitDiagnosticCode.DuplicateCircuitJsonId,
        severity: TscircuitDiagnosticSeverity.Error,
        message: `Circuit JSON ID ${id} resolves more than once.`,
        affectedIds: [id]
      });
    }
  }

  for (const element of elements) {
    for (const reference of circuitJsonReferences(element)) {
      const count = idCounts.get(reference.referenceId) ?? 0;
      if (count !== 1) {
        diagnostics.push({
          code: TscircuitDiagnosticCode.InvalidCircuitJsonReference,
          severity: TscircuitDiagnosticSeverity.Error,
          message: `Circuit JSON reference ${reference.referenceId} from ${reference.ownerId} resolves ${count} times.`,
          affectedIds: [reference.ownerId, reference.referenceId]
        });
      }
    }
  }

  return diagnostics;
}

export function finalizeCircuitJsonElements(elements: readonly AnyCircuitElement[]): TscircuitConversionResult {
  const diagnostics = validateCircuitJsonCollection(elements);
  if (diagnostics.some((diagnostic) => diagnostic.severity === TscircuitDiagnosticSeverity.Error)) {
    return { elements: [], diagnostics };
  }
  return { elements: [...elements], diagnostics };
}

export class TscircuitAdapter {
  static toCircuitJson(design: CircuitDesign): TscircuitConversionResult {
    const validated = validateDesign(design);
    if (validated.diagnostics.some((diagnostic) => diagnostic.severity === TscircuitDiagnosticSeverity.Error)) {
      return { elements: [], diagnostics: validated.diagnostics };
    }

    const candidates = buildElements(design, validated.components);
    const parsed = any_circuit_element.array().safeParse(candidates);
    if (!parsed.success) {
      return {
        elements: [],
        diagnostics: [{
          code: TscircuitDiagnosticCode.CircuitJsonValidationFailed,
          severity: TscircuitDiagnosticSeverity.Error,
          message: `Circuit JSON validation failed at ${parsed.error.issues.length} schema location${parsed.error.issues.length === 1 ? "" : "s"}.`,
          affectedIds: []
        }]
      };
    }

    return finalizeCircuitJsonElements(parsed.data);
  }
}
