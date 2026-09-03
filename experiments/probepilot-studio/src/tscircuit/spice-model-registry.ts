import { Model, type SpiceValueInput } from "spicets";
import {
  ComponentKind,
  type ComponentKindValue
} from "@/domain/types";

export enum SpiceModelName {
  Diode = "PP_DIODE",
  Zener = "PP_ZENER",
  Schottky = "PP_SCHOTTKY",
  Led = "PP_LED"
}

export enum SpiceIdealResistance {
  Closed = "1m",
  Open = "1t"
}

enum SpiceModelType {
  Diode = "D"
}

enum SpiceModelParameterName {
  SaturationCurrent = "IS",
  EmissionCoefficient = "N",
  SeriesResistance = "RS",
  JunctionCapacitance = "CJO",
  EnergyGap = "EG",
  BreakdownVoltage = "BV",
  BreakdownCurrent = "IBV"
}

interface SpiceModelParameter {
  readonly name: SpiceModelParameterName;
  readonly value: SpiceValueInput;
}

interface SpiceModelDefinition {
  readonly name: SpiceModelName;
  readonly type: SpiceModelType;
  readonly parameters: readonly SpiceModelParameter[];
}

const modelDefinitions: ReadonlyMap<ComponentKindValue, SpiceModelDefinition> = new Map([
  [ComponentKind.Diode, {
    name: SpiceModelName.Diode,
    type: SpiceModelType.Diode,
    parameters: [
      { name: SpiceModelParameterName.SaturationCurrent, value: "2.52n" },
      { name: SpiceModelParameterName.EmissionCoefficient, value: 1.752 }
    ]
  }],
  [ComponentKind.ZenerDiode, {
    name: SpiceModelName.Zener,
    type: SpiceModelType.Diode,
    parameters: [
      { name: SpiceModelParameterName.SaturationCurrent, value: "2.52n" },
      { name: SpiceModelParameterName.EmissionCoefficient, value: 1.752 },
      { name: SpiceModelParameterName.BreakdownVoltage, value: 5.1 },
      { name: SpiceModelParameterName.BreakdownCurrent, value: "1m" }
    ]
  }],
  [ComponentKind.SchottkyDiode, {
    name: SpiceModelName.Schottky,
    type: SpiceModelType.Diode,
    parameters: [
      { name: SpiceModelParameterName.SaturationCurrent, value: "200n" },
      { name: SpiceModelParameterName.EmissionCoefficient, value: 1.05 },
      { name: SpiceModelParameterName.SeriesResistance, value: 0.1 },
      { name: SpiceModelParameterName.BreakdownVoltage, value: 40 },
      { name: SpiceModelParameterName.BreakdownCurrent, value: "10u" }
    ]
  }],
  [ComponentKind.Led, {
    name: SpiceModelName.Led,
    type: SpiceModelType.Diode,
    parameters: [
      { name: SpiceModelParameterName.SaturationCurrent, value: "1e-20" },
      { name: SpiceModelParameterName.EmissionCoefficient, value: 2 },
      { name: SpiceModelParameterName.SeriesResistance, value: 10 },
      { name: SpiceModelParameterName.JunctionCapacitance, value: "2p" },
      { name: SpiceModelParameterName.EnergyGap, value: 2.1 },
      { name: SpiceModelParameterName.BreakdownVoltage, value: 5 },
      { name: SpiceModelParameterName.BreakdownCurrent, value: "10u" }
    ]
  }]
]);

export class SpiceModelRegistry {
  static modelNameFor(kind: ComponentKindValue): SpiceModelName | undefined {
    return modelDefinitions.get(kind)?.name;
  }

  static cardFor(kind: ComponentKindValue): Model | undefined {
    const definition = modelDefinitions.get(kind);
    if (!definition) return undefined;

    return new Model({
      name: definition.name,
      type: definition.type,
      params: definition.parameters.map(
        (parameter): [string, SpiceValueInput] => [parameter.name, parameter.value]
      )
    });
  }

  static zenerModelName(zenerVoltage: number): string {
    const voltageToken = SpiceModelRegistry.formatNumber(zenerVoltage)
      .replace("-", "N")
      .replace(".", "P");
    return `${SpiceModelName.Zener}_${voltageToken}`;
  }

  static zenerCardFor(zenerVoltage: number): Model {
    const definition = modelDefinitions.get(ComponentKind.ZenerDiode);
    if (!definition) throw new Error("The verified Zener SPICE model is not registered.");
    return new Model({
      name: SpiceModelRegistry.zenerModelName(zenerVoltage),
      type: definition.type,
      params: definition.parameters.map(
        (parameter): [string, SpiceValueInput] => [
          parameter.name,
          parameter.name === SpiceModelParameterName.BreakdownVoltage
            ? SpiceModelRegistry.formatNumber(zenerVoltage)
            : parameter.value
        ]
      )
    });
  }

  private static formatNumber(value: number): string {
    return Number(value.toPrecision(12)).toString();
  }
}
