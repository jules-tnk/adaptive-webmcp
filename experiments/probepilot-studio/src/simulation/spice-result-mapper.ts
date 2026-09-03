import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import {
  ComponentKind,
  SimulationEngineId,
  SimulationWaveformAxis,
  SimulationWaveformQuantity,
  type CircuitDesign,
  type ComponentSimulation,
  type ObservableOutput,
  type SimulationResult,
  type SimulationWaveform,
  type SimulationWaveformPoint
} from "@/domain/types";
import {
  SpiceDcSweepUnit,
  SpicePayloadType,
  type SpiceEnginePayload
} from "@/tscircuit/spice-engine-payload";
import { z } from "zod";
import {
  SimulationAnalysisType,
  SimulationProbeKind,
  type SimulationAnalysis,
  type SimulationRequest
} from "./simulation-engine";

export { SpiceDcSweepUnit, SpicePayloadType } from "@/tscircuit/spice-engine-payload";

const finiteNumber = z.number().finite();
const payloadName = z.string().trim().min(1);
const complexSample = z.object({ re: finiteNumber, im: finiteNumber });
const transientBase = {
  name: payloadName,
  timestamps_ms: z.array(finiteNumber),
  time_per_step: finiteNumber,
  start_time_ms: finiteNumber,
  end_time_ms: finiteNumber
};
const dcSweepBase = {
  name: payloadName,
  sweep_values: z.array(finiteNumber),
  sweep_unit: z.nativeEnum(SpiceDcSweepUnit)
};
const acSweepBase = {
  name: payloadName,
  frequencies_hz: z.array(finiteNumber)
};
const spicePayloadElementSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(SpicePayloadType.TransientVoltage),
    ...transientBase,
    voltage_levels: z.array(finiteNumber)
  }),
  z.object({
    type: z.literal(SpicePayloadType.TransientCurrent),
    ...transientBase,
    current_levels: z.array(finiteNumber)
  }),
  z.object({
    type: z.literal(SpicePayloadType.OperatingPointVoltage),
    name: payloadName,
    voltage: finiteNumber
  }),
  z.object({
    type: z.literal(SpicePayloadType.OperatingPointCurrent),
    name: payloadName,
    current: finiteNumber
  }),
  z.object({
    type: z.literal(SpicePayloadType.DcSweepVoltage),
    ...dcSweepBase,
    voltage_levels: z.array(finiteNumber)
  }),
  z.object({
    type: z.literal(SpicePayloadType.DcSweepCurrent),
    ...dcSweepBase,
    current_levels: z.array(finiteNumber)
  }),
  z.object({
    type: z.literal(SpicePayloadType.AcSweepVoltage),
    ...acSweepBase,
    complex_voltages: z.array(complexSample)
  }),
  z.object({
    type: z.literal(SpicePayloadType.AcSweepCurrent),
    ...acSweepBase,
    complex_currents: z.array(complexSample)
  })
]);
const spicePayloadSchema = z.object({
  engineVersionString: z.string().optional(),
  simulationResultCircuitJson: z.array(spicePayloadElementSchema).min(1)
});

type SpicePayloadElement = z.infer<typeof spicePayloadElementSchema>;

interface SpiceComplexValue {
  readonly re: number;
  readonly im: number;
}

interface SpiceComplexScalarValue {
  readonly name: string;
  readonly value: SpiceComplexValue;
}

interface SpiceWaveformTarget {
  readonly componentId?: string;
  readonly terminalId?: string;
  readonly label: string;
  readonly idSuffix: string;
}

interface SpiceTerminalNodeMapping {
  readonly componentId: string;
  readonly terminalId: string;
  readonly terminalKey: string;
  readonly nodeName: string;
}

interface SpicePayloadExpectation {
  readonly analysisLabel: string;
  readonly voltageType: SpicePayloadType;
  readonly currentType: SpicePayloadType;
}

export interface SpiceResultMappingInput {
  readonly design: CircuitDesign;
  readonly request: SimulationRequest;
  readonly terminalNodeNames: Readonly<Record<string, string>>;
  readonly componentElementNames: Readonly<Record<string, readonly string[]>>;
  readonly payload: SpiceEnginePayload;
}

export class SpiceResultMapper {
  static readonly MaximumWaveformPoints = 1_000;
  private static readonly VoltageTolerance = 1e-9;
  private static readonly CurrentTolerance = 1e-12;
  private static readonly LedOnCurrentThreshold = 1e-6;

