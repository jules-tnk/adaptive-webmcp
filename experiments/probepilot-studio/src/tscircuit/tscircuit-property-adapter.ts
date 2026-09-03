import { batteryProps } from "@tscircuit/props/lib/components/battery";
import { capacitorProps } from "@tscircuit/props/lib/components/capacitor";
import { currentSourceProps } from "@tscircuit/props/lib/components/currentsource";
import { diodeProps } from "@tscircuit/props/lib/components/diode";
import { fuseProps } from "@tscircuit/props/lib/components/fuse";
import { inductorProps } from "@tscircuit/props/lib/components/inductor";
import { ledProps } from "@tscircuit/props/lib/components/led";
import { mosfetProps } from "@tscircuit/props/lib/components/mosfet";
import { opampProps } from "@tscircuit/props/lib/components/opamp";
import { potentiometerProps } from "@tscircuit/props/lib/components/potentiometer";
import { resistorProps } from "@tscircuit/props/lib/components/resistor";
import { switchProps } from "@tscircuit/props/lib/components/switch";
import { transistorProps } from "@tscircuit/props/lib/components/transistor";
import { voltageSourceProps } from "@tscircuit/props/lib/components/voltagesource";
import { parseAndConvertSiUnit, type BaseTscircuitUnit } from "format-si-unit";
import { z } from "zod";
import {
  BatteryStandard,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition
} from "@/domain/types";

const finite = z.number().finite();
const positive = finite.positive();
const numericInput = z.union([finite, z.string()]);
const sourceVoltageInput = z.union([finite.min(0.1).max(24), z.string()]);
const resistanceInput = z.union([finite.min(1).max(10_000_000), z.string()]);
const toleranceInput = z.union([finite.min(0).max(1), z.string()]);

