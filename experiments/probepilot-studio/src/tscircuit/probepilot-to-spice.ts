import {
  Ac,
  Capacitor as SpiceCapacitor,
  CurrentSource as SpiceCurrentSource,
  Dc,
  Diode as SpiceDiode,
  Inductor as SpiceInductor,
  Op,
  Probe,
  Resistor as SpiceResistor,
  SpiceNetlist,
  Tran,
  VoltageSource as SpiceVoltageSource,
  type SpiceCardInput
} from "spicets";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import {
  ComponentKind,
  SpdtPosition,
  type CircuitComponent,
  type CircuitDesign,
  type ComponentKindValue,
  type TerminalRef
} from "@/domain/types";
import {
  SimulationAnalysisType,
  SimulationProbeKind,
  SimulationSweepScale,
  type SimulationAnalysis,
  type SimulationProbe,
  type SimulationRequest
} from "@/simulation/simulation-engine";
import {
  SpiceIdealResistance,
  SpiceModelRegistry
} from "./spice-model-registry";

export enum SpiceConversionErrorCode {
  UnsupportedComponent = "SPICE_UNSUPPORTED_COMPONENT",
  MissingModel = "SPICE_MISSING_MODEL",
  MissingGround = "SPICE_MISSING_GROUND",
  DisconnectedGround = "SPICE_DISCONNECTED_GROUND",
  InvalidConnection = "SPICE_INVALID_CONNECTION",
  InvalidComponentValue = "SPICE_INVALID_COMPONENT_VALUE",
  InvalidAnalysis = "SPICE_INVALID_ANALYSIS",
  InvalidProbe = "SPICE_INVALID_PROBE"
}

export interface SpiceConversionError {
  readonly code: SpiceConversionErrorCode;
  readonly message: string;
  readonly componentId?: string;
  readonly affectedComponentIds?: readonly string[];
  readonly wireId?: string;
}

export interface SpiceConversionResult {
  readonly netlist?: string;
  readonly errors: readonly SpiceConversionError[];
  readonly terminalNodeNames: Readonly<Record<string, string>>;
  readonly componentElementNames: Readonly<Record<string, readonly string[]>>;
}

enum SpiceNodeName {
  Ground = "0"
}

enum SpiceElementNameGroup {
  VoltageSource = "V",
  CurrentSource = "I",
  Resistor = "R",
  Capacitor = "C",
  Inductor = "L",
  Diode = "D",
  Switch = "RSW",
  PushButton = "RPB",
  Fuse = "RF",
  SpdtSwitch = "RSPDT",
  Potentiometer = "RPOT"
}

enum SpiceAcSweepToken {
  Linear = "lin",
  Decade = "dec",
  Octave = "oct"
}

enum SpiceEngineeringSuffix {
  Tera = "t",
  Giga = "g",
  Mega = "meg",
  Kilo = "k",
  Unit = "",
  Milli = "m",
  Micro = "u",
  Nano = "n",
  Pico = "p",
  Femto = "f"
}

enum TerminalId {
  Positive = "positive",
  Negative = "negative",
  A = "a",
  B = "b",
  Anode = "anode",
  Cathode = "cathode",
  Common = "common",
  Wiper = "wiper",
  Ground = "g"
}

interface ElementAllocation {
  readonly component: CircuitComponent;
  readonly names: readonly string[];
}

interface NodeAllocation {
  readonly terminalNodeNames: Readonly<Record<string, string>>;
  readonly nodeForTerminal: ReadonlyMap<string, string>;
}

const supportedKinds: ReadonlySet<ComponentKindValue> = new Set([
  ComponentKind.DcSource,
  ComponentKind.Ground,
  ComponentKind.Resistor,
  ComponentKind.Led,
  ComponentKind.Switch,
  ComponentKind.Battery,
  ComponentKind.CurrentSource,
  ComponentKind.Capacitor,
  ComponentKind.Inductor,
  ComponentKind.Diode,
  ComponentKind.ZenerDiode,
  ComponentKind.SchottkyDiode,
  ComponentKind.Fuse,
  ComponentKind.Potentiometer,
  ComponentKind.PushButton,
  ComponentKind.SpdtSwitch
]);

const modelBackedKinds: ReadonlySet<ComponentKindValue> = new Set([
  ComponentKind.Diode,
  ComponentKind.ZenerDiode,
  ComponentKind.SchottkyDiode,
  ComponentKind.Led
]);

