import { TscircuitUnitFormatter } from "@/tscircuit/tscircuit-unit-formatter";
import {
  BatteryStandard,
  LedDisplayColor,
  MosfetMode,
  SpdtPosition,
  type ComponentProperties
} from "@/domain/types";

export enum PropertyFieldControl {
  Number = "number",
  Select = "select",
  Boolean = "boolean",
  Readonly = "readonly"
}

export enum PropertyFieldKey {
  Voltage = "voltage",
  Enabled = "enabled",
  ResistanceOhms = "resistanceOhms",
  Tolerance = "tolerance",
  ForwardVoltage = "forwardVoltage",
  MaxCurrentMilliamps = "maxCurrentMilliamps",
  DisplayColor = "displayColor",
  Closed = "closed",
  CapacityMilliampHours = "capacityMilliampHours",
  Standard = "standard",
  CurrentAmps = "currentAmps",
  CapacitanceFarads = "capacitanceFarads",
  Polarized = "polarized",
  VoltageRating = "voltageRating",
  InductanceHenries = "inductanceHenries",
  MaxCurrentAmps = "maxCurrentAmps",
  ZenerVoltage = "zenerVoltage",
  CurrentRatingAmps = "currentRatingAmps",
  WiperPosition = "wiperPosition",
  Pressed = "pressed",
  Position = "position",
  Beta = "beta",
  Gain = "gain",
  Mode = "mode",
  SwitchType = "switchType",
  TransistorType = "transistorType",
  MosfetChannel = "mosfetChannel",
  Footprint = "footprint"
}

export enum PropertyUnit {
  Volts = "V",
  Amperes = "A",
  Ohms = "Ω",
  Farads = "F",
  Henries = "H",
  Milliamperes = "mA",
  MilliampereHours = "mAh",
  Percent = "%"
}

export enum PropertyDisplayValue {
  Spst = "SPST",
  Spdt = "SPDT",
  PushButton = "Momentary push button",
  Npn = "NPN",
  Pnp = "PNP",
  NChannel = "N channel",
  PChannel = "P channel"
}

export type PropertySelectOption = {
  readonly value: string;
  readonly label: string;
};

export type PropertyFieldDefinition = {
  readonly key: PropertyFieldKey;
  readonly label: string;
  readonly control: PropertyFieldControl;
  readonly unit?: PropertyUnit;
  readonly acceptsSiUnit?: boolean;
  readonly displaysPercentage?: boolean;
  readonly options?: readonly PropertySelectOption[];
  readonly staticValue?: PropertyDisplayValue;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: number;
  readonly exclusiveMaximum?: number;
};