function parsedNumber(value: number | string | undefined, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${field} must parse to a finite number.`);
  return value;
}

function boundedParsedNumber(value: number | string | undefined, field: string, minimum: number, maximum: number): number {
  const parsed = parsedNumber(value, field);
  if (parsed < minimum || parsed > maximum) throw new Error(`${field} must be a number between ${minimum} and ${maximum}.`);
  return parsed;
}

function parsedSiNumber(value: number | string | undefined, field: string, unit: BaseTscircuitUnit): number {
  const parsed = parseAndConvertSiUnit(value, unit).value;
  if (parsed === null || !Number.isFinite(parsed)) throw new Error(`${field} must parse to a finite number.`);
  return parsed;
}

function batteryCapacityInput(value: number | string): number | string {
  return typeof value === "string" && !value.toLowerCase().endsWith("mah") ? `${value}mAh` : value;
}

const sourceSchema = z.object({ kind: z.literal("dc_source"), voltage: sourceVoltageInput, enabled: z.boolean() }).transform((value) => ({
  kind: "dc_source" as const,
  voltage: boundedParsedNumber(voltageSourceProps.parse({ name: "V1", voltage: value.voltage }).voltage, "voltage", 0.1, 24),
  enabled: value.enabled
}));
const groundSchema = z.object({ kind: z.literal("ground") });
const resistorSchema = z.object({ kind: z.literal("resistor"), resistanceOhms: resistanceInput, tolerance: toleranceInput.default(0.05) }).transform((value) => ({
  kind: "resistor" as const,
  resistanceOhms: boundedParsedNumber(resistorProps.parse({ name: "R1", resistance: value.resistanceOhms }).resistance, "resistanceOhms", 1, 10_000_000),
  tolerance: boundedParsedNumber(resistorProps.parse({ name: "R1", resistance: value.resistanceOhms, tolerance: value.tolerance }).tolerance, "tolerance", 0, 1)
}));
const ledSchema = z.object({ kind: z.literal("led"), forwardVoltage: positive.max(5), maxCurrentMilliamps: positive.max(50), displayColor: z.nativeEnum(LedDisplayColor) }).transform((value) => {
  ledProps.parse({ name: "LED1", color: value.displayColor });
  return value;
});
const switchSchema = z.object({ kind: z.literal("switch"), closed: z.boolean() }).transform((value) => {
  switchProps.parse({ name: "SW1", type: "spst", simStartClosed: value.closed });
  return value;
});
const batterySchema = z.object({ kind: z.literal("battery"), voltage: numericInput, capacityMilliampHours: numericInput, standard: z.nativeEnum(BatteryStandard) }).transform((value) => ({
  kind: "battery" as const,
  voltage: parsedNumber(batteryProps.parse({ name: "B1", voltage: value.voltage }).voltage, "voltage"),
  capacityMilliampHours: parsedNumber(batteryProps.parse({ name: "B1", capacity: batteryCapacityInput(value.capacityMilliampHours) }).capacity, "capacityMilliampHours"),
  standard: value.standard
}));
const currentSourceSchema = z.object({ kind: z.literal("current_source"), currentAmps: numericInput, enabled: z.boolean() }).transform((value) => ({
  kind: "current_source" as const,
  currentAmps: parsedNumber(currentSourceProps.parse({ name: "I1", current: value.currentAmps }).current, "currentAmps"),
  enabled: value.enabled
}));
const capacitorSchema = z.object({ kind: z.literal("capacitor"), capacitanceFarads: numericInput, polarized: z.boolean(), voltageRating: numericInput }).transform((value) => ({
  kind: "capacitor" as const,
  capacitanceFarads: parsedNumber(capacitorProps.parse({ name: "C1", capacitance: value.capacitanceFarads }).capacitance, "capacitanceFarads"),
  polarized: value.polarized,
  voltageRating: parsedNumber(capacitorProps.parse({ name: "C1", capacitance: "1uF", maxVoltageRating: value.voltageRating }).maxVoltageRating, "voltageRating")
}));
const inductorSchema = z.object({ kind: z.literal("inductor"), inductanceHenries: numericInput, maxCurrentAmps: positive }).transform((value) => ({
  kind: "inductor" as const,
  inductanceHenries: parsedNumber(inductorProps.parse({ name: "L1", inductance: value.inductanceHenries }).inductance, "inductanceHenries"),
  maxCurrentAmps: value.maxCurrentAmps
}));
const diodeSchema = z.object({ kind: z.literal("diode"), forwardVoltage: positive.max(5) }).transform((value) => { diodeProps.parse({ name: "D1", variant: "standard" }); return value; });
const zenerSchema = z.object({ kind: z.literal("zener_diode"), zenerVoltage: positive.max(200) }).transform((value) => { diodeProps.parse({ name: "D1", variant: "zener" }); return value; });
const schottkySchema = z.object({ kind: z.literal("schottky_diode"), forwardVoltage: positive.max(5) }).transform((value) => { diodeProps.parse({ name: "D1", variant: "schottky" }); return value; });
const fuseSchema = z.object({ kind: z.literal("fuse"), currentRatingAmps: numericInput, voltageRating: numericInput }).transform((value) => {
  const parsed = fuseProps.parse({ name: "F1", currentRating: value.currentRatingAmps, voltageRating: value.voltageRating });
  return { kind: "fuse" as const, currentRatingAmps: parsedSiNumber(parsed.currentRating, "currentRatingAmps", "A"), voltageRating: parsedSiNumber(parsed.voltageRating, "voltageRating", "V") };
});
const potentiometerSchema = z.object({ kind: z.literal("potentiometer"), resistanceOhms: numericInput, wiperPosition: finite.min(0).max(1) }).transform((value) => ({
  kind: "potentiometer" as const,
  resistanceOhms: parsedNumber(potentiometerProps.parse({ name: "RV1", maxResistance: value.resistanceOhms, pinVariant: "three_pin" }).maxResistance, "resistanceOhms"),
  wiperPosition: value.wiperPosition
}));
const pushButtonSchema = z.object({ kind: z.literal("push_button"), pressed: z.boolean() }).transform((value) => { switchProps.parse({ name: "SW1", type: "spst", simStartClosed: value.pressed }); return value; });
const spdtSchema = z.object({ kind: z.literal("spdt_switch"), position: z.nativeEnum(SpdtPosition) }).transform((value) => { switchProps.parse({ name: "SW1", type: "spdt" }); return value; });
const npnSchema = z.object({ kind: z.literal("npn_bjt"), beta: positive }).transform((value) => { transistorProps.parse({ name: "Q1", type: "npn" }); return value; });
const pnpSchema = z.object({ kind: z.literal("pnp_bjt"), beta: positive }).transform((value) => { transistorProps.parse({ name: "Q1", type: "pnp" }); return value; });
const nMosfetSchema = z.object({ kind: z.literal("n_channel_mosfet"), channel: z.literal(MosfetChannel.N), mode: z.nativeEnum(MosfetMode) }).transform((value) => { mosfetProps.parse({ name: "Q1", channelType: MosfetChannel.N, mosfetMode: value.mode }); return value; });
const pMosfetSchema = z.object({ kind: z.literal("p_channel_mosfet"), channel: z.literal(MosfetChannel.P), mode: z.nativeEnum(MosfetMode) }).transform((value) => { mosfetProps.parse({ name: "Q1", channelType: MosfetChannel.P, mosfetMode: value.mode }); return value; });
const opAmpSchema = z.object({ kind: z.literal("op_amp"), gain: positive }).transform((value) => { opampProps.parse({ name: "U1" }); return value; });

export class TscircuitPropertyAdapter {
  static readonly sourceSchema = sourceSchema;
  static readonly groundSchema = groundSchema;
  static readonly resistorSchema = resistorSchema;
  static readonly ledSchema = ledSchema;
  static readonly switchSchema = switchSchema;
  static readonly batterySchema = batterySchema;
  static readonly currentSourceSchema = currentSourceSchema;
  static readonly capacitorSchema = capacitorSchema;
  static readonly inductorSchema = inductorSchema;
  static readonly diodeSchema = diodeSchema;
  static readonly zenerSchema = zenerSchema;
  static readonly schottkySchema = schottkySchema;
  static readonly fuseSchema = fuseSchema;
  static readonly potentiometerSchema = potentiometerSchema;
  static readonly pushButtonSchema = pushButtonSchema;
  static readonly spdtSchema = spdtSchema;
  static readonly npnSchema = npnSchema;
  static readonly pnpSchema = pnpSchema;
  static readonly nMosfetSchema = nMosfetSchema;
  static readonly pMosfetSchema = pMosfetSchema;
  static readonly opAmpSchema = opAmpSchema;
}
