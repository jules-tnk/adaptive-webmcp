import createNgspiceModule from "@o.z/ngspice-wasm";
import {
  eecircuitResultToSimulationGraphs,
  simulationGraphsToCircuitJson
} from "@tscircuit/ngspice-spice-engine";
import type { SimulationAnalysisResult } from "circuit-json";
import {
  SpiceDcSweepUnit,
  SpicePayloadType,
  type SpiceEnginePayload,
  type SpiceEnginePayloadElement,
  type SpiceRuntimeEngine
} from "./spice-engine-payload";

enum LocalNgspicePath {
  Circuit = "/probepilot.cir",
  RawResult = "/probepilot.raw"
}

enum LocalNgspiceEncoding {
  Utf8 = "utf8"
}

enum LocalNgspiceRawMarker {
  Variables = "Variables:",
  Values = "Values:"
}

enum LocalNgspiceRawHeader {
  Command = "Command",
  Flags = "Flags",
  PlotName = "Plotname",
  VariableCount = "No. Variables",
  PointCount = "No. Points"
}

enum LocalNgspiceRawDataType {
  Real = "real",
  Complex = "complex"
}

enum LocalNgspiceVectorType {
  Voltage = "voltage",
  Current = "current",
  Time = "time",
  Frequency = "frequency",
  None = "notype"
}

enum LocalNgspiceElementPrefix {
  VoltageSource = "V",
  CurrentSource = "I",
  Resistor = "R",
  Capacitor = "C",
  Inductor = "L",
  Diode = "D"
}

interface LocalNgspiceFileReadOptions {
  readonly encoding: LocalNgspiceEncoding;
}

interface LocalNgspiceFileSystem {
  readFile(path: string, options: LocalNgspiceFileReadOptions): string;
  unlink(path: string): void;
  writeFile(path: string, contents: string): void;
}

interface LocalNgspiceModule {
  readonly ExitStatus: new (status: number) => LocalNgspiceExitStatus;
  readonly FS: LocalNgspiceFileSystem;
  readonly HEAPU32: Uint32Array;
  _main(argumentCount: number, argumentVectorPointer: number): number;
  lengthBytesUTF8(value: string): number;
  stackAlloc(size: number): number;
  stackRestore(pointer: number): void;
  stackSave(): number;
  stringToUTF8(value: string, outputPointer: number, maximumBytes: number): void;
}

interface LocalNgspiceExitStatus {
  readonly status: number;
}

interface LocalNgspiceRawVariable {
  readonly name: string;
  readonly type: LocalNgspiceVectorType;
}

interface LocalNgspiceComplexNumber {
  readonly real: number;
  readonly img: number;
}

interface LocalNgspiceRealData {
  readonly name: string;
  readonly type: LocalNgspiceVectorType;
  readonly values: number[];
}

interface LocalNgspiceComplexData {
  readonly name: string;
  readonly type: LocalNgspiceVectorType;
  readonly values: LocalNgspiceComplexNumber[];
}

interface LocalNgspiceRealResult {
  readonly header: string;
  readonly numVariables: number;
  readonly variableNames: string[];
  readonly numPoints: number;
  readonly dataType: LocalNgspiceRawDataType.Real;
  readonly data: LocalNgspiceRealData[];
}

interface LocalNgspiceComplexResult {
  readonly header: string;
  readonly numVariables: number;
  readonly variableNames: string[];
  readonly numPoints: number;
  readonly dataType: LocalNgspiceRawDataType.Complex;
  readonly data: LocalNgspiceComplexData[];
}

type LocalNgspiceRawResult = LocalNgspiceRealResult | LocalNgspiceComplexResult;

export enum LocalNgspiceDiagnosticCode {
  ExecutionFailed = "LOCAL_NGSPICE_EXECUTION_FAILED",
  InvalidDeck = "LOCAL_NGSPICE_INVALID_DECK",
  InvalidOutput = "LOCAL_NGSPICE_INVALID_OUTPUT"
}

export class LocalNgspiceError extends Error {
  constructor(
    readonly code: LocalNgspiceDiagnosticCode,
    message: string,
    readonly exitCode?: number
  ) {
    super(message);
    this.name = "LocalNgspiceError";
  }
}