export class PropertyFieldDefinitions {
  static readonly sourceVoltage: PropertyFieldDefinition = { key: PropertyFieldKey.Voltage, label: "Voltage", control: PropertyFieldControl.Number, unit: PropertyUnit.Volts, acceptsSiUnit: true, minimum: 0.1, maximum: 24 };
  static readonly enabled: PropertyFieldDefinition = { key: PropertyFieldKey.Enabled, label: "Enabled", control: PropertyFieldControl.Boolean };
  static readonly resistance: PropertyFieldDefinition = { key: PropertyFieldKey.ResistanceOhms, label: "Resistance", control: PropertyFieldControl.Number, unit: PropertyUnit.Ohms, acceptsSiUnit: true, minimum: 1, maximum: 10_000_000 };
  static readonly potentiometerResistance: PropertyFieldDefinition = { key: PropertyFieldKey.ResistanceOhms, label: "Resistance", control: PropertyFieldControl.Number, unit: PropertyUnit.Ohms, acceptsSiUnit: true };
  static readonly tolerance: PropertyFieldDefinition = { key: PropertyFieldKey.Tolerance, label: "Tolerance", control: PropertyFieldControl.Number, unit: PropertyUnit.Percent, acceptsSiUnit: true, displaysPercentage: true, minimum: 0, maximum: 1 };
  static readonly forwardVoltage: PropertyFieldDefinition = { key: PropertyFieldKey.ForwardVoltage, label: "Forward voltage", control: PropertyFieldControl.Number, unit: PropertyUnit.Volts, exclusiveMinimum: 0, maximum: 5 };
  static readonly maxCurrentMilliamps: PropertyFieldDefinition = { key: PropertyFieldKey.MaxCurrentMilliamps, label: "Maximum current", control: PropertyFieldControl.Number, unit: PropertyUnit.Milliamperes, exclusiveMinimum: 0, maximum: 50 };
  static readonly displayColor: PropertyFieldDefinition = { key: PropertyFieldKey.DisplayColor, label: "Display color", control: PropertyFieldControl.Select, options: [
    { value: LedDisplayColor.Red, label: "Red" }, { value: LedDisplayColor.Amber, label: "Amber" }, { value: LedDisplayColor.Green, label: "Green" }, { value: LedDisplayColor.Blue, label: "Blue" }
  ] };
  static readonly closed: PropertyFieldDefinition = { key: PropertyFieldKey.Closed, label: "Closed", control: PropertyFieldControl.Boolean };
  static readonly spst: PropertyFieldDefinition = { key: PropertyFieldKey.SwitchType, label: "Switch type", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.Spst };
  static readonly batteryVoltage: PropertyFieldDefinition = { key: PropertyFieldKey.Voltage, label: "Voltage", control: PropertyFieldControl.Number, unit: PropertyUnit.Volts, acceptsSiUnit: true };
  static readonly batteryCapacity: PropertyFieldDefinition = { key: PropertyFieldKey.CapacityMilliampHours, label: "Capacity", control: PropertyFieldControl.Number, unit: PropertyUnit.MilliampereHours, acceptsSiUnit: true };
  static readonly batteryStandard: PropertyFieldDefinition = { key: PropertyFieldKey.Standard, label: "Battery standard", control: PropertyFieldControl.Select, options: [
    { value: BatteryStandard.Aa, label: "AA" }, { value: BatteryStandard.Aaa, label: "AAA" }, { value: BatteryStandard.NineVolt, label: "9 V" }, { value: BatteryStandard.Cr2032, label: "CR2032" }, { value: BatteryStandard.Cell18650, label: "18650" }, { value: BatteryStandard.C, label: "C" }
  ] };
  static readonly current: PropertyFieldDefinition = { key: PropertyFieldKey.CurrentAmps, label: "Current", control: PropertyFieldControl.Number, unit: PropertyUnit.Amperes, acceptsSiUnit: true };
  static readonly capacitance: PropertyFieldDefinition = { key: PropertyFieldKey.CapacitanceFarads, label: "Capacitance", control: PropertyFieldControl.Number, unit: PropertyUnit.Farads, acceptsSiUnit: true };
  static readonly polarized: PropertyFieldDefinition = { key: PropertyFieldKey.Polarized, label: "Polarized", control: PropertyFieldControl.Boolean };
  static readonly voltageRating: PropertyFieldDefinition = { key: PropertyFieldKey.VoltageRating, label: "Voltage rating", control: PropertyFieldControl.Number, unit: PropertyUnit.Volts, acceptsSiUnit: true };
  static readonly inductance: PropertyFieldDefinition = { key: PropertyFieldKey.InductanceHenries, label: "Inductance", control: PropertyFieldControl.Number, unit: PropertyUnit.Henries, acceptsSiUnit: true };
  static readonly maxCurrentAmps: PropertyFieldDefinition = { key: PropertyFieldKey.MaxCurrentAmps, label: "Maximum current", control: PropertyFieldControl.Number, unit: PropertyUnit.Amperes, exclusiveMinimum: 0 };
  static readonly zenerVoltage: PropertyFieldDefinition = { key: PropertyFieldKey.ZenerVoltage, label: "Zener voltage", control: PropertyFieldControl.Number, unit: PropertyUnit.Volts, exclusiveMinimum: 0, maximum: 200 };
  static readonly currentRating: PropertyFieldDefinition = { key: PropertyFieldKey.CurrentRatingAmps, label: "Current rating", control: PropertyFieldControl.Number, unit: PropertyUnit.Amperes, acceptsSiUnit: true };
  static readonly wiperPosition: PropertyFieldDefinition = { key: PropertyFieldKey.WiperPosition, label: "Wiper position", control: PropertyFieldControl.Number, minimum: 0, maximum: 1 };
  static readonly pressed: PropertyFieldDefinition = { key: PropertyFieldKey.Pressed, label: "Pressed", control: PropertyFieldControl.Boolean };
  static readonly pushButton: PropertyFieldDefinition = { key: PropertyFieldKey.SwitchType, label: "Switch type", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.PushButton };
  static readonly spdt: PropertyFieldDefinition = { key: PropertyFieldKey.SwitchType, label: "Switch type", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.Spdt };
  static readonly position: PropertyFieldDefinition = { key: PropertyFieldKey.Position, label: "Position", control: PropertyFieldControl.Select, options: [
    { value: SpdtPosition.A, label: "Path A" }, { value: SpdtPosition.B, label: "Path B" }
  ] };
  static readonly beta: PropertyFieldDefinition = { key: PropertyFieldKey.Beta, label: "Current gain (β)", control: PropertyFieldControl.Number, exclusiveMinimum: 0 };
  static readonly gain: PropertyFieldDefinition = { key: PropertyFieldKey.Gain, label: "Open-loop gain", control: PropertyFieldControl.Number, exclusiveMinimum: 0 };
  static readonly npn: PropertyFieldDefinition = { key: PropertyFieldKey.TransistorType, label: "Transistor type", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.Npn };
  static readonly pnp: PropertyFieldDefinition = { key: PropertyFieldKey.TransistorType, label: "Transistor type", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.Pnp };
  static readonly mosfetMode: PropertyFieldDefinition = { key: PropertyFieldKey.Mode, label: "MOSFET mode", control: PropertyFieldControl.Select, options: [
    { value: MosfetMode.Enhancement, label: "Enhancement" }, { value: MosfetMode.Depletion, label: "Depletion" }
  ] };
  static readonly nChannel: PropertyFieldDefinition = { key: PropertyFieldKey.MosfetChannel, label: "MOSFET channel", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.NChannel };
  static readonly pChannel: PropertyFieldDefinition = { key: PropertyFieldKey.MosfetChannel, label: "MOSFET channel", control: PropertyFieldControl.Readonly, staticValue: PropertyDisplayValue.PChannel };
  static readonly footprint: PropertyFieldDefinition = { key: PropertyFieldKey.Footprint, label: "Footprint", control: PropertyFieldControl.Readonly };