const componentCardOrder: readonly ComponentKindValue[] = [
  ComponentKind.DcSource,
  ComponentKind.Battery,
  ComponentKind.CurrentSource,
  ComponentKind.Resistor,
  ComponentKind.Capacitor,
  ComponentKind.Inductor,
  ComponentKind.Diode,
  ComponentKind.ZenerDiode,
  ComponentKind.SchottkyDiode,
  ComponentKind.Led,
  ComponentKind.Switch,
  ComponentKind.PushButton,
  ComponentKind.SpdtSwitch,
  ComponentKind.Fuse,
  ComponentKind.Potentiometer
];

const modelCardOrder: readonly ComponentKindValue[] = [
  ComponentKind.Diode,
  ComponentKind.ZenerDiode,
  ComponentKind.SchottkyDiode,
  ComponentKind.Led
];

class TerminalSets {
  private readonly parents = new Map<string, string>();

  add(terminalKey: string): void {
    if (!this.parents.has(terminalKey)) this.parents.set(terminalKey, terminalKey);
  }

  connect(firstTerminalKey: string, secondTerminalKey: string): void {
    const firstRoot = this.root(firstTerminalKey);
    const secondRoot = this.root(secondTerminalKey);
    if (firstRoot === secondRoot) return;
    const [lowerRoot, upperRoot] = [firstRoot, secondRoot].sort((left, right) => left.localeCompare(right));
    this.parents.set(upperRoot, lowerRoot);
  }

  root(terminalKey: string): string {
    const parent = this.parents.get(terminalKey);
    if (!parent) return terminalKey;
    if (parent === terminalKey) return parent;
    const root = this.root(parent);
    this.parents.set(terminalKey, root);
    return root;
  }
}

export class ProbePilotToSpice {
  static supports(kind: ComponentKindValue): boolean {
    return supportedKinds.has(kind);
  }

  static convert(design: CircuitDesign, request: SimulationRequest = {}): SpiceConversionResult {
    const components = Object.values(design.components).sort((left, right) => left.id.localeCompare(right.id));
    const terminalKeys = ProbePilotToSpice.terminalKeys(components);
    const errors = [
      ...ProbePilotToSpice.validateComponents(components),
      ...ProbePilotToSpice.validateGround(components),
      ...ProbePilotToSpice.validateConnections(design, terminalKeys),
      ...ProbePilotToSpice.validateRequest(design, request, terminalKeys)
    ];

    if (errors.length > 0) return ProbePilotToSpice.failure(errors);

    const terminalSets = ProbePilotToSpice.connectTerminals(design, terminalKeys);
    const executableIslandSets = ProbePilotToSpice.connectExecutableIslands(
      design,
      components,
      terminalKeys
    );
    const groundConnectivityErrors = ProbePilotToSpice.validateGroundConnectivity(
      components,
      executableIslandSets
    );
    if (groundConnectivityErrors.length > 0) {
      return ProbePilotToSpice.failure(groundConnectivityErrors);
    }

    const allocations = ProbePilotToSpice.allocateElements(components);
    const nodes = ProbePilotToSpice.allocateNodes(components, allocations, terminalSets);
    const componentElementNames = Object.fromEntries(
      allocations.map((allocation) => [allocation.component.id, allocation.names])
    );
    const cards = ProbePilotToSpice.createElementCards(
      allocations,
      nodes.nodeForTerminal,
      request
    );
    cards.push(...ProbePilotToSpice.createModelCards(components));
    cards.push(ProbePilotToSpice.createAnalysisCard(request.analysis, componentElementNames));

    const probeCard = ProbePilotToSpice.createProbeCard(
      request.probes ?? [],
      nodes.nodeForTerminal,
      componentElementNames
    );
    if (probeCard) cards.push(probeCard);

    const netlist = new SpiceNetlist({
      title: ProbePilotToSpice.title(design),
      cards
    });

    return {
      netlist: netlist.getString(),
      errors: [],
      terminalNodeNames: nodes.terminalNodeNames,
      componentElementNames
    };
  }

  private static failure(errors: readonly SpiceConversionError[]): SpiceConversionResult {
    return {
      errors,
      terminalNodeNames: {},
      componentElementNames: {}
    };
  }

  private static validateComponents(
    components: readonly CircuitComponent[]
  ): readonly SpiceConversionError[] {
    const errors: SpiceConversionError[] = [];
    for (const component of components) {
      if (!ProbePilotToSpice.supports(component.kind)) {
        errors.push({
          code: SpiceConversionErrorCode.UnsupportedComponent,
          componentId: component.id,
          message: `${ComponentDefinitionRegistry.get(component.kind).name} has no verified SPICE mapping.`
        });
        continue;
      }

      if (component.kind !== component.properties.kind) {
        errors.push({
          code: SpiceConversionErrorCode.InvalidComponentValue,
          componentId: component.id,
          message: `${component.id} has mismatched component and property kinds.`
        });
        continue;
      }

      if (modelBackedKinds.has(component.kind) && !SpiceModelRegistry.cardFor(component.kind)) {
        errors.push({
          code: SpiceConversionErrorCode.MissingModel,
          componentId: component.id,
          message: `${component.id} has no registered SPICE model card.`
        });
        continue;
      }

      const invalidValue = ProbePilotToSpice.invalidComponentValue(component);
      if (invalidValue) {
        errors.push({
          code: SpiceConversionErrorCode.InvalidComponentValue,
          componentId: component.id,
          message: invalidValue
        });
      }
    }
    return errors;
  }