  static map(input: SpiceResultMappingInput): SimulationResult {
    const parsedPayload = spicePayloadSchema.safeParse(input.payload);
    if (!parsedPayload.success) {
      throw new Error("Invalid SPICE engine payload: simulation data did not match the package contract.");
    }

    const elements = parsedPayload.data.simulationResultCircuitJson;
    const terminalMappings = SpiceResultMapper.terminalMappings(input);
    SpiceResultMapper.validatePayload(elements, input, terminalMappings);
    const nodeValues = SpiceResultMapper.nodeValues(elements);
    nodeValues.set("0", { re: 0, im: 0 });
    const currentValues = SpiceResultMapper.currentValues(elements);
    const nodeVoltages = Object.fromEntries(
      terminalMappings.map((mapping) => {
        const value = nodeValues.get(mapping.nodeName);
        if (!value) {
          throw new Error(`Invalid SPICE engine payload: missing voltage vector ${mapping.nodeName}.`);
        }
        const scalar = SpiceResultMapper.isAcAnalysis(input.request.analysis)
          ? Math.hypot(value.re, value.im)
          : value.re;
        return [mapping.terminalKey, SpiceResultMapper.normalizeVoltage(scalar)] as const;
      })
    );
    const branchCurrents: Record<string, number> = {};
    const components: Record<string, ComponentSimulation> = {};

    for (const [componentId, elementNames] of Object.entries(input.componentElementNames)
      .sort(([left], [right]) => left.localeCompare(right))) {
      const component = input.design.components[componentId];
      if (!component) continue;
      const elementCurrents = elementNames.map((elementName) => {
        const value = currentValues.get(SpiceResultMapper.normalizeElementName(elementName));
        if (value === undefined) {
          throw new Error(`Invalid SPICE engine payload: missing current vector ${elementName}.`);
        }
        return value;
      });
      const currentAmps = SpiceResultMapper.normalizeCurrent(
        Math.max(...elementCurrents.map(Math.abs)),
        true
      );
      const terminalVoltages = terminalMappings
        .filter((mapping) => mapping.componentId === componentId)
        .map((mapping) => {
          const value = nodeValues.get(mapping.nodeName);
          if (!value) {
            throw new Error(`Invalid SPICE engine payload: missing voltage vector ${mapping.nodeName}.`);
          }
          return value;
        });
      const voltageDrop = SpiceResultMapper.componentVoltageDrop(terminalVoltages);
      const state = SpiceResultMapper.componentState(component, currentAmps);

      branchCurrents[componentId] = currentAmps;
      components[componentId] = {
        voltageDrop,
        currentAmps,
        ...(state ? { state } : {})
      };
    }

    const waveforms = [
      ...elements.flatMap((element) => SpiceResultMapper.waveform(element, input, terminalMappings)),
      ...SpiceResultMapper.groundWaveforms(elements, input, terminalMappings)
    ]
      .filter((waveform, index, allWaveforms) =>
        allWaveforms.findIndex((candidate) => candidate.id === waveform.id) === index
      );
    const observableOutputs: ObservableOutput[] = Object.values(input.design.components)
      .filter((component) => component.kind === ComponentKind.Led)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((component) => ({
        componentId: component.id,
        label: component.label,
        expectedState: components[component.id]?.state === "on" ? "on" : "off"
      }));

    return {
      status: "pass",
      designRevision: input.design.revision,
      issues: [],
      nodeVoltages,
      branchCurrents,
      components,
      observableOutputs,
      summary: SpiceResultMapper.summary(input.request.analysis),
      engineId: SimulationEngineId.Spice,
      ...(waveforms.length > 0 ? { waveforms } : {})
    };
  }

  private static terminalMappings(
    input: SpiceResultMappingInput
  ): readonly SpiceTerminalNodeMapping[] {
    const mappings = Object.values(input.design.components)
      .sort((left, right) => left.id.localeCompare(right.id))
      .flatMap((component) => ComponentDefinitionRegistry.get(component.kind).terminals.map((terminal) => {
        const terminalKey = `${component.id}:${terminal.id}`;
        if (!Object.prototype.hasOwnProperty.call(input.terminalNodeNames, terminalKey)) {
          throw new Error(`Invalid SPICE mapping: missing terminal mapping ${terminalKey}.`);
        }
        const nodeName = SpiceResultMapper.normalizeNodeName(
          input.terminalNodeNames[terminalKey] ?? ""
        );
        if (!nodeName) {
          throw new Error(`Invalid SPICE mapping: terminal ${terminalKey} has no node name.`);
        }
        return {
          componentId: component.id,
          terminalId: terminal.id,
          terminalKey,
          nodeName
        };
      }));
    const expectedKeys = new Set(mappings.map((mapping) => mapping.terminalKey));
    const unmappedKey = Object.keys(input.terminalNodeNames)
      .find((terminalKey) => !expectedKeys.has(terminalKey));
    if (unmappedKey) {
      throw new Error(`Invalid SPICE mapping: unmapped terminal mapping ${unmappedKey}.`);
    }
    return mappings;
  }

  private static validatePayload(
    elements: readonly SpicePayloadElement[],
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): void {
    const expectation = SpiceResultMapper.payloadExpectation(input.request.analysis);
    for (const element of elements) {
      if (element.type !== expectation.voltageType && element.type !== expectation.currentType) {
        throw new Error(
          `Invalid SPICE engine payload: analysis vectors do not match requested ${expectation.analysisLabel} analysis.`
        );
      }
    }
    SpiceResultMapper.validateSeriesLengths(elements);
    SpiceResultMapper.validateComponentMappings(input);
    SpiceResultMapper.validateVectorCoverage(elements, input, terminalMappings, expectation);
    SpiceResultMapper.validateSeriesCoordinates(elements);
  }