  static numberValue(properties: ComponentProperties, key: PropertyFieldKey): number {
    const value = this.value(properties, key);
    if (typeof value !== "number") throw new Error(`${key} is not a numeric component property.`);
    return value;
  }

  static value(properties: ComponentProperties, key: PropertyFieldKey): string | number | boolean {
    switch (key) {
      case PropertyFieldKey.Voltage: if ("voltage" in properties) return properties.voltage; break;
      case PropertyFieldKey.Enabled: if ("enabled" in properties) return properties.enabled; break;
      case PropertyFieldKey.ResistanceOhms: if ("resistanceOhms" in properties) return properties.resistanceOhms; break;
      case PropertyFieldKey.Tolerance: if ("tolerance" in properties) return properties.tolerance; break;
      case PropertyFieldKey.ForwardVoltage: if ("forwardVoltage" in properties) return properties.forwardVoltage; break;
      case PropertyFieldKey.MaxCurrentMilliamps: if ("maxCurrentMilliamps" in properties) return properties.maxCurrentMilliamps; break;
      case PropertyFieldKey.DisplayColor: if ("displayColor" in properties) return properties.displayColor; break;
      case PropertyFieldKey.Closed: if ("closed" in properties) return properties.closed; break;
      case PropertyFieldKey.CapacityMilliampHours: if ("capacityMilliampHours" in properties) return properties.capacityMilliampHours; break;
      case PropertyFieldKey.Standard: if ("standard" in properties) return properties.standard; break;
      case PropertyFieldKey.CurrentAmps: if ("currentAmps" in properties) return properties.currentAmps; break;
      case PropertyFieldKey.CapacitanceFarads: if ("capacitanceFarads" in properties) return properties.capacitanceFarads; break;
      case PropertyFieldKey.Polarized: if ("polarized" in properties) return properties.polarized; break;
      case PropertyFieldKey.VoltageRating: if ("voltageRating" in properties) return properties.voltageRating; break;
      case PropertyFieldKey.InductanceHenries: if ("inductanceHenries" in properties) return properties.inductanceHenries; break;
      case PropertyFieldKey.MaxCurrentAmps: if ("maxCurrentAmps" in properties) return properties.maxCurrentAmps; break;
      case PropertyFieldKey.ZenerVoltage: if ("zenerVoltage" in properties) return properties.zenerVoltage; break;
      case PropertyFieldKey.CurrentRatingAmps: if ("currentRatingAmps" in properties) return properties.currentRatingAmps; break;
      case PropertyFieldKey.WiperPosition: if ("wiperPosition" in properties) return properties.wiperPosition; break;
      case PropertyFieldKey.Pressed: if ("pressed" in properties) return properties.pressed; break;
      case PropertyFieldKey.Position: if ("position" in properties) return properties.position; break;
      case PropertyFieldKey.Beta: if ("beta" in properties) return properties.beta; break;
      case PropertyFieldKey.Gain: if ("gain" in properties) return properties.gain; break;
      case PropertyFieldKey.Mode: if ("mode" in properties) return properties.mode; break;
      default: throw new Error(`${key} is registry metadata, not a component property.`);
    }
    throw new Error(`${key} is not available for ${properties.kind}.`);
  }

  static inputValue(value: number, definition: PropertyFieldDefinition): string | number {
    return definition.displaysPercentage ? `${value * 100}%` : value;
  }

  static normalizedSummary(value: number, unit?: PropertyUnit, displaysPercentage = false): string {
    if (displaysPercentage) return `${TscircuitUnitFormatter.format(value * 100)} ${PropertyUnit.Percent}`;
    const formatted = TscircuitUnitFormatter.format(value);
    const prefixed = formatted.match(/^(.*?)([pnumkMGT])$/);
    if (!unit) return prefixed ? `${prefixed[1]} ${prefixed[2]}` : formatted;
    return prefixed ? `${prefixed[1]} ${prefixed[2]}${unit}` : `${formatted} ${unit}`;
  }
}
