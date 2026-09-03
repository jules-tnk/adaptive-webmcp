import { testPointId } from "./catalog";
import { validateDesign } from "./validation";
import type {
  CircuitDesign,
  CircuitIssue,
  ComponentSimulation,
  SimulationOverrides,
  SimulationResult
} from "./types";

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: "wire" | "resistor" | "switch" | "led";
  componentId?: string;
  resistanceOhms?: number;
  voltageDrop?: number;
};

function addEdge(graph: Map<string, GraphEdge[]>, edge: GraphEdge): void {
  const list = graph.get(edge.from) ?? [];
  list.push(edge);
  graph.set(edge.from, list);
}

function addBidirectional(graph: Map<string, GraphEdge[]>, edge: Omit<GraphEdge, "from" | "to">, a: string, b: string): void {
  addEdge(graph, { ...edge, from: a, to: b });
  addEdge(graph, { ...edge, id: `${edge.id}:reverse`, from: b, to: a });
}

function buildGraph(design: CircuitDesign, overrides: SimulationOverrides): Map<string, GraphEdge[]> {
  const graph = new Map<string, GraphEdge[]>();
  const disconnected = overrides.disconnectedWireIds ?? new Set<string>();
  const openComponents = overrides.openComponentIds ?? new Set<string>();
  const reversed = overrides.reversedLedIds ?? new Set<string>();

  for (const wire of Object.values(design.wires)) {
    if (disconnected.has(wire.id)) continue;
    addBidirectional(
      graph,
      { id: wire.id, kind: "wire" },
      testPointId(wire.a.componentId, wire.a.terminalId),
      testPointId(wire.b.componentId, wire.b.terminalId)
    );
  }

  for (const component of Object.values(design.components)) {
    if (openComponents.has(component.id)) continue;
    const props = component.properties;
    if (props.kind === "resistor") {
      const resistance = overrides.resistorValues?.[component.id] ?? props.resistanceOhms;
      addBidirectional(
        graph,
        { id: `component:${component.id}`, kind: "resistor", componentId: component.id, resistanceOhms: resistance },
        testPointId(component.id, "a"),
        testPointId(component.id, "b")
      );
    } else if (props.kind === "switch" && props.closed) {
      addBidirectional(
        graph,
        { id: `component:${component.id}`, kind: "switch", componentId: component.id },
        testPointId(component.id, "a"),
        testPointId(component.id, "b")
      );
    } else if (props.kind === "led") {
      const normalAnode = testPointId(component.id, "anode");
      const normalCathode = testPointId(component.id, "cathode");
      const from = reversed.has(component.id) ? normalCathode : normalAnode;
      const to = reversed.has(component.id) ? normalAnode : normalCathode;
      addEdge(graph, {
        id: `component:${component.id}`,
        kind: "led",
        componentId: component.id,
        voltageDrop: props.forwardVoltage,
        from,
        to
      });
    }
  }
  return graph;
}

function findPath(graph: Map<string, GraphEdge[]>, start: string, goal: string): GraphEdge[] | null {
  const visited = new Set<string>();
  const walk = (node: string, path: GraphEdge[]): GraphEdge[] | null => {
    if (node === goal) return path;
    if (visited.has(node)) return null;
    visited.add(node);
    for (const edge of graph.get(node) ?? []) {
      const result = walk(edge.to, [...path, edge]);
      if (result) return result;
    }
    return null;
  };
  return walk(start, []);
}

function reachable(graph: Map<string, GraphEdge[]>, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || seen.has(node)) continue;
    seen.add(node);
    for (const edge of graph.get(node) ?? []) stack.push(edge.to);
  }
  return seen;
}