  private static payloadExpectation(
    analysis: SimulationAnalysis | undefined
  ): SpicePayloadExpectation {
    switch (analysis?.type) {
      case SimulationAnalysisType.Transient:
        return {
          analysisLabel: "transient",
          voltageType: SpicePayloadType.TransientVoltage,
          currentType: SpicePayloadType.TransientCurrent
        };
      case SimulationAnalysisType.DcSweep:
        return {
          analysisLabel: "DC sweep",
          voltageType: SpicePayloadType.DcSweepVoltage,
          currentType: SpicePayloadType.DcSweepCurrent
        };
      case SimulationAnalysisType.AcSweep:
        return {
          analysisLabel: "AC sweep",
          voltageType: SpicePayloadType.AcSweepVoltage,
          currentType: SpicePayloadType.AcSweepCurrent
        };
      case SimulationAnalysisType.OperatingPoint:
      default:
        return {
          analysisLabel: "operating point",
          voltageType: SpicePayloadType.OperatingPointVoltage,
          currentType: SpicePayloadType.OperatingPointCurrent
        };
    }
  }

  private static validateComponentMappings(input: SpiceResultMappingInput): void {
    const componentIds = Object.values(input.design.components)
      .filter((component) => component.kind !== ComponentKind.Ground)
      .map((component) => component.id)
      .sort((left, right) => left.localeCompare(right));
    const expectedComponentIds = new Set(componentIds);
    const unmappedComponentId = Object.keys(input.componentElementNames)
      .find((componentId) => !expectedComponentIds.has(componentId));
    if (unmappedComponentId) {
      throw new Error(`Invalid SPICE mapping: unmapped component ${unmappedComponentId}.`);
    }

    const allocatedNames = new Set<string>();
    for (const componentId of componentIds) {
      const elementNames = input.componentElementNames[componentId];
      if (!elementNames || elementNames.length === 0) {
        throw new Error(`Invalid SPICE mapping: missing element mapping for ${componentId}.`);
      }
      for (const elementName of elementNames) {
        const normalizedName = SpiceResultMapper.normalizeElementName(elementName);
        if (!normalizedName) {
          throw new Error(`Invalid SPICE mapping: ${componentId} has an empty element name.`);
        }
        if (allocatedNames.has(normalizedName)) {
          throw new Error(`Invalid SPICE mapping: duplicate element mapping ${elementName}.`);
        }
        allocatedNames.add(normalizedName);
      }
    }
  }

  private static validateVectorCoverage(
    elements: readonly SpicePayloadElement[],
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[],
    expectation: SpicePayloadExpectation
  ): void {
    const expectedNodes = new Set(
      terminalMappings
        .map((mapping) => mapping.nodeName)
        .filter((nodeName) => nodeName !== "0")
    );
    const expectedElements = new Set(
      Object.values(input.componentElementNames)
        .flat()
        .map((elementName) => SpiceResultMapper.normalizeElementName(elementName))
    );
    const seenNodes = new Map<string, SpicePayloadElement>();
    const seenElements = new Map<string, SpicePayloadElement>();

    for (const element of elements) {
      if (element.type === expectation.voltageType) {
        const nodeName = SpiceResultMapper.normalizeNodeName(element.name);
        if (!expectedNodes.has(nodeName)) {
          throw new Error(`Invalid SPICE engine payload: unmapped voltage vector ${element.name}.`);
        }
        const priorNodeVector = seenNodes.get(nodeName);
        if (priorNodeVector && !SpiceResultMapper.sameVectorValues(priorNodeVector, element)) {
          throw new Error(`Invalid SPICE engine payload: conflicting voltage vector ${element.name}.`);
        }
        seenNodes.set(nodeName, element);
        continue;
      }

      const elementName = SpiceResultMapper.normalizeElementName(element.name);
      if (!expectedElements.has(elementName)) {
        throw new Error(`Invalid SPICE engine payload: unmapped current vector ${element.name}.`);
      }
      const priorElementVector = seenElements.get(elementName);
      if (priorElementVector && !SpiceResultMapper.sameVectorValues(priorElementVector, element)) {
        throw new Error(`Invalid SPICE engine payload: conflicting current vector ${element.name}.`);
      }
      seenElements.set(elementName, element);
    }

    const missingNode = [...expectedNodes].find((nodeName) => !seenNodes.has(nodeName));
    if (missingNode) {
      throw new Error(`Invalid SPICE engine payload: missing voltage vector ${missingNode}.`);
    }
    const missingElement = [...expectedElements]
      .find((elementName) => !seenElements.has(elementName));
    if (missingElement) {
      throw new Error(`Invalid SPICE engine payload: missing current vector ${missingElement}.`);
    }
  }

  private static sameVectorValues(
    left: SpicePayloadElement,
    right: SpicePayloadElement
  ): boolean {
    if (left.type !== right.type) return false;
    switch (left.type) {
      case SpicePayloadType.OperatingPointVoltage:
        return right.type === SpicePayloadType.OperatingPointVoltage
          && SpiceResultMapper.nearlyEqual(left.voltage, right.voltage);
      case SpicePayloadType.OperatingPointCurrent:
        return right.type === SpicePayloadType.OperatingPointCurrent
          && SpiceResultMapper.nearlyEqual(left.current, right.current);
      case SpicePayloadType.TransientVoltage:
        return right.type === SpicePayloadType.TransientVoltage
          && SpiceResultMapper.sameCoordinates(left.voltage_levels, right.voltage_levels);
      case SpicePayloadType.TransientCurrent:
        return right.type === SpicePayloadType.TransientCurrent
          && SpiceResultMapper.sameCoordinates(left.current_levels, right.current_levels);
      case SpicePayloadType.DcSweepVoltage:
        return right.type === SpicePayloadType.DcSweepVoltage
          && SpiceResultMapper.sameCoordinates(left.voltage_levels, right.voltage_levels);
      case SpicePayloadType.DcSweepCurrent:
        return right.type === SpicePayloadType.DcSweepCurrent
          && SpiceResultMapper.sameCoordinates(left.current_levels, right.current_levels);
      case SpicePayloadType.AcSweepVoltage:
        return right.type === SpicePayloadType.AcSweepVoltage
          && SpiceResultMapper.sameComplexValues(left.complex_voltages, right.complex_voltages);
      case SpicePayloadType.AcSweepCurrent:
        return right.type === SpicePayloadType.AcSweepCurrent
          && SpiceResultMapper.sameComplexValues(left.complex_currents, right.complex_currents);
    }
  }

