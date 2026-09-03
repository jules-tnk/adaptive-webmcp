import { z } from "zod";
import { terminalExists } from "@/domain/catalog";
import {
  BatteryStandard,
  ComponentKind,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  type ComponentProperties
} from "@/domain/types";
import type { ProjectRecord } from "@/projects/project-types";
import { PhysicalBoardSide, PhysicalPlacementMode } from "@/physical/physical-design";
import { PhysicalLayout } from "@/physical/physical-layout";

const actorSchema = z.enum(["human", "agent", "system"]);
const activityActionSchema = z.enum([
  "component_added", "component_updated", "component_removed", "wire_added", "wire_removed",
  "simulation_run", "bench_started", "measurement_requested", "measurement_completed",
  "hypotheses_updated", "repair_staged", "repair_approved", "repair_rejected", "repair_verified",
  "action_rejected", "project_reset"
]);
const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict();
const componentKindSchema = z.nativeEnum(ComponentKind);
const finiteNumberSchema = z.number().finite();
const positiveNumberSchema = finiteNumberSchema.positive();
const normalizedPropertiesSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal(ComponentKind.DcSource), voltage: finiteNumberSchema.min(0.1).max(24), enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal(ComponentKind.Ground) }).strict(),
  z.object({ kind: z.literal(ComponentKind.Resistor), resistanceOhms: finiteNumberSchema.min(1).max(10_000_000), tolerance: finiteNumberSchema.min(0).max(1) }).strict(),
  z.object({ kind: z.literal(ComponentKind.Led), forwardVoltage: positiveNumberSchema.max(5), maxCurrentMilliamps: positiveNumberSchema.max(50), displayColor: z.nativeEnum(LedDisplayColor) }).strict(),
  z.object({ kind: z.literal(ComponentKind.Switch), closed: z.boolean() }).strict(),
  z.object({ kind: z.literal(ComponentKind.Battery), voltage: finiteNumberSchema, capacityMilliampHours: finiteNumberSchema, standard: z.nativeEnum(BatteryStandard) }).strict(),
  z.object({ kind: z.literal(ComponentKind.CurrentSource), currentAmps: finiteNumberSchema, enabled: z.boolean() }).strict(),
  z.object({ kind: z.literal(ComponentKind.Capacitor), capacitanceFarads: finiteNumberSchema, polarized: z.boolean(), voltageRating: finiteNumberSchema }).strict(),
  z.object({ kind: z.literal(ComponentKind.Inductor), inductanceHenries: finiteNumberSchema, maxCurrentAmps: positiveNumberSchema }).strict(),
  z.object({ kind: z.literal(ComponentKind.Diode), forwardVoltage: positiveNumberSchema.max(5) }).strict(),
  z.object({ kind: z.literal(ComponentKind.ZenerDiode), zenerVoltage: positiveNumberSchema.max(200) }).strict(),
  z.object({ kind: z.literal(ComponentKind.SchottkyDiode), forwardVoltage: positiveNumberSchema.max(5) }).strict(),
  z.object({ kind: z.literal(ComponentKind.Fuse), currentRatingAmps: finiteNumberSchema, voltageRating: finiteNumberSchema }).strict(),
  z.object({ kind: z.literal(ComponentKind.Potentiometer), resistanceOhms: finiteNumberSchema, wiperPosition: finiteNumberSchema.min(0).max(1) }).strict(),
  z.object({ kind: z.literal(ComponentKind.PushButton), pressed: z.boolean() }).strict(),
  z.object({ kind: z.literal(ComponentKind.SpdtSwitch), position: z.nativeEnum(SpdtPosition) }).strict(),
  z.object({ kind: z.literal(ComponentKind.NpnBjt), beta: positiveNumberSchema }).strict(),
  z.object({ kind: z.literal(ComponentKind.PnpBjt), beta: positiveNumberSchema }).strict(),
  z.object({ kind: z.literal(ComponentKind.NChannelMosfet), channel: z.literal(MosfetChannel.N), mode: z.nativeEnum(MosfetMode) }).strict(),
  z.object({ kind: z.literal(ComponentKind.PChannelMosfet), channel: z.literal(MosfetChannel.P), mode: z.nativeEnum(MosfetMode) }).strict(),
  z.object({ kind: z.literal(ComponentKind.OpAmp), gain: positiveNumberSchema }).strict()
]);
const persistedPropertyValueSchema = z.union([z.string(), finiteNumberSchema, z.boolean()]);
const propertiesSchema = z.record(persistedPropertyValueSchema).transform((properties, context): ComponentProperties => {
  const migratedProperties = properties.kind === ComponentKind.Resistor && properties.tolerance === undefined
    ? { ...properties, tolerance: 0.05 }
    : properties;
  const result = normalizedPropertiesSchema.safeParse(migratedProperties);
  if (!result.success) {
    for (const issue of result.error.issues) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: issue.path });
    }
    return z.NEVER;
  }
  return result.data;
});
const componentSchema = z.object({
  id: z.string().min(1),
  kind: componentKindSchema,
  label: z.string().min(1).max(80),
  position: pointSchema,
  properties: propertiesSchema,
  agentLocked: z.boolean(),
  createdBy: actorSchema,
  lastModifiedBy: actorSchema
}).strict().superRefine((component, context) => {
  if (component.kind !== component.properties.kind) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Component kind does not match its properties." });
  }
});
const terminalRefSchema = z.object({ componentId: z.string().min(1), terminalId: z.string().min(1) }).strict();
const wireSchema = z.object({ id: z.string().min(1), a: terminalRefSchema, b: terminalRefSchema, createdBy: actorSchema }).strict();
const designSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  revision: z.number().int().min(0),
  components: z.record(componentSchema),
  wires: z.record(wireSchema)
}).strict().superRefine((design, context) => {
  for (const [key, component] of Object.entries(design.components)) {
    if (key !== component.id) context.addIssue({ code: z.ZodIssueCode.custom, message: `Component key ${key} does not match its ID.` });
  }
  for (const [key, wire] of Object.entries(design.wires)) {
    if (key !== wire.id) context.addIssue({ code: z.ZodIssueCode.custom, message: `Wire key ${key} does not match its ID.` });
    for (const terminal of [wire.a, wire.b]) {
      const component = design.components[terminal.componentId];
      if (!component || !terminalExists(component, terminal.terminalId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Wire ${wire.id} references an invalid terminal.` });
      }
    }
  }
});
const activitySchema = z.object({
  id: z.string().min(1),
  actor: actorSchema,
  action: activityActionSchema,
  summary: z.string().min(1),
  affectedIds: z.array(z.string()),
  createdAt: z.string().datetime()
}).strict();
const recordFields = {
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  design: designSchema,
  activities: z.array(activitySchema).max(100)
};
const physicalPlacementSchema = z.object({
  xMm: finiteNumberSchema.min(-1000).max(1000),
  yMm: finiteNumberSchema.min(-1000).max(1000),
  rotationDegrees: finiteNumberSchema.min(0).max(359),
  side: z.nativeEnum(PhysicalBoardSide),
  footprint: z.string().min(1).max(80)
}).strict();
const physicalDesignSchema = z.object({
  board: z.object({
    widthMm: finiteNumberSchema.min(20).max(500),
    heightMm: finiteNumberSchema.min(20).max(500),
    thicknessMm: finiteNumberSchema.min(0.2).max(10)
  }).strict(),
  placements: z.record(physicalPlacementSchema),
  placementMode: z.nativeEnum(PhysicalPlacementMode)
}).strict();
const legacyRecordSchema = z.object({ schemaVersion: z.literal(1), ...recordFields }).strict();
const currentRecordSchema = z.object({ schemaVersion: z.literal(2), ...recordFields, physicalDesign: physicalDesignSchema }).strict();
const recordSchema = z.union([currentRecordSchema, legacyRecordSchema]).transform((record): ProjectRecord => record.schemaVersion === 1 ? {
  ...record,
  schemaVersion: 2,
  physicalDesign: PhysicalLayout.generate(record.design)
} : record).superRefine((record, context) => {
  if (record.id !== record.design.id) context.addIssue({ code: z.ZodIssueCode.custom, message: "Project and design IDs must match." });
});
const collectionSchema = z.array(recordSchema);

export class ProjectCodec {
  static parseImport(text: string): ProjectRecord {
    try {
      return recordSchema.parse(JSON.parse(text)) as ProjectRecord;
    } catch {
      throw new Error("The file is not a valid ProbePilot project.");
    }
  }

  static parseCollection(text: string): ProjectRecord[] {
    try {
      return collectionSchema.parse(JSON.parse(text)) as ProjectRecord[];
    } catch {
      return [];
    }
  }

  static serialize(record: ProjectRecord): string {
    return JSON.stringify(recordSchema.parse(record), null, 2);
  }

  static serializeCollection(records: readonly ProjectRecord[]): string {
    return JSON.stringify(collectionSchema.parse(records));
  }

  static fileName(record: ProjectRecord): string {
    const base = record.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "probepilot-project";
    return `${base}.probepilot.json`;
  }
}