export interface LocalNgspiceSimulationResult extends SpiceEnginePayload {
  readonly engineVersionString: string;
}

export interface LocalNgspiceEngine extends SpiceRuntimeEngine {}

export class LocalNgspiceEngineAdapter {
  static async create(): Promise<LocalNgspiceEngine> {
    const diagnosticLines: string[] = [];
    const appendDiagnostic = (line: string): void => {
      diagnosticLines.push(line);
    };
    const ngspice: LocalNgspiceModule = await createNgspiceModule({
      noInitialRun: true,
      print: appendDiagnostic,
      printErr: appendDiagnostic
    });
    ngspice.FS.writeFile(
      "/proc/meminfo",
      "MemTotal:       33554432 kB\nMemFree:        16777216 kB\n"
    );

    return {
      simulate: async (spiceString: string): Promise<LocalNgspiceSimulationResult> => {
        diagnosticLines.length = 0;
        LocalNgspiceEngineAdapter.removePreviousRawResult(ngspice);
        const executableDeck = LocalNgspiceEngineAdapter.prepareDeck(spiceString);
        ngspice.FS.writeFile(LocalNgspicePath.Circuit, executableDeck);
        const exitCode = LocalNgspiceEngineAdapter.runFile(ngspice, LocalNgspicePath.Circuit);

        if (exitCode !== 0) {
          throw new LocalNgspiceError(
            LocalNgspiceDiagnosticCode.ExecutionFailed,
            `Local ngspice exited with status ${exitCode}: ${LocalNgspiceEngineAdapter.diagnosticMessage(diagnosticLines)}`,
            exitCode
          );
        }

        const rawOutput = LocalNgspiceEngineAdapter.readRawResult(ngspice);
        const parsedResult = LocalNgspiceEngineAdapter.parseRawResult(rawOutput);
        const graphs = eecircuitResultToSimulationGraphs(parsedResult, spiceString);
        const simulationResultCircuitJson = simulationGraphsToCircuitJson(graphs, spiceString);
        if (simulationResultCircuitJson.length === 0) {
          throw new LocalNgspiceError(
            LocalNgspiceDiagnosticCode.InvalidOutput,
            "Local ngspice completed without a mappable simulation result."
          );
        }

        return {
          engineVersionString: LocalNgspiceEngineAdapter.engineVersion(rawOutput),
          simulationResultCircuitJson: LocalNgspiceEngineAdapter.normalizeSimulationResults(
            simulationResultCircuitJson
          )
        };
      }
    };
  }