  private static invalidComponentValue(component: CircuitComponent): string | undefined {
    const properties = component.properties;
    switch (properties.kind) {
      case ComponentKind.DcSource:
      case ComponentKind.Battery:
        return ProbePilotToSpice.finiteMessage(component.id, "voltage", properties.voltage);
      case ComponentKind.CurrentSource:
        return ProbePilotToSpice.finiteMessage(component.id, "current", properties.currentAmps);
      case ComponentKind.Resistor:
        return ProbePilotToSpice.positiveMessage(component.id, "resistance", properties.resistanceOhms);
      case ComponentKind.Capacitor:
        return ProbePilotToSpice.positiveMessage(component.id, "capacitance", properties.capacitanceFarads);
      case ComponentKind.Inductor:
        return ProbePilotToSpice.positiveMessage(component.id, "inductance", properties.inductanceHenries);
      case ComponentKind.Diode:
      case ComponentKind.SchottkyDiode:
      case ComponentKind.Led:
        return ProbePilotToSpice.positiveMessage(component.id, "forward voltage", properties.forwardVoltage);
      case ComponentKind.ZenerDiode:
        return ProbePilotToSpice.positiveMessage(component.id, "zener voltage", properties.zenerVoltage);
      case ComponentKind.Fuse:
        return ProbePilotToSpice.positiveMessage(component.id, "current rating", properties.currentRatingAmps);
      case ComponentKind.Potentiometer:
        return ProbePilotToSpice.positiveMessage(component.id, "resistance", properties.resistanceOhms)
          ?? (Number.isFinite(properties.wiperPosition) && properties.wiperPosition >= 0 && properties.wiperPosition <= 1
            ? undefined
            : `${component.id} must have a wiper position from 0 to 1.`);
      case ComponentKind.Ground:
      case ComponentKind.Switch:
      case ComponentKind.PushButton:
      case ComponentKind.SpdtSwitch:
        return undefined;
      default:
        return undefined;
    }
  }

  private static finiteMessage(componentId: string, propertyName: string, value: number): string | undefined {
    return Number.isFinite(value)
      ? undefined
      : `${componentId} must have a finite ${propertyName}.`;
  }

  private static positiveMessage(componentId: string, propertyName: string, value: number): string | undefined {
    return Number.isFinite(value) && value > 0
      ? undefined
      : `${componentId} must have a positive ${propertyName}.`;
  }

  private static validateGround(
    components: readonly CircuitComponent[]
  ): readonly SpiceConversionError[] {
    return components.some((component) => component.kind === ComponentKind.Ground)
      ? []
      : [{
          code: SpiceConversionErrorCode.MissingGround,
          message: "SPICE conversion requires an explicit ground component mapped to node 0."
        }];
  }

  private static validateGroundConnectivity(
    components: readonly CircuitComponent[],
    executableIslandSets: TerminalSets
  ): readonly SpiceConversionError[] {
    const groundRoots = new Set(
      components
        .filter((component) => component.kind === ComponentKind.Ground)
        .flatMap((component) => ComponentDefinitionRegistry.get(component.kind).terminals.map(
          (terminal) => executableIslandSets.root(ProbePilotToSpice.terminalKey({
            componentId: component.id,
            terminalId: terminal.id
          }))
        ))
    );
    const componentIdsByRoot = new Map<string, string[]>();
    for (const component of components.filter((item) => item.kind !== ComponentKind.Ground)) {
      const firstTerminal = ComponentDefinitionRegistry.get(component.kind).terminals[0];
      if (!firstTerminal) continue;
      const root = executableIslandSets.root(ProbePilotToSpice.terminalKey({
        componentId: component.id,
        terminalId: firstTerminal.id
      }));
      const componentIds = componentIdsByRoot.get(root) ?? [];
      componentIds.push(component.id);
      componentIdsByRoot.set(root, componentIds);
    }

    return [...componentIdsByRoot.entries()]
      .filter(([root]) => !groundRoots.has(root))
      .map(([, componentIds]) => [...componentIds].sort((left, right) => left.localeCompare(right)))
      .sort((left, right) => (left[0] ?? "").localeCompare(right[0] ?? ""))
      .map((affectedComponentIds) => ({
        code: SpiceConversionErrorCode.DisconnectedGround,
        affectedComponentIds,
        message: `Executable SPICE island is not connected to ground: ${affectedComponentIds.join(", ")}.`
      }));
  }