  private static sameComplexValues(
    left: readonly SpiceComplexValue[],
    right: readonly SpiceComplexValue[]
  ): boolean {
    return left.length === right.length && left.every((value, index) => {
      const other = right[index];
      return Boolean(other)
        && SpiceResultMapper.nearlyEqual(value.re, other ? other.re : Number.NaN)
        && SpiceResultMapper.nearlyEqual(value.im, other ? other.im : Number.NaN);
    });
  }

  private static validateSeriesCoordinates(elements: readonly SpicePayloadElement[]): void {
    const referenceElement = elements.find((element) =>
      SpiceResultMapper.seriesCoordinates(element) !== undefined
    );
    if (!referenceElement) return;
    const referenceCoordinates = SpiceResultMapper.seriesCoordinates(referenceElement);
    const referenceUnit = SpiceResultMapper.seriesUnit(referenceElement);
    if (!referenceCoordinates) return;

    for (const element of elements) {
      const coordinates = SpiceResultMapper.seriesCoordinates(element);
      if (!coordinates) continue;
      if (
        !SpiceResultMapper.sameCoordinates(referenceCoordinates, coordinates)
        || SpiceResultMapper.seriesUnit(element) !== referenceUnit
      ) {
        throw new Error(
          `Invalid SPICE engine payload: coordinates for ${element.name} do not match the analysis grid.`
        );
      }
    }
  }

  private static seriesCoordinates(
    element: SpicePayloadElement
  ): readonly number[] | undefined {
    switch (element.type) {
      case SpicePayloadType.TransientVoltage:
      case SpicePayloadType.TransientCurrent:
        return element.timestamps_ms;
      case SpicePayloadType.DcSweepVoltage:
      case SpicePayloadType.DcSweepCurrent:
        return element.sweep_values;
      case SpicePayloadType.AcSweepVoltage:
      case SpicePayloadType.AcSweepCurrent:
        return element.frequencies_hz;
      case SpicePayloadType.OperatingPointVoltage:
      case SpicePayloadType.OperatingPointCurrent:
        return undefined;
    }
  }

  private static seriesUnit(element: SpicePayloadElement): SpiceDcSweepUnit | undefined {
    switch (element.type) {
      case SpicePayloadType.DcSweepVoltage:
      case SpicePayloadType.DcSweepCurrent:
        return element.sweep_unit;
      case SpicePayloadType.TransientVoltage:
      case SpicePayloadType.TransientCurrent:
      case SpicePayloadType.AcSweepVoltage:
      case SpicePayloadType.AcSweepCurrent:
      case SpicePayloadType.OperatingPointVoltage:
      case SpicePayloadType.OperatingPointCurrent:
        return undefined;
    }
  }

  private static sameCoordinates(
    left: readonly number[],
    right: readonly number[]
  ): boolean {
    return left.length === right.length && left.every((value, index) =>
      SpiceResultMapper.nearlyEqual(value, right[index] ?? Number.NaN)
    );
  }

  private static validateSeriesLengths(elements: readonly SpicePayloadElement[]): void {
    for (const element of elements) {
      switch (element.type) {
        case SpicePayloadType.TransientVoltage:
          SpiceResultMapper.requireSameLength(element.timestamps_ms, element.voltage_levels, element.name);
          break;
        case SpicePayloadType.TransientCurrent:
          SpiceResultMapper.requireSameLength(element.timestamps_ms, element.current_levels, element.name);
          break;
        case SpicePayloadType.DcSweepVoltage:
          SpiceResultMapper.requireSameLength(element.sweep_values, element.voltage_levels, element.name);
          break;
        case SpicePayloadType.DcSweepCurrent:
          SpiceResultMapper.requireSameLength(element.sweep_values, element.current_levels, element.name);
          break;
        case SpicePayloadType.AcSweepVoltage:
          SpiceResultMapper.requireSameLength(element.frequencies_hz, element.complex_voltages, element.name);
          break;
        case SpicePayloadType.AcSweepCurrent:
          SpiceResultMapper.requireSameLength(element.frequencies_hz, element.complex_currents, element.name);
          break;
        case SpicePayloadType.OperatingPointVoltage:
        case SpicePayloadType.OperatingPointCurrent:
          break;
      }
    }
  }

  private static requireSameLength<Coordinate, Value>(
    coordinates: readonly Coordinate[],
    values: readonly Value[],
    name: string
  ): void {
    if (coordinates.length !== values.length || coordinates.length === 0) {
      throw new Error(`Invalid SPICE engine payload: ${name} has mismatched or empty series data.`);
    }
  }

