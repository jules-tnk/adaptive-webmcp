import { componentCatalog, terminalExists } from "./catalog";
import type { CircuitDesign, CircuitIssue, TerminalRef, ValidationResult } from "./types";

function refKey(ref: TerminalRef): string {
  return `${ref.componentId}:${ref.terminalId}`;
}

export function validateDesign(design: CircuitDesign): ValidationResult {
  const issues: CircuitIssue[] = [];
  const components = Object.values(design.components);
  const sources = components.filter((component) => component.kind === "dc_source");
  const grounds = components.filter((component) => component.kind === "ground");
  const leds = components.filter((component) => component.kind === "led");

  if (sources.length === 0) {
    issues.push({ code: "NO_SOURCE", severity: "error", message: "Add one DC source.", affectedIds: [] });
  }
  if (sources.length > 1) {
    issues.push({ code: "MULTIPLE_SOURCES", severity: "error", message: "The MVP supports one DC source.", affectedIds: sources.map((item) => item.id) });
  }
  if (grounds.length === 0) {
    issues.push({ code: "NO_GROUND", severity: "error", message: "Add a ground reference.", affectedIds: [] });
  }
  if (grounds.length > 1) {
    issues.push({ code: "MULTIPLE_GROUNDS", severity: "error", message: "The MVP supports one ground reference.", affectedIds: grounds.map((item) => item.id) });
  }
  if (leds.length === 0) {
    issues.push({ code: "NO_OUTPUT", severity: "warning", message: "Add an LED so the bench has an observable output.", affectedIds: [] });
  }

  const seenPairs = new Set<string>();
  const connectedTerminals = new Set<string>();
  for (const wire of Object.values(design.wires)) {
    const componentA = design.components[wire.a.componentId];
    const componentB = design.components[wire.b.componentId];
    if (!componentA || !componentB) {
      issues.push({ code: "DANGLING_WIRE", severity: "error", message: `Wire ${wire.id} references a missing component.`, affectedIds: [wire.id] });
      continue;
    }
    if (!terminalExists(componentA, wire.a.terminalId) || !terminalExists(componentB, wire.b.terminalId)) {
      issues.push({ code: "INVALID_TERMINAL", severity: "error", message: `Wire ${wire.id} references an invalid terminal.`, affectedIds: [wire.id] });
      continue;
    }
    if (wire.a.componentId === wire.b.componentId) {
      issues.push({ code: "SELF_CONNECTION", severity: "error", message: "A wire cannot connect two terminals on the same component.", affectedIds: [wire.id, wire.a.componentId] });
    }
    const pair = [refKey(wire.a), refKey(wire.b)].sort().join("|");
    if (seenPairs.has(pair)) {
      issues.push({ code: "DUPLICATE_WIRE", severity: "error", message: "These terminals are already connected.", affectedIds: [wire.id] });
    }
    seenPairs.add(pair);
    connectedTerminals.add(refKey(wire.a));
    connectedTerminals.add(refKey(wire.b));
  }

  for (const component of components) {
    const props = component.properties;
    if (props.kind === "dc_source" && (props.voltage <= 0 || props.voltage > 24)) {
      issues.push({ code: "SOURCE_RANGE", severity: "error", message: `${component.label} must be between 0 and 24 V.`, affectedIds: [component.id] });
    }
    if (props.kind === "resistor" && props.resistanceOhms <= 0) {
      issues.push({ code: "RESISTANCE_RANGE", severity: "error", message: `${component.label} must have positive resistance.`, affectedIds: [component.id] });
    }
    for (const terminal of componentCatalog[component.kind].terminals) {
      if (!connectedTerminals.has(`${component.id}:${terminal.id}`)) {
        issues.push({
          code: "UNCONNECTED_TERMINAL",
          severity: "warning",
          message: `${component.label} terminal ${terminal.label} is not connected.`,
          affectedIds: [component.id]
        });
      }
    }
  }

  return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}

export function canConnect(design: CircuitDesign, a: TerminalRef, b: TerminalRef): { ok: true } | { ok: false; message: string } {
  const componentA = design.components[a.componentId];
  const componentB = design.components[b.componentId];
  if (!componentA || !componentB) return { ok: false, message: "One of the components no longer exists." };
  if (!terminalExists(componentA, a.terminalId) || !terminalExists(componentB, b.terminalId)) {
    return { ok: false, message: "One of the terminals is invalid." };
  }
  if (a.componentId === b.componentId) return { ok: false, message: "Connect terminals on different components." };
  const pair = [`${a.componentId}:${a.terminalId}`, `${b.componentId}:${b.terminalId}`].sort().join("|");
  const duplicate = Object.values(design.wires).some((wire) =>
    [`${wire.a.componentId}:${wire.a.terminalId}`, `${wire.b.componentId}:${wire.b.terminalId}`].sort().join("|") === pair
  );
  return duplicate ? { ok: false, message: "These terminals are already connected." } : { ok: true };
}