  private static validateConnections(
    design: CircuitDesign,
    terminalKeys: ReadonlySet<string>
  ): readonly SpiceConversionError[] {
    return Object.values(design.wires)
      .sort((left, right) => left.id.localeCompare(right.id))
      .flatMap((wire) => {
        const missingEndpoints = [wire.a, wire.b].filter(
          (terminal) => !terminalKeys.has(ProbePilotToSpice.terminalKey(terminal))
        );
        return missingEndpoints.map((terminal) => ({
          code: SpiceConversionErrorCode.InvalidConnection,
          wireId: wire.id,
          componentId: terminal.componentId,
          message: `${wire.id} references missing terminal ${ProbePilotToSpice.terminalKey(terminal)}.`
        }));
      });
  }

  private static validateRequest(
    design: CircuitDesign,
    request: SimulationRequest,
    terminalKeys: ReadonlySet<string>
  ): readonly SpiceConversionError[] {
    const errors: SpiceConversionError[] = [];
    const analysis = request.analysis;
    if (analysis) errors.push(...ProbePilotToSpice.validateAnalysis(design, analysis));
    for (const probe of request.probes ?? []) {
      const probeError = ProbePilotToSpice.validateProbe(design, probe, terminalKeys);
      if (probeError) errors.push(probeError);
    }
    return errors;
  }

  private static validateAnalysis(
    design: CircuitDesign,
    analysis: SimulationAnalysis
  ): readonly SpiceConversionError[] {
    switch (analysis.type) {
      case SimulationAnalysisType.OperatingPoint:
        return [];
      case SimulationAnalysisType.DcSweep:
        return ProbePilotToSpice.validateSweepSource(design, analysis.sourceComponentId)
          ?? ProbePilotToSpice.validateFiniteAnalysisValues([
            ["start", analysis.start],
            ["stop", analysis.stop],
            ["step", analysis.step]
          ], analysis.step > 0 && analysis.stop > analysis.start);
      case SimulationAnalysisType.AcSweep:
        return ProbePilotToSpice.validateSweepSource(design, analysis.sourceComponentId)
          ?? ProbePilotToSpice.validateFiniteAnalysisValues([
            ["start frequency", analysis.startHertz],
            ["stop frequency", analysis.stopHertz],
            ["magnitude", analysis.magnitude ?? 1],
            ["phase", analysis.phaseDegrees ?? 0]
          ], analysis.points > 0
            && Number.isInteger(analysis.points)
            && analysis.startHertz > 0
            && analysis.stopHertz > analysis.startHertz);
      case SimulationAnalysisType.Transient: {
        const startSeconds = analysis.startSeconds ?? 0;
        const maximumStepSeconds = analysis.maximumStepSeconds ?? analysis.stepSeconds;
        return ProbePilotToSpice.validateFiniteAnalysisValues([
          ["step", analysis.stepSeconds],
          ["stop", analysis.stopSeconds],
          ["start", startSeconds],
          ["maximum step", maximumStepSeconds]
        ], analysis.stepSeconds > 0
          && analysis.stopSeconds > 0
          && startSeconds >= 0
          && startSeconds < analysis.stopSeconds
          && maximumStepSeconds > 0);
      }
    }
  }

  private static validateSweepSource(
    design: CircuitDesign,
    componentId: string
  ): readonly SpiceConversionError[] | undefined {
    const source = design.components[componentId];
    const validSource = source?.properties.kind === ComponentKind.Battery
      || (source?.properties.kind === ComponentKind.DcSource && source.properties.enabled)
      || (source?.properties.kind === ComponentKind.CurrentSource && source.properties.enabled);
    return validSource
      ? undefined
      : [{
          code: SpiceConversionErrorCode.InvalidAnalysis,
          componentId,
          message: `${componentId} is not a mapped independent source for this sweep.`
        }];
  }

  private static validateFiniteAnalysisValues(
    values: readonly (readonly [string, number])[],
    validBounds: boolean
  ): readonly SpiceConversionError[] {
    const invalid = values.find(([, value]) => !Number.isFinite(value));
    return !invalid && validBounds
      ? []
      : [{
          code: SpiceConversionErrorCode.InvalidAnalysis,
          message: invalid
            ? `Simulation analysis has a non-finite ${invalid[0]} value.`
            : "Simulation analysis has invalid numeric bounds."
        }];
  }