  private static nodeValues(
    elements: readonly SpicePayloadElement[]
  ): Map<string, SpiceComplexValue> {
    const values = new Map<string, SpiceComplexValue>();
    for (const element of elements) {
      const scalar = SpiceResultMapper.voltageScalar(element);
      if (!scalar) continue;
      values.set(SpiceResultMapper.normalizeNodeName(scalar.name), scalar.value);
    }
    return values;
  }

  private static currentValues(elements: readonly SpicePayloadElement[]): Map<string, number> {
    const values = new Map<string, number>();
    for (const element of elements) {
      const scalar = SpiceResultMapper.currentScalar(element);
      if (!scalar) continue;
      values.set(
        SpiceResultMapper.normalizeElementName(scalar.name),
        SpiceResultMapper.normalizeCurrent(Math.hypot(scalar.value.re, scalar.value.im), false)
      );
    }
    return values;
  }

  private static voltageScalar(
    element: SpicePayloadElement
  ): SpiceComplexScalarValue | undefined {
    switch (element.type) {
      case SpicePayloadType.OperatingPointVoltage:
        return { name: element.name, value: { re: element.voltage, im: 0 } };
      case SpicePayloadType.TransientVoltage:
      case SpicePayloadType.DcSweepVoltage:
        return SpiceResultMapper.lastRealScalar(element.name, element.voltage_levels);
      case SpicePayloadType.AcSweepVoltage:
        return SpiceResultMapper.lastComplexScalar(element.name, element.complex_voltages);
      case SpicePayloadType.TransientCurrent:
      case SpicePayloadType.OperatingPointCurrent:
      case SpicePayloadType.DcSweepCurrent:
      case SpicePayloadType.AcSweepCurrent:
        return undefined;
    }
  }

  private static currentScalar(
    element: SpicePayloadElement
  ): SpiceComplexScalarValue | undefined {
    switch (element.type) {
      case SpicePayloadType.OperatingPointCurrent:
        return { name: element.name, value: { re: element.current, im: 0 } };
      case SpicePayloadType.TransientCurrent:
      case SpicePayloadType.DcSweepCurrent:
        return SpiceResultMapper.lastRealScalar(element.name, element.current_levels);
      case SpicePayloadType.AcSweepCurrent:
        return SpiceResultMapper.lastComplexScalar(element.name, element.complex_currents);
      case SpicePayloadType.TransientVoltage:
      case SpicePayloadType.OperatingPointVoltage:
      case SpicePayloadType.DcSweepVoltage:
      case SpicePayloadType.AcSweepVoltage:
        return undefined;
    }
  }

  private static lastRealScalar(
    name: string,
    values: readonly number[]
  ): SpiceComplexScalarValue | undefined {
    const value = values.at(-1);
    return value === undefined ? undefined : { name, value: { re: value, im: 0 } };
  }

  private static lastComplexScalar(
    name: string,
    values: readonly { readonly re: number; readonly im: number }[]
  ): SpiceComplexScalarValue | undefined {
    const value = values.at(-1);
    return value ? { name, value } : undefined;
  }