function reverseGraph(graph: Map<string, GraphEdge[]>): Map<string, GraphEdge[]> {
  const reversed = new Map<string, GraphEdge[]>();
  for (const edges of graph.values()) {
    for (const edge of edges) addEdge(reversed, { ...edge, from: edge.to, to: edge.from });
  }
  return reversed;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

/** Synchronous deterministic solver; async engine selection belongs to SimulationCoordinator. */
export function simulateDcCircuit(design: CircuitDesign, overrides: SimulationOverrides = {}): SimulationResult {
  const validation = validateDesign(design);
  const components: Record<string, ComponentSimulation> = {};
  for (const component of Object.values(design.components)) {
    const state = component.kind === "led" ? "off" : component.kind === "switch" ? (component.properties.kind === "switch" && component.properties.closed ? "closed" : "open") : undefined;
    components[component.id] = { voltageDrop: 0, currentAmps: 0, state };
  }

  if (!validation.valid) {
    return {
      status: "fail",
      designRevision: design.revision,
      issues: validation.issues,
      nodeVoltages: {},
      branchCurrents: {},
      components,
      observableOutputs: Object.values(design.components)
        .filter((component) => component.kind === "led")
        .map((component) => ({ componentId: component.id, label: component.label, expectedState: "off" as const })),
      summary: "The design has blocking validation errors."
    };
  }

  const source = Object.values(design.components).find((component) => component.kind === "dc_source");
  if (!source || source.properties.kind !== "dc_source") {
    throw new Error("A validated circuit must contain a DC source.");
  }
  const sourceVoltage = source.properties.enabled ? source.properties.voltage : 0;
  const start = testPointId(source.id, "positive");
  const goal = testPointId(source.id, "negative");
  const graph = buildGraph(design, overrides);
  const path = findPath(graph, start, goal);
  const nodeVoltages: Record<string, number> = {};
  const branchCurrents: Record<string, number> = {};
  const issues: CircuitIssue[] = validation.issues.filter((issue) => issue.severity === "warning");

  if (!path) {
    const highSide = reachable(graph, start);
    const lowSide = reachable(reverseGraph(graph), goal);
    for (const node of highSide) nodeVoltages[node] = sourceVoltage;
    for (const node of lowSide) if (!(node in nodeVoltages)) nodeVoltages[node] = 0;
    nodeVoltages[start] = sourceVoltage;
    nodeVoltages[goal] = 0;
    issues.push({ code: "OPEN_PATH", severity: "error", message: "No complete current path exists from the source back to its negative terminal.", affectedIds: [] });
    return {
      status: "fail",
      designRevision: design.revision,
      issues,
      nodeVoltages,
      branchCurrents,
      components,
      observableOutputs: Object.values(design.components)
        .filter((component) => component.kind === "led")
        .map((component) => ({ componentId: component.id, label: component.label, expectedState: "off" as const })),
      summary: "The circuit is open, so no current reaches the output."
    };
  }

  const uniqueComponentEdges = path.filter((edge, index) =>
    edge.componentId && path.findIndex((candidate) => candidate.componentId === edge.componentId) === index
  );
  const resistance = uniqueComponentEdges.reduce((total, edge) => total + (edge.resistanceOhms ?? 0), 0);
  const fixedDrop = uniqueComponentEdges.reduce((total, edge) => total + (edge.voltageDrop ?? 0), 0);
  if (resistance <= 0 && sourceVoltage > fixedDrop) {
    issues.push({ code: "SOURCE_SHORT", severity: "error", message: "The source has no current-limiting resistance in the active path.", affectedIds: [source.id] });
    return {
      status: "fail",
      designRevision: design.revision,
      issues,
      nodeVoltages: { [start]: sourceVoltage, [goal]: 0 },
      branchCurrents,
      components,
      observableOutputs: Object.values(design.components)
        .filter((component) => component.kind === "led")
        .map((component) => ({ componentId: component.id, label: component.label, expectedState: "off" as const })),
      summary: "The active path would short the source."
    };
  }

  const current = sourceVoltage > fixedDrop && resistance > 0 ? (sourceVoltage - fixedDrop) / resistance : 0;
  let voltage = sourceVoltage;
  nodeVoltages[start] = round(voltage);
  for (const edge of path) {
    nodeVoltages[edge.from] = round(voltage);
    if (edge.kind === "resistor") voltage -= current * (edge.resistanceOhms ?? 0);
    if (edge.kind === "led") voltage -= edge.voltageDrop ?? 0;
    nodeVoltages[edge.to] = round(Math.max(0, voltage));
    if (edge.componentId) branchCurrents[edge.componentId] = round(current);
  }
  nodeVoltages[goal] = 0;

  for (const edge of uniqueComponentEdges) {
    if (!edge.componentId) continue;
    const simulation = components[edge.componentId];
    if (!simulation) continue;
    const drop = edge.kind === "resistor" ? current * (edge.resistanceOhms ?? 0) : edge.kind === "led" ? (edge.voltageDrop ?? 0) : 0;
    simulation.voltageDrop = round(drop);
    simulation.currentAmps = round(current);
    if (edge.kind === "led") simulation.state = current > 0 ? "on" : "off";
  }
  components[source.id] = { voltageDrop: sourceVoltage, currentAmps: round(current) };

  for (const component of Object.values(design.components)) {
    if (component.properties.kind === "led") {
      const milliamps = (components[component.id]?.currentAmps ?? 0) * 1000;
      if (milliamps > component.properties.maxCurrentMilliamps) {
        issues.push({
          code: "LED_OVERCURRENT",
          severity: "warning",
          message: `${component.label} current is ${milliamps.toFixed(1)} mA, above its ${component.properties.maxCurrentMilliamps} mA recommendation.`,
          affectedIds: [component.id]
        });
      }
    }
  }

  const outputs = Object.values(design.components)
    .filter((component) => component.kind === "led")
    .map((component) => ({
      componentId: component.id,
      label: component.label,
      expectedState: components[component.id]?.state === "on" ? ("on" as const) : ("off" as const)
    }));
  const status = issues.some((issue) => issue.severity === "error") ? "fail" : issues.length > 0 ? "warning" : "pass";
  return {
    status,
    designRevision: design.revision,
    issues,
    nodeVoltages,
    branchCurrents,
    components,
    observableOutputs: outputs,
    summary: outputs.some((output) => output.expectedState === "on")
      ? `The intended circuit works at ${(current * 1000).toFixed(1)} mA.`
      : "The circuit is complete, but no LED is active."
  };
}

export function terminalsHaveContinuity(design: CircuitDesign, a: string, b: string, overrides: SimulationOverrides = {}): boolean {
  const graph = buildGraph(design, overrides);
  const undirected = new Map<string, GraphEdge[]>();
  for (const edges of graph.values()) {
    for (const edge of edges) addBidirectional(undirected, { ...edge, id: edge.id }, edge.from, edge.to);
  }
  return reachable(undirected, a).has(b);
}