  private static validateProbe(
    design: CircuitDesign,
    probe: SimulationProbe,
    terminalKeys: ReadonlySet<string>
  ): SpiceConversionError | undefined {
    const component = design.components[probe.componentId];
    if (!component) {
      return {
        code: SpiceConversionErrorCode.InvalidProbe,
        componentId: probe.componentId,
        message: `Probe references missing component ${probe.componentId}.`
      };
    }
    if (probe.kind === SimulationProbeKind.NodeVoltage) {
      const key = ProbePilotToSpice.terminalKey(probe);
      return terminalKeys.has(key)
        ? undefined
        : {
            code: SpiceConversionErrorCode.InvalidProbe,
            componentId: probe.componentId,
            message: `Probe references missing terminal ${key}.`
          };
    }
    if (
      component.kind === ComponentKind.Ground
      || component.kind === ComponentKind.Potentiometer
      || component.kind === ComponentKind.SpdtSwitch
    ) {
      return {
        code: SpiceConversionErrorCode.InvalidProbe,
        componentId: probe.componentId,
        message: `${probe.componentId} does not have one unambiguous SPICE element current.`
      };
    }
    return undefined;
  }

  private static terminalKeys(components: readonly CircuitComponent[]): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const component of components) {
      for (const terminal of ComponentDefinitionRegistry.get(component.kind).terminals) {
        keys.add(ProbePilotToSpice.terminalKey({
          componentId: component.id,
          terminalId: terminal.id
        }));
      }
    }
    return keys;
  }

  private static connectTerminals(
    design: CircuitDesign,
    terminalKeys: ReadonlySet<string>
  ): TerminalSets {
    const sets = new TerminalSets();
    for (const terminalKey of terminalKeys) sets.add(terminalKey);
    for (const wire of Object.values(design.wires).sort((left, right) => left.id.localeCompare(right.id))) {
      sets.connect(
        ProbePilotToSpice.terminalKey(wire.a),
        ProbePilotToSpice.terminalKey(wire.b)
      );
    }
    return sets;
  }

  private static connectExecutableIslands(
    design: CircuitDesign,
    components: readonly CircuitComponent[],
    terminalKeys: ReadonlySet<string>
  ): TerminalSets {
    const sets = ProbePilotToSpice.connectTerminals(design, terminalKeys);
    for (const component of components.filter((item) => item.kind !== ComponentKind.Ground)) {
      const [firstTerminal, ...remainingTerminals] = ComponentDefinitionRegistry.get(component.kind).terminals;
      if (!firstTerminal) continue;
      const firstTerminalKey = ProbePilotToSpice.terminalKey({
        componentId: component.id,
        terminalId: firstTerminal.id
      });
      for (const terminal of remainingTerminals) {
        sets.connect(firstTerminalKey, ProbePilotToSpice.terminalKey({
          componentId: component.id,
          terminalId: terminal.id
        }));
      }
    }
    return sets;
  }

  private static allocateElements(
    components: readonly CircuitComponent[]
  ): readonly ElementAllocation[] {
    const allocations: ElementAllocation[] = [];
    const counters = new Map<SpiceElementNameGroup, number>();
    for (const kind of componentCardOrder) {
      const kindComponents = components
        .filter((component) => component.kind === kind)
        .sort((left, right) => left.id.localeCompare(right.id));
      for (const component of kindComponents) {
        const group = ProbePilotToSpice.elementNameGroup(kind);
        const nextNumber = (counters.get(group) ?? 0) + 1;
        counters.set(group, nextNumber);
        allocations.push({
          component,
          names: kind === ComponentKind.Potentiometer || kind === ComponentKind.SpdtSwitch
            ? [`${group}${nextNumber}A`, `${group}${nextNumber}B`]
            : [`${group}${nextNumber}`]
        });
      }
    }
    return allocations;
  }

  private static elementNameGroup(kind: ComponentKindValue): SpiceElementNameGroup {
    switch (kind) {
      case ComponentKind.DcSource:
      case ComponentKind.Battery:
        return SpiceElementNameGroup.VoltageSource;
      case ComponentKind.CurrentSource:
        return SpiceElementNameGroup.CurrentSource;
      case ComponentKind.Resistor:
        return SpiceElementNameGroup.Resistor;
      case ComponentKind.Capacitor:
        return SpiceElementNameGroup.Capacitor;
      case ComponentKind.Inductor:
        return SpiceElementNameGroup.Inductor;
      case ComponentKind.Diode:
      case ComponentKind.ZenerDiode:
      case ComponentKind.SchottkyDiode:
      case ComponentKind.Led:
        return SpiceElementNameGroup.Diode;
      case ComponentKind.Switch:
        return SpiceElementNameGroup.Switch;
      case ComponentKind.PushButton:
        return SpiceElementNameGroup.PushButton;
      case ComponentKind.Fuse:
        return SpiceElementNameGroup.Fuse;
      case ComponentKind.SpdtSwitch:
        return SpiceElementNameGroup.SpdtSwitch;
      case ComponentKind.Potentiometer:
        return SpiceElementNameGroup.Potentiometer;
      default:
        return SpiceElementNameGroup.Resistor;
    }
  }

  private static allocateNodes(
    components: readonly CircuitComponent[],
    allocations: readonly ElementAllocation[],
    terminalSets: TerminalSets
  ): NodeAllocation {
    const nodeByRoot = new Map<string, string>();
    for (const groundComponent of components.filter((component) => component.kind === ComponentKind.Ground)) {
      for (const terminal of ComponentDefinitionRegistry.get(groundComponent.kind).terminals) {
        nodeByRoot.set(
          terminalSets.root(ProbePilotToSpice.terminalKey({
            componentId: groundComponent.id,
            terminalId: terminal.id
          })),
          SpiceNodeName.Ground
        );
      }
    }

    let nodeNumber = 0;
    const orderedComponents = [
      ...allocations.map((allocation) => allocation.component),
      ...components
        .filter((component) => component.kind === ComponentKind.Ground)
        .sort((left, right) => left.id.localeCompare(right.id))
    ];
    for (const component of orderedComponents) {
      for (const terminal of ComponentDefinitionRegistry.get(component.kind).terminals) {
        const root = terminalSets.root(ProbePilotToSpice.terminalKey({
          componentId: component.id,
          terminalId: terminal.id
        }));
        if (!nodeByRoot.has(root)) {
          nodeNumber += 1;
          nodeByRoot.set(root, `n${nodeNumber}`);
        }
      }
    }

    const terminalNodeEntries = components
      .flatMap((component) => ComponentDefinitionRegistry.get(component.kind).terminals.map((terminal) => {
        const terminalKey = ProbePilotToSpice.terminalKey({
          componentId: component.id,
          terminalId: terminal.id
        });
        const node = nodeByRoot.get(terminalSets.root(terminalKey));
        if (!node) throw new Error(`No SPICE node was allocated for ${terminalKey}.`);
        return [terminalKey, node] as const;
      }))
      .sort(([left], [right]) => left.localeCompare(right));

    return {
      terminalNodeNames: Object.fromEntries(terminalNodeEntries),
      nodeForTerminal: new Map(terminalNodeEntries)
    };
  }

  private static createElementCards(
    allocations: readonly ElementAllocation[],
    nodeForTerminal: ReadonlyMap<string, string>,
    request: SimulationRequest
  ): SpiceCardInput[] {
    return allocations.flatMap<SpiceCardInput>((allocation): SpiceCardInput[] => {
      const component = allocation.component;
      const properties = component.properties;
      const firstName = allocation.names[0];
      if (!firstName) throw new Error(`No SPICE element name was allocated for ${component.id}.`);
      const node = (terminalId: TerminalId): string => {
        const value = nodeForTerminal.get(ProbePilotToSpice.terminalKey({
          componentId: component.id,
          terminalId
        }));
        if (!value) throw new Error(`No SPICE node was allocated for ${component.id}:${terminalId}.`);
        return value;
      };

      switch (properties.kind) {
        case ComponentKind.DcSource:
          return [new SpiceVoltageSource({
            name: firstName,
            nodes: [node(TerminalId.Positive), node(TerminalId.Negative)],
            dc: ProbePilotToSpice.formatNumber(properties.enabled ? properties.voltage : 0),
            ac: ProbePilotToSpice.acSpec(request.analysis, component.id)
          })];
        case ComponentKind.Battery:
          return [new SpiceVoltageSource({
            name: firstName,
            nodes: [node(TerminalId.Positive), node(TerminalId.Negative)],
            dc: ProbePilotToSpice.formatNumber(properties.voltage),
            ac: ProbePilotToSpice.acSpec(request.analysis, component.id)
          })];
        case ComponentKind.CurrentSource:
          return [new SpiceCurrentSource({
            name: firstName,
            nodes: [node(TerminalId.Positive), node(TerminalId.Negative)],
            dc: ProbePilotToSpice.formatNumber(properties.enabled ? properties.currentAmps : 0),
            ac: ProbePilotToSpice.acSpec(request.analysis, component.id)
          })];
        case ComponentKind.Resistor:
          return [new SpiceResistor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            resistance: ProbePilotToSpice.formatEngineering(properties.resistanceOhms)
          })];
        case ComponentKind.Capacitor:
          return [new SpiceCapacitor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            capacitance: ProbePilotToSpice.formatEngineering(properties.capacitanceFarads)
          })];
        case ComponentKind.Inductor:
          return [new SpiceInductor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            inductance: ProbePilotToSpice.formatEngineering(properties.inductanceHenries)
          })];
        case ComponentKind.ZenerDiode:
          return [new SpiceDiode({
            name: firstName,
            nodes: [node(TerminalId.Anode), node(TerminalId.Cathode)],
            model: SpiceModelRegistry.zenerModelName(properties.zenerVoltage)
          })];
        case ComponentKind.Diode:
        case ComponentKind.SchottkyDiode:
        case ComponentKind.Led: {
          const modelName = SpiceModelRegistry.modelNameFor(properties.kind);
          if (!modelName) throw new Error(`No registered SPICE model for ${component.id}.`);
          return [new SpiceDiode({
            name: firstName,
            nodes: [node(TerminalId.Anode), node(TerminalId.Cathode)],
            model: modelName
          })];
        }
        case ComponentKind.Switch:
          return [new SpiceResistor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            resistance: properties.closed ? SpiceIdealResistance.Closed : SpiceIdealResistance.Open
          })];
        case ComponentKind.PushButton:
          return [new SpiceResistor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            resistance: properties.pressed ? SpiceIdealResistance.Closed : SpiceIdealResistance.Open
          })];
        case ComponentKind.Fuse:
          return [new SpiceResistor({
            name: firstName,
            nodes: [node(TerminalId.A), node(TerminalId.B)],
            resistance: SpiceIdealResistance.Closed
          })];
        case ComponentKind.SpdtSwitch: {
          const secondName = allocation.names[1];
          if (!secondName) throw new Error(`SPDT switch ${component.id} needs two SPICE element names.`);
          return [
            new SpiceResistor({
              name: firstName,
              nodes: [node(TerminalId.Common), node(TerminalId.A)],
              resistance: properties.position === SpdtPosition.A
                ? SpiceIdealResistance.Closed
                : SpiceIdealResistance.Open
            }),
            new SpiceResistor({
              name: secondName,
              nodes: [node(TerminalId.Common), node(TerminalId.B)],
              resistance: properties.position === SpdtPosition.B
                ? SpiceIdealResistance.Closed
                : SpiceIdealResistance.Open
            })
          ];
        }
        case ComponentKind.Potentiometer: {
          const secondName = allocation.names[1];
          if (!secondName) throw new Error(`Potentiometer ${component.id} needs two SPICE element names.`);
          const firstResistance = properties.resistanceOhms * properties.wiperPosition;
          const secondResistance = properties.resistanceOhms - firstResistance;
          return [
            new SpiceResistor({
              name: firstName,
              nodes: [node(TerminalId.A), node(TerminalId.Wiper)],
              resistance: firstResistance === 0
                ? SpiceIdealResistance.Closed
                : ProbePilotToSpice.formatEngineering(firstResistance)
            }),
            new SpiceResistor({
              name: secondName,
              nodes: [node(TerminalId.Wiper), node(TerminalId.B)],
              resistance: secondResistance === 0
                ? SpiceIdealResistance.Closed
                : ProbePilotToSpice.formatEngineering(secondResistance)
            })
          ];
        }
        default:
          return [];
      }
    });
  }

  private static createModelCards(components: readonly CircuitComponent[]): SpiceCardInput[] {
    const presentKinds = new Set(components.map((component) => component.kind));
    return modelCardOrder.flatMap((kind) => {
      if (!presentKinds.has(kind)) return [];
      if (kind === ComponentKind.ZenerDiode) {
        return components
          .flatMap((component) => component.properties.kind === ComponentKind.ZenerDiode
            ? [component.properties.zenerVoltage]
            : [])
          .filter((voltage, index, voltages) => voltages.indexOf(voltage) === index)
          .sort((left, right) => left - right)
          .map((voltage) => SpiceModelRegistry.zenerCardFor(voltage));
      }
      const card = SpiceModelRegistry.cardFor(kind);
      return card ? [card] : [];
    });
  }

  private static createAnalysisCard(
    analysis: SimulationAnalysis | undefined,
    componentElementNames: Readonly<Record<string, readonly string[]>>
  ): SpiceCardInput {
    if (!analysis || analysis.type === SimulationAnalysisType.OperatingPoint) return new Op();
    switch (analysis.type) {
      case SimulationAnalysisType.DcSweep:
        return new Dc({
          source: ProbePilotToSpice.firstElementName(componentElementNames, analysis.sourceComponentId),
          start: ProbePilotToSpice.formatNumber(analysis.start),
          stop: ProbePilotToSpice.formatNumber(analysis.stop),
          step: ProbePilotToSpice.formatNumber(analysis.step)
        });
      case SimulationAnalysisType.AcSweep:
        return new Ac({
          sweep: ProbePilotToSpice.acSweepToken(analysis.scale),
          points: analysis.points,
          start: ProbePilotToSpice.formatEngineering(analysis.startHertz),
          stop: ProbePilotToSpice.formatEngineering(analysis.stopHertz)
        });
      case SimulationAnalysisType.Transient:
        return new Tran({
          step: ProbePilotToSpice.formatEngineering(analysis.stepSeconds),
          stop: ProbePilotToSpice.formatEngineering(analysis.stopSeconds),
          start: analysis.startSeconds === undefined
            ? undefined
            : ProbePilotToSpice.formatEngineering(analysis.startSeconds),
          maxStep: analysis.maximumStepSeconds === undefined
            ? undefined
            : ProbePilotToSpice.formatEngineering(analysis.maximumStepSeconds),
          uic: analysis.useInitialConditions
        });
    }
  }

  private static createProbeCard(
    probes: readonly SimulationProbe[],
    nodeForTerminal: ReadonlyMap<string, string>,
    componentElementNames: Readonly<Record<string, readonly string[]>>
  ): Probe | undefined {
    const expressions = probes.map((probe) => {
      if (probe.kind === SimulationProbeKind.NodeVoltage) {
        const node = nodeForTerminal.get(ProbePilotToSpice.terminalKey(probe));
        if (!node) throw new Error(`No SPICE node was allocated for probe ${probe.componentId}:${probe.terminalId}.`);
        return `V(${node})`;
      }
      return `I(${ProbePilotToSpice.firstElementName(componentElementNames, probe.componentId)})`;
    }).filter((expression, index, allExpressions) => allExpressions.indexOf(expression) === index);
    return expressions.length > 0 ? new Probe(expressions) : undefined;
  }

  private static acSpec(
    analysis: SimulationAnalysis | undefined,
    componentId: string
  ): { magnitude: string; phase: string } | undefined {
    if (!analysis || analysis.type !== SimulationAnalysisType.AcSweep || analysis.sourceComponentId !== componentId) {
      return undefined;
    }
    return {
      magnitude: ProbePilotToSpice.formatNumber(analysis.magnitude ?? 1),
      phase: ProbePilotToSpice.formatNumber(analysis.phaseDegrees ?? 0)
    };
  }

  private static acSweepToken(scale: SimulationSweepScale): SpiceAcSweepToken {
    switch (scale) {
      case SimulationSweepScale.Linear:
        return SpiceAcSweepToken.Linear;
      case SimulationSweepScale.Decade:
        return SpiceAcSweepToken.Decade;
      case SimulationSweepScale.Octave:
        return SpiceAcSweepToken.Octave;
    }
  }

  private static firstElementName(
    componentElementNames: Readonly<Record<string, readonly string[]>>,
    componentId: string
  ): string {
    const name = componentElementNames[componentId]?.[0];
    if (!name) throw new Error(`No SPICE element name was allocated for ${componentId}.`);
    return name;
  }

  private static terminalKey(terminal: TerminalRef): string {
    return `${terminal.componentId}:${terminal.terminalId}`;
  }

  private static title(design: CircuitDesign): string {
    const normalizedName = design.name.replace(/[\r\n]+/g, " ").trim();
    if (normalizedName) return normalizedName;
    const normalizedId = design.id.replace(/[\r\n]+/g, " ").trim();
    return normalizedId || "ProbePilot circuit";
  }

  private static formatEngineering(value: number): string {
    if (value === 0) return "0";
    const scales: readonly (readonly [number, SpiceEngineeringSuffix])[] = [
      [1e12, SpiceEngineeringSuffix.Tera],
      [1e9, SpiceEngineeringSuffix.Giga],
      [1e6, SpiceEngineeringSuffix.Mega],
      [1e3, SpiceEngineeringSuffix.Kilo],
      [1, SpiceEngineeringSuffix.Unit],
      [1e-3, SpiceEngineeringSuffix.Milli],
      [1e-6, SpiceEngineeringSuffix.Micro],
      [1e-9, SpiceEngineeringSuffix.Nano],
      [1e-12, SpiceEngineeringSuffix.Pico],
      [1e-15, SpiceEngineeringSuffix.Femto]
    ];
    const absoluteValue = Math.abs(value);
    const scale = scales.find(([multiplier]) => absoluteValue >= multiplier);
    if (!scale) return ProbePilotToSpice.formatNumber(value);
    return `${ProbePilotToSpice.formatNumber(value / scale[0])}${scale[1]}`;
  }

  private static formatNumber(value: number): string {
    if (value === 0) return "0";
    return Number(value.toPrecision(12)).toString();
  }
}