  private static componentVoltageDrop(values: readonly SpiceComplexValue[]): number {
    if (values.length < 2) {
      throw new Error("Invalid SPICE engine payload: component voltage drop needs every terminal vector.");
    }
    let maximumDrop = 0;
    for (let firstIndex = 0; firstIndex < values.length - 1; firstIndex += 1) {
      const first = values[firstIndex];
      if (!first) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < values.length; secondIndex += 1) {
        const second = values[secondIndex];
        if (!second) continue;
        maximumDrop = Math.max(
          maximumDrop,
          Math.hypot(first.re - second.re, first.im - second.im)
        );
      }
    }
    return SpiceResultMapper.normalizeVoltage(maximumDrop);
  }

  private static waveform(
    element: SpicePayloadElement,
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): readonly SimulationWaveform[] {
    switch (element.type) {
      case SpicePayloadType.TransientVoltage:
        return SpiceResultMapper.realWaveform(
          element.name,
          element.timestamps_ms,
          element.voltage_levels,
          SimulationWaveformQuantity.Voltage,
          SimulationWaveformAxis.Time,
          input,
          terminalMappings,
          1 / 1_000
        );
      case SpicePayloadType.TransientCurrent:
        return SpiceResultMapper.realWaveform(
          element.name,
          element.timestamps_ms,
          element.current_levels,
          SimulationWaveformQuantity.Current,
          SimulationWaveformAxis.Time,
          input,
          terminalMappings,
          1 / 1_000
        );
      case SpicePayloadType.DcSweepVoltage:
        return SpiceResultMapper.realWaveform(
          element.name,
          element.sweep_values,
          element.voltage_levels,
          SimulationWaveformQuantity.Voltage,
          SpiceResultMapper.dcAxis(element.sweep_unit),
          input,
          terminalMappings
        );
      case SpicePayloadType.DcSweepCurrent:
        return SpiceResultMapper.realWaveform(
          element.name,
          element.sweep_values,
          element.current_levels,
          SimulationWaveformQuantity.Current,
          SpiceResultMapper.dcAxis(element.sweep_unit),
          input,
          terminalMappings
        );
      case SpicePayloadType.AcSweepVoltage:
        return SpiceResultMapper.complexWaveform(
          element.name,
          element.frequencies_hz,
          element.complex_voltages,
          SimulationWaveformQuantity.Voltage,
          input,
          terminalMappings
        );
      case SpicePayloadType.AcSweepCurrent:
        return SpiceResultMapper.complexWaveform(
          element.name,
          element.frequencies_hz,
          element.complex_currents,
          SimulationWaveformQuantity.Current,
          input,
          terminalMappings
        );
      case SpicePayloadType.OperatingPointVoltage:
      case SpicePayloadType.OperatingPointCurrent:
        return [];
    }
  }

  private static realWaveform(
    name: string,
    coordinates: readonly number[],
    values: readonly number[],
    quantity: SimulationWaveformQuantity,
    axis: SimulationWaveformAxis,
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[],
    coordinateScale = 1
  ): readonly SimulationWaveform[] {
    const targets = SpiceResultMapper.waveformTargets(name, quantity, input, terminalMappings);
    if (targets.length === 0) return [];
    const series = axis === SimulationWaveformAxis.Time
      ? SpiceResultMapper.resampleTransient(
          coordinates,
          values,
          input.request.analysis,
          coordinateScale
        )
      : SpiceResultMapper.boundedRealSeries(coordinates, values, coordinateScale);
    const points = series.coordinates.map((x, index) => {
      const value = SpiceResultMapper.requiredNumber(series.values, index, name);
      return {
        x,
        y: quantity === SimulationWaveformQuantity.Voltage
          ? SpiceResultMapper.normalizeVoltage(value)
          : SpiceResultMapper.normalizeCurrent(value, false)
      };
    });
    return targets.map((target) => SpiceResultMapper.boundedWaveform(
      target,
      quantity,
      axis,
      points
    ));
  }

  private static resampleTransient(
    coordinates: readonly number[],
    values: readonly number[],
    analysis: SimulationAnalysis | undefined,
    coordinateScale: number
  ): { readonly coordinates: readonly number[]; readonly values: readonly number[] } {
    if (analysis?.type !== SimulationAnalysisType.Transient) {
      return SpiceResultMapper.boundedRealSeries(coordinates, values, coordinateScale);
    }
    const sampledCoordinates = SpiceResultMapper.transientCoordinates(analysis);
    return {
      coordinates: sampledCoordinates,
      values: sampledCoordinates.map((coordinate) =>
        SpiceResultMapper.interpolate(coordinate, coordinates, values, coordinateScale)
      )
    };
  }

  private static transientCoordinates(
    analysis: Extract<SimulationAnalysis, { readonly type: SimulationAnalysisType.Transient }>
  ): readonly number[] {
    const start = analysis.startSeconds ?? 0;
    const duration = analysis.stopSeconds - start;
    const ratio = duration / analysis.stepSeconds;
    const ratioTolerance = Math.max(1, Math.abs(ratio)) * Number.EPSILON * 8;
    const stepCount = Math.max(0, Math.floor(ratio + ratioTolerance));
    const pointCount = stepCount + 1;
    const indexes = SpiceResultMapper.boundedIndexes(pointCount);
    return indexes.map((index) => {
      const coordinate = start + index * analysis.stepSeconds;
      return index === stepCount && SpiceResultMapper.nearlyEqual(coordinate, analysis.stopSeconds)
        ? analysis.stopSeconds
        : coordinate;
    });
  }

  private static boundedRealSeries(
    coordinates: readonly number[],
    values: readonly number[],
    coordinateScale: number
  ): { readonly coordinates: readonly number[]; readonly values: readonly number[] } {
    const indexes = SpiceResultMapper.boundedIndexes(coordinates.length);
    return {
      coordinates: indexes.map((index) =>
        SpiceResultMapper.requiredNumber(coordinates, index, "analysis coordinate") * coordinateScale
      ),
      values: indexes.map((index) =>
        SpiceResultMapper.requiredNumber(values, index, "analysis value")
      )
    };
  }

  private static boundedIndexes(length: number): readonly number[] {
    const boundedLength = Math.min(length, SpiceResultMapper.MaximumWaveformPoints);
    if (boundedLength <= 0) return [];
    if (length <= SpiceResultMapper.MaximumWaveformPoints) {
      return Array.from({ length: boundedLength }, (_, index) => index);
    }
    return Array.from({ length: SpiceResultMapper.MaximumWaveformPoints }, (_, index) =>
      Math.round(
        index * (length - 1) / (SpiceResultMapper.MaximumWaveformPoints - 1)
      )
    );
  }

  private static interpolate(
    coordinate: number,
    coordinates: readonly number[],
    values: readonly number[],
    coordinateScale: number
  ): number {
    const firstCoordinate = SpiceResultMapper.requiredNumber(
      coordinates,
      0,
      "transient coordinate"
    ) * coordinateScale;
    const firstValue = SpiceResultMapper.requiredNumber(values, 0, "transient value");
    const lastIndex = coordinates.length - 1;
    const lastCoordinate = SpiceResultMapper.requiredNumber(
      coordinates,
      lastIndex,
      "transient coordinate"
    ) * coordinateScale;
    const lastValue = SpiceResultMapper.requiredNumber(values, lastIndex, "transient value");
    if (coordinate <= firstCoordinate) return firstValue;
    if (coordinate >= lastCoordinate) return lastValue;

    let lowerIndex = 0;
    let upperIndex = coordinates.length - 1;
    while (upperIndex - lowerIndex > 1) {
      const middleIndex = Math.floor((lowerIndex + upperIndex) / 2);
      if (
        SpiceResultMapper.requiredNumber(coordinates, middleIndex, "transient coordinate")
          * coordinateScale < coordinate
      ) {
        lowerIndex = middleIndex;
      }
      else upperIndex = middleIndex;
    }
    const lowerCoordinate = SpiceResultMapper.requiredNumber(
      coordinates,
      lowerIndex,
      "transient coordinate"
    ) * coordinateScale;
    const upperCoordinate = SpiceResultMapper.requiredNumber(
      coordinates,
      upperIndex,
      "transient coordinate"
    ) * coordinateScale;
    const lowerValue = SpiceResultMapper.requiredNumber(values, lowerIndex, "transient value");
    const upperValue = SpiceResultMapper.requiredNumber(values, upperIndex, "transient value");
    if (upperCoordinate === lowerCoordinate) return lowerValue;
    return lowerValue + (upperValue - lowerValue)
      * (coordinate - lowerCoordinate) / (upperCoordinate - lowerCoordinate);
  }

  private static complexWaveform(
    name: string,
    frequencies: readonly number[],
    values: readonly { readonly re: number; readonly im: number }[],
    quantity: SimulationWaveformQuantity,
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): readonly SimulationWaveform[] {
    const targets = SpiceResultMapper.waveformTargets(name, quantity, input, terminalMappings);
    if (targets.length === 0) return [];
    const indexes = SpiceResultMapper.boundedIndexes(frequencies.length);
    const points = indexes.map((sourceIndex) => {
      const value = values[sourceIndex];
      if (!value) {
        throw new Error(`Invalid SPICE engine payload: missing complex sample for ${name}.`);
      }
      const magnitude = Math.hypot(value.re, value.im);
      return {
        x: SpiceResultMapper.requiredNumber(frequencies, sourceIndex, name),
        y: quantity === SimulationWaveformQuantity.Voltage
          ? SpiceResultMapper.normalizeVoltage(magnitude)
          : SpiceResultMapper.normalizeCurrent(magnitude, false),
        phaseDegrees: SpiceResultMapper.normalizePhase(
          Math.atan2(value.im, value.re) * 180 / Math.PI
        )
      };
    });
    return targets.map((target) => SpiceResultMapper.boundedWaveform(
      target,
      quantity,
      SimulationWaveformAxis.Frequency,
      points
    ));
  }

  private static boundedWaveform(
    target: SpiceWaveformTarget,
    quantity: SimulationWaveformQuantity,
    axis: SimulationWaveformAxis,
    points: readonly SimulationWaveformPoint[]
  ): SimulationWaveform {
    return {
      id: `${quantity}:${target.idSuffix}`,
      label: target.label,
      quantity,
      axis,
      ...(target.componentId ? { componentId: target.componentId } : {}),
      ...(target.terminalId ? { terminalId: target.terminalId } : {}),
      points
    };
  }

  private static waveformTargets(
    name: string,
    quantity: SimulationWaveformQuantity,
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): readonly SpiceWaveformTarget[] {
    return quantity === SimulationWaveformQuantity.Voltage
      ? SpiceResultMapper.voltageTargets(name, input, terminalMappings)
      : SpiceResultMapper.currentTargets(name, input);
  }

  private static voltageTargets(
    name: string,
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): readonly SpiceWaveformTarget[] {
    const nodeName = SpiceResultMapper.normalizeNodeName(name);
    const mappedTerminals = terminalMappings.filter((mapping) => mapping.nodeName === nodeName);
    const probes = input.request.probes;
    const selectedMappings = probes && probes.length > 0
      ? probes.flatMap((probe) => {
          if (probe.kind !== SimulationProbeKind.NodeVoltage) return [];
          const mapping = mappedTerminals.find((candidate) =>
            candidate.componentId === probe.componentId && candidate.terminalId === probe.terminalId
          );
          return mapping ? [mapping] : [];
        })
      : mappedTerminals.slice(0, 1);
    return selectedMappings.map((mapping) => SpiceResultMapper.voltageTarget(mapping, input));
  }

  private static voltageTarget(
    mapping: SpiceTerminalNodeMapping,
    input: SpiceResultMappingInput
  ): SpiceWaveformTarget {
    const component = input.design.components[mapping.componentId];
    return {
      componentId: mapping.componentId,
      terminalId: mapping.terminalId,
      label: `${component?.label ?? mapping.componentId}.${mapping.terminalId}`,
      idSuffix: `${mapping.componentId}:${mapping.terminalId}`
    };
  }

  private static currentTargets(
    name: string,
    input: SpiceResultMappingInput
  ): readonly SpiceWaveformTarget[] {
    const elementName = SpiceResultMapper.normalizeElementName(name);
    const componentId = Object.entries(input.componentElementNames)
      .find(([, names]) => names.some((candidate) =>
        SpiceResultMapper.normalizeElementName(candidate) === elementName
      ))?.[0];
    if (!componentId) return [];
    const probes = input.request.probes;
    if (probes && probes.length > 0 && !probes.some((probe) =>
      probe.kind === SimulationProbeKind.ComponentCurrent && probe.componentId === componentId
    )) {
      return [];
    }
    return [{
      componentId,
      label: input.design.components[componentId]?.label ?? componentId,
      idSuffix: componentId
    }];
  }

  private static groundWaveforms(
    elements: readonly SpicePayloadElement[],
    input: SpiceResultMappingInput,
    terminalMappings: readonly SpiceTerminalNodeMapping[]
  ): readonly SimulationWaveform[] {
    const analysis = input.request.analysis;
    if (!analysis || analysis.type === SimulationAnalysisType.OperatingPoint) return [];
    const groundMappings = (input.request.probes ?? []).flatMap((probe) => {
      if (probe.kind !== SimulationProbeKind.NodeVoltage) return [];
      const mapping = terminalMappings.find((candidate) =>
        candidate.componentId === probe.componentId
        && candidate.terminalId === probe.terminalId
        && candidate.nodeName === "0"
      );
      return mapping ? [mapping] : [];
    });
    if (groundMappings.length === 0) return [];

    const referenceElement = elements.find((element) =>
      SpiceResultMapper.seriesCoordinates(element) !== undefined
    );
    if (!referenceElement) {
      throw new Error("Invalid SPICE engine payload: ground waveform has no analysis grid.");
    }
    const rawCoordinates = SpiceResultMapper.seriesCoordinates(referenceElement) ?? [];
    const coordinates = analysis.type === SimulationAnalysisType.Transient
      ? SpiceResultMapper.transientCoordinates(analysis)
      : SpiceResultMapper.boundedIndexes(rawCoordinates.length)
          .map((index) => SpiceResultMapper.requiredNumber(
            rawCoordinates,
            index,
            "ground waveform coordinate"
          ));
    const axis = analysis.type === SimulationAnalysisType.DcSweep
      ? SpiceResultMapper.dcAxis(SpiceResultMapper.seriesUnit(referenceElement) ?? SpiceDcSweepUnit.Volts)
      : analysis.type === SimulationAnalysisType.AcSweep
        ? SimulationWaveformAxis.Frequency
        : SimulationWaveformAxis.Time;
    const points = coordinates.map((x) => ({
      x,
      y: 0,
      ...(analysis.type === SimulationAnalysisType.AcSweep ? { phaseDegrees: 0 } : {})
    }));
    return groundMappings.map((mapping) => SpiceResultMapper.boundedWaveform(
      SpiceResultMapper.voltageTarget(mapping, input),
      SimulationWaveformQuantity.Voltage,
      axis,
      points
    ));
  }

  private static componentState(
    component: CircuitDesign["components"][string],
    currentAmps: number
  ): ComponentSimulation["state"] | undefined {
    switch (component.properties.kind) {
      case ComponentKind.Led:
        return currentAmps >= SpiceResultMapper.LedOnCurrentThreshold ? "on" : "off";
      case ComponentKind.Switch:
        return component.properties.closed ? "closed" : "open";
      case ComponentKind.PushButton:
        return component.properties.pressed ? "closed" : "open";
      case ComponentKind.Fuse:
        return "closed";
      default:
        return undefined;
    }
  }

  private static dcAxis(unit: SpiceDcSweepUnit): SimulationWaveformAxis {
    return unit === SpiceDcSweepUnit.Amps
      ? SimulationWaveformAxis.DcCurrent
      : SimulationWaveformAxis.DcVoltage;
  }

  private static isAcAnalysis(analysis: SimulationAnalysis | undefined): boolean {
    return analysis?.type === SimulationAnalysisType.AcSweep;
  }

  private static nearlyEqual(left: number, right: number): boolean {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    const tolerance = Math.max(1, Math.abs(left), Math.abs(right)) * Number.EPSILON * 16;
    return Math.abs(left - right) <= tolerance;
  }

  private static requiredNumber(
    values: readonly number[],
    index: number,
    vectorName: string
  ): number {
    const value = values[index];
    if (value === undefined) {
      throw new Error(`Invalid SPICE engine payload: missing numeric sample for ${vectorName}.`);
    }
    return value;
  }

  private static normalizeNodeName(name: string): string {
    const normalized = name.trim().toLowerCase();
    const match = normalized.match(/^v\((.*)\)$/);
    return match?.[1]?.trim() ?? normalized;
  }

  private static normalizeElementName(name: string): string {
    const normalized = name.trim().toLowerCase();
    const currentMatch = normalized.match(/^i\((.*)\)$/);
    const vectorName = currentMatch?.[1] ?? normalized;
    const deviceParameterMatch = vectorName.match(/^@([^[]+)\[/);
    return (deviceParameterMatch?.[1] ?? vectorName.replace(/#branch$/, "")).trim();
  }

  private static normalizeVoltage(value: number): number {
    return Math.abs(value) < SpiceResultMapper.VoltageTolerance ? 0 : value;
  }

  private static normalizeCurrent(value: number, absolute: boolean): number {
    const normalized = Math.abs(value) < SpiceResultMapper.CurrentTolerance ? 0 : value;
    return absolute ? Math.abs(normalized) : normalized;
  }

  private static normalizePhase(value: number): number {
    return Math.abs(value) < 1e-9 ? 0 : value;
  }

  private static summary(analysis: SimulationAnalysis | undefined): string {
    switch (analysis?.type) {
      case SimulationAnalysisType.DcSweep:
        return "SPICE DC sweep completed.";
      case SimulationAnalysisType.AcSweep:
        return "SPICE AC sweep completed.";
      case SimulationAnalysisType.Transient:
        return "SPICE transient simulation completed.";
      case SimulationAnalysisType.OperatingPoint:
      default:
        return "SPICE operating-point simulation completed.";
    }
  }
}