  private static prepareDeck(spiceString: string): string {
    const endCard = /^\s*\.end\s*$/im;
    if (!endCard.test(spiceString)) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidDeck,
        "Local ngspice requires a deck ending with .end."
      );
    }

    const currentProbes = LocalNgspiceEngineAdapter.currentProbeExpressions(spiceString);
    const controlBlock = [
      ...(currentProbes.length > 0 ? [`.probe ${currentProbes.join(" ")}`] : []),
      ".control",
      "set no_mem_check",
      "set filetype=ascii",
      "save all",
      "run",
      `write ${LocalNgspicePath.RawResult} all`,
      ".endc",
      ".end"
    ].join("\n");

    return spiceString.replace(endCard, `${controlBlock}\n`);
  }

  private static currentProbeExpressions(spiceString: string): readonly string[] {
    const probes = spiceString
      .split(/\r?\n/)
      .slice(1)
      .flatMap((line) => {
        const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_.-]*)\s+/);
        const elementName = match?.[1];
        if (!elementName) return [];
        const prefix = elementName.charAt(0).toUpperCase();
        switch (prefix) {
          case LocalNgspiceElementPrefix.Resistor:
          case LocalNgspiceElementPrefix.Capacitor:
          case LocalNgspiceElementPrefix.Inductor:
          case LocalNgspiceElementPrefix.VoltageSource:
          case LocalNgspiceElementPrefix.CurrentSource:
          case LocalNgspiceElementPrefix.Diode:
            return [`I(${elementName})`];
          default:
            return [];
        }
      });

    return probes.filter((probe, index) => probes.indexOf(probe) === index);
  }

  private static removePreviousRawResult(ngspice: LocalNgspiceModule): void {
    try {
      ngspice.FS.unlink(LocalNgspicePath.RawResult);
    } catch {
      // A missing prior result is the normal first-run state.
    }
  }

  private static readRawResult(ngspice: LocalNgspiceModule): string {
    try {
      return ngspice.FS.readFile(LocalNgspicePath.RawResult, {
        encoding: LocalNgspiceEncoding.Utf8
      });
    } catch {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        "Local ngspice did not produce its expected ASCII raw result."
      );
    }
  }

  private static parseRawResult(rawOutput: string): LocalNgspiceRawResult {
    const lines = rawOutput.split(/\r?\n/);
    const variablesIndex = lines.indexOf(LocalNgspiceRawMarker.Variables);
    const valuesIndex = lines.indexOf(LocalNgspiceRawMarker.Values);
    const numVariables = LocalNgspiceEngineAdapter.integerHeader(
      lines,
      LocalNgspiceRawHeader.VariableCount
    );
    const numPoints = LocalNgspiceEngineAdapter.integerHeader(
      lines,
      LocalNgspiceRawHeader.PointCount
    );
    if (variablesIndex < 0 || valuesIndex <= variablesIndex || numVariables <= 0 || numPoints <= 0) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        "Local ngspice returned an incomplete ASCII raw header."
      );
    }

    const variables = LocalNgspiceEngineAdapter.parseVariables(
      lines.slice(variablesIndex + 1, valuesIndex),
      numVariables
    );
    const flags = LocalNgspiceEngineAdapter.headerValue(lines, LocalNgspiceRawHeader.Flags)
      .trim()
      .toLowerCase();
    const dataType = flags.includes(LocalNgspiceRawDataType.Complex)
      ? LocalNgspiceRawDataType.Complex
      : flags.includes(LocalNgspiceRawDataType.Real)
        ? LocalNgspiceRawDataType.Real
        : undefined;
    if (!dataType) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        `Local ngspice returned unsupported raw flags: ${flags || "missing"}.`
      );
    }

    const valueRows = LocalNgspiceEngineAdapter.parseValueRows(
      lines.slice(valuesIndex + 1),
      numVariables,
      numPoints
    );
    const base = {
      header: LocalNgspiceEngineAdapter.headerValue(lines, LocalNgspiceRawHeader.PlotName),
      numVariables,
      variableNames: variables.map((variable) => variable.name),
      numPoints
    };

    if (dataType === LocalNgspiceRawDataType.Real) {
      return {
        ...base,
        dataType: LocalNgspiceRawDataType.Real,
        data: variables.map((variable, variableIndex) => ({
          name: variable.name,
          type: variable.type,
          values: valueRows.map((row) => LocalNgspiceEngineAdapter.realValue(row[variableIndex]))
        }))
      };
    }

    return {
      ...base,
      dataType: LocalNgspiceRawDataType.Complex,
      data: variables.map((variable, variableIndex) => ({
        name: variable.name,
        type: variable.type,
        values: valueRows.map((row) => LocalNgspiceEngineAdapter.complexValue(row[variableIndex]))
      }))
    };
  }

  private static normalizeSimulationResults(
    results: readonly SimulationAnalysisResult[]
  ): readonly SpiceEnginePayloadElement[] {
    return results.map((result): SpiceEnginePayloadElement => {
      switch (result.type) {
        case SpicePayloadType.TransientVoltage:
          return {
            type: SpicePayloadType.TransientVoltage,
            name: result.name ?? "",
            timestamps_ms: result.timestamps_ms ?? [],
            voltage_levels: result.voltage_levels,
            time_per_step: result.time_per_step,
            start_time_ms: result.start_time_ms,
            end_time_ms: result.end_time_ms
          };
        case SpicePayloadType.TransientCurrent:
          return {
            type: SpicePayloadType.TransientCurrent,
            name: result.name ?? "",
            timestamps_ms: result.timestamps_ms ?? [],
            current_levels: result.current_levels,
            time_per_step: result.time_per_step,
            start_time_ms: result.start_time_ms,
            end_time_ms: result.end_time_ms
          };
        case SpicePayloadType.OperatingPointVoltage:
          return {
            type: SpicePayloadType.OperatingPointVoltage,
            name: result.name ?? "",
            voltage: result.voltage
          };
        case SpicePayloadType.OperatingPointCurrent:
          return {
            type: SpicePayloadType.OperatingPointCurrent,
            name: result.name ?? "",
            current: result.current
          };
        case SpicePayloadType.DcSweepVoltage:
          return {
            type: SpicePayloadType.DcSweepVoltage,
            name: result.name ?? "",
            sweep_values: result.sweep_values,
            sweep_unit: result.sweep_unit === SpiceDcSweepUnit.Amps
              ? SpiceDcSweepUnit.Amps
              : SpiceDcSweepUnit.Volts,
            voltage_levels: result.voltage_levels
          };
        case SpicePayloadType.DcSweepCurrent:
          return {
            type: SpicePayloadType.DcSweepCurrent,
            name: result.name ?? "",
            sweep_values: result.sweep_values,
            sweep_unit: result.sweep_unit === SpiceDcSweepUnit.Amps
              ? SpiceDcSweepUnit.Amps
              : SpiceDcSweepUnit.Volts,
            current_levels: result.current_levels
          };
        case SpicePayloadType.AcSweepVoltage:
          return {
            type: SpicePayloadType.AcSweepVoltage,
            name: result.name ?? "",
            frequencies_hz: result.frequencies_hz,
            complex_voltages: result.complex_voltages
          };
        case SpicePayloadType.AcSweepCurrent:
          return {
            type: SpicePayloadType.AcSweepCurrent,
            name: result.name ?? "",
            frequencies_hz: result.frequencies_hz,
            complex_currents: result.complex_currents
          };
        default:
          throw new LocalNgspiceError(
            LocalNgspiceDiagnosticCode.InvalidOutput,
            "The package returned an unsupported simulation result element."
          );
      }
    });
  }

  private static parseVariables(
    lines: readonly string[],
    expectedCount: number
  ): readonly LocalNgspiceRawVariable[] {
    const variables = lines.filter((line) => line.trim().length > 0).map((line) => {
      const match = line.trim().match(/^\d+\s+(\S+)\s+(\S+)/);
      if (!match?.[1] || !match[2]) {
        throw new LocalNgspiceError(
          LocalNgspiceDiagnosticCode.InvalidOutput,
          `Local ngspice returned an invalid raw variable row: ${line.trim()}.`
        );
      }
      return {
        name: match[1],
        type: LocalNgspiceEngineAdapter.vectorType(match[2])
      };
    });
    if (variables.length !== expectedCount) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        `Local ngspice declared ${expectedCount} variables but returned ${variables.length}.`
      );
    }
    return variables;
  }

  private static parseValueRows(
    lines: readonly string[],
    variableCount: number,
    pointCount: number
  ): readonly (readonly string[])[] {
    const rows: string[][] = [];
    let cursor = 0;
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
      cursor = LocalNgspiceEngineAdapter.nextNonBlankLine(lines, cursor);
      const firstLine = lines[cursor]?.trim();
      const firstMatch = firstLine?.match(/^(\d+)\s+(.+)$/);
      if (!firstMatch?.[1] || firstMatch[2] === undefined || Number(firstMatch[1]) !== pointIndex) {
        throw new LocalNgspiceError(
          LocalNgspiceDiagnosticCode.InvalidOutput,
          `Local ngspice raw values are missing point ${pointIndex}.`
        );
      }
      cursor += 1;
      const row = [firstMatch[2]];
      for (let variableIndex = 1; variableIndex < variableCount; variableIndex += 1) {
        cursor = LocalNgspiceEngineAdapter.nextNonBlankLine(lines, cursor);
        const value = lines[cursor]?.trim();
        if (!value) {
          throw new LocalNgspiceError(
            LocalNgspiceDiagnosticCode.InvalidOutput,
            `Local ngspice raw point ${pointIndex} is missing variable ${variableIndex}.`
          );
        }
        row.push(value);
        cursor += 1;
      }
      rows.push(row);
    }
    return rows;
  }

  private static nextNonBlankLine(lines: readonly string[], start: number): number {
    let cursor = start;
    while (cursor < lines.length && !lines[cursor]?.trim()) cursor += 1;
    return cursor;
  }

  private static realValue(value: string | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        `Local ngspice returned a non-finite real value: ${value ?? "missing"}.`
      );
    }
    return parsed;
  }

  private static complexValue(value: string | undefined): LocalNgspiceComplexNumber {
    const [realToken, imaginaryToken, extraToken] = value?.split(",") ?? [];
    if (extraToken !== undefined) {
      throw new LocalNgspiceError(
        LocalNgspiceDiagnosticCode.InvalidOutput,
        `Local ngspice returned an invalid complex value: ${value}.`
      );
    }
    return {
      real: LocalNgspiceEngineAdapter.realValue(realToken),
      img: LocalNgspiceEngineAdapter.realValue(imaginaryToken)
    };
  }

  private static vectorType(value: string): LocalNgspiceVectorType {
    switch (value.toLowerCase()) {
      case LocalNgspiceVectorType.Voltage:
        return LocalNgspiceVectorType.Voltage;
      case LocalNgspiceVectorType.Current:
        return LocalNgspiceVectorType.Current;
      case LocalNgspiceVectorType.Time:
        return LocalNgspiceVectorType.Time;
      case LocalNgspiceVectorType.Frequency:
        return LocalNgspiceVectorType.Frequency;
      default:
        return LocalNgspiceVectorType.None;
    }
  }

  private static integerHeader(lines: readonly string[], header: LocalNgspiceRawHeader): number {
    const value = Number(LocalNgspiceEngineAdapter.headerValue(lines, header));
    return Number.isInteger(value) ? value : -1;
  }

  private static headerValue(lines: readonly string[], header: LocalNgspiceRawHeader): string {
    const prefix = `${header}:`;
    const line = lines.find((candidate) => candidate.startsWith(prefix));
    return line?.slice(prefix.length).trim() ?? "";
  }

  private static engineVersion(rawOutput: string): string {
    const command = LocalNgspiceEngineAdapter.headerValue(
      rawOutput.split(/\r?\n/),
      LocalNgspiceRawHeader.Command
    );
    return command.split(",")[0]?.trim() || "ngspice-wasm";
  }

  private static diagnosticMessage(lines: readonly string[]): string {
    const message = lines.map((line) => line.trim()).filter(Boolean).join(" ");
    return message.length > 2_000 ? `${message.slice(0, 2_000)}…` : message;
  }

  private static runFile(ngspice: LocalNgspiceModule, circuitPath: string): number {
    const argumentsList = ["probepilot-ngspice", "-b", circuitPath];
    const stackPointer = ngspice.stackSave();
    const argumentVectorPointer = ngspice.stackAlloc(
      (argumentsList.length + 1) * Uint32Array.BYTES_PER_ELEMENT
    );

    try {
      argumentsList.forEach((argumentValue: string, index: number) => {
        const argumentPointer = ngspice.stackAlloc(ngspice.lengthBytesUTF8(argumentValue) + 1);
        ngspice.stringToUTF8(argumentValue, argumentPointer, ngspice.lengthBytesUTF8(argumentValue) + 1);
        ngspice.HEAPU32[argumentVectorPointer / Uint32Array.BYTES_PER_ELEMENT + index] = argumentPointer;
      });
      ngspice.HEAPU32[
        argumentVectorPointer / Uint32Array.BYTES_PER_ELEMENT + argumentsList.length
      ] = 0;

      try {
        return ngspice._main(argumentsList.length, argumentVectorPointer);
      } catch (error) {
        if (error instanceof ngspice.ExitStatus) return error.status;
        throw error;
      }
    } finally {
      ngspice.stackRestore(stackPointer);
    }
  }
}
