import { z } from "zod";
import type { StoreApi } from "zustand/vanilla";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { ComponentDefinition } from "@/components/component-definition";
import { PropertyFieldControl, PropertyFieldDefinitions, type PropertyFieldDefinition } from "@/components/property-field-definition";
import type { CommandError, CommandResult, ComponentKindValue, ComponentProperties } from "@/domain/types";
import { SimulationEngineId } from "@/simulation/simulation-engine";
import type { StudioState } from "@/state/store";
import { buildPublicStudioDto, InspectScope } from "./public-dto";

type JsonSchemaValue = string | number | boolean | JsonSchema | JsonSchemaValue[];
type JsonSchema = { [key: string]: JsonSchemaValue };
type RegistryPropertyPatch = Record<string, string | number | boolean>;

enum ToolSchemaName {
  Inspect = "inspect",
  Build = "build",
  Update = "update",
  Remove = "remove",
  Simulate = "simulate",
  Measurement = "measurement",
  Hypotheses = "hypotheses",
  Repair = "repair",
  Empty = "empty"
}

enum ProbePilotToolName {
  Inspect = "studio_inspect",
  BuildCircuit = "design_build_circuit",
  UpdateComponents = "design_update_components",
  RemoveElements = "design_remove_elements",
  Simulate = "design_validate_and_simulate",
  RequestMeasurement = "bench_request_measurement",
  UpdateHypotheses = "bench_update_hypotheses",
  StageRepair = "bench_stage_repair",
  VerifyBench = "bench_verify"
}

const registryDefinitions = ComponentDefinitionRegistry.list();
const firstDefinition = registryDefinitions[0];
if (!firstDefinition) throw new Error("The component registry must contain at least one definition.");
const componentKinds: [ComponentKindValue, ...ComponentKindValue[]] = [firstDefinition.kind, ...registryDefinitions.slice(1).map((definition) => definition.kind)];
const componentKind = z.enum(componentKinds);
const actor = { actor: "agent" as const };
const propertyValue = z.union([z.string(), z.number().finite(), z.boolean()]);

function parseRegistryProperties(kind: ComponentKindValue, current: ComponentProperties, patch: RegistryPropertyPatch): ComponentProperties {
  const definition = ComponentDefinitionRegistry.get(kind);
  const allowedKeys: ReadonlySet<string> = new Set(definition.propertyFields
    .filter((field) => field.control !== PropertyFieldControl.Readonly)
    .map((field) => field.key));
  const unexpectedKeys = Object.keys(patch).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) throw new Error(`Unexpected ${kind} properties: ${unexpectedKeys.join(", ")}.`);
  return definition.propertySchema.parse({ ...current, ...patch, kind });
}

const inspectInput = z.object({ scope: z.nativeEnum(InspectScope).default(InspectScope.Summary) }).strict();
const buildComponentInput = z.object({
  key: z.string().min(1).max(48),
  kind: componentKind,
  label: z.string().min(1).max(32).optional(),
  properties: z.record(propertyValue).optional(),
  placement: z.discriminatedUnion("type", [
    z.object({ type: z.literal("auto"), order: z.number().int().nonnegative() }).strict(),
    z.object({ type: z.literal("absolute"), x: z.number(), y: z.number() }).strict()
  ])
}).strict().transform((item, context) => {
  if (!item.properties) return { ...item, properties: undefined };
  try {
    const defaults = ComponentDefinitionRegistry.get(item.kind).defaultProperties;
    return { ...item, properties: parseRegistryProperties(item.kind, defaults, item.properties) };
  } catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Invalid component properties." });
    return z.NEVER;
  }
});
const buildInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  components: z.array(buildComponentInput).max(20),
  connections: z.array(z.object({
    from: z.object({ component: z.string(), terminal: z.string() }).strict(),
    to: z.object({ component: z.string(), terminal: z.string() }).strict()
  }).strict()).max(30)
}).strict();
const updateInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  updates: z.array(z.object({
    componentId: z.string(),
    label: z.string().min(1).max(32).optional(),
    position: z.object({ x: z.number(), y: z.number() }).strict().optional(),
    properties: z.record(propertyValue).optional()
  }).strict()).min(1).max(10)
}).strict();
type UpdateInput = z.infer<typeof updateInput>;
type ValidatedComponentUpdate = Omit<UpdateInput["updates"][number], "properties"> & { properties?: ComponentProperties };
type UpdatePreflightResult =
  | { readonly ok: true; readonly updates: readonly ValidatedComponentUpdate[] }
  | { readonly ok: false; readonly result: CommandResult<never> };

function updateFailure(revision: number, code: CommandError["code"], message: string, recovery?: string): UpdatePreflightResult {
  return { ok: false, result: { ok: false, revision, error: { code, message, recovery, currentRevision: code === "REVISION_CONFLICT" ? revision : undefined } } };
}

function preflightComponentUpdates(state: StudioState, input: UpdateInput): UpdatePreflightResult {
  if (input.expectedRevision !== state.design.revision) {
    return updateFailure(
      state.design.revision,
      "REVISION_CONFLICT",
      "The design changed after the agent inspected it.",
      "Inspect the studio again before applying changes."
    );
  }
  if (state.bench) return updateFailure(state.design.revision, "INVALID_MODE", "The bench is read-only.");

  const plannedProperties = new Map<string, ComponentProperties>();
  const updates: ValidatedComponentUpdate[] = [];
  for (const update of input.updates) {
    const component = state.design.components[update.componentId];
    if (!component) return updateFailure(state.design.revision, "INVALID_INPUT", `Component ${update.componentId} does not exist.`);
    if (component.agentLocked) return updateFailure(state.design.revision, "AGENT_LOCKED", `${component.label} is protected from agent changes.`);
    const current = plannedProperties.get(component.id) ?? component.properties;
    const properties = update.properties ? parseRegistryProperties(component.kind, current, update.properties) : undefined;
    if (properties) plannedProperties.set(component.id, properties);
    updates.push({ ...update, properties });
  }
  return { ok: true, updates };
}
const removeInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  componentIds: z.array(z.string()).max(20).default([]),
  wireIds: z.array(z.string()).max(30).default([]),
  reason: z.string().min(1).max(240)
}).strict();
const simulateInput = z.object({
  expectedRevision: z.number().int().nonnegative(),
  preferredEngineId: z.nativeEnum(SimulationEngineId).optional()
}).strict();
const measurementInput = z.object({
  mode: z.enum(["dc_voltage", "continuity"]),
  firstTestPointId: z.string(),
  secondTestPointId: z.string(),
  purpose: z.string().min(1).max(240)
}).strict();
const hypothesesInput = z.object({
  hypotheses: z.array(z.object({
    targetType: z.enum(["component", "wire"]),
    targetId: z.string(),
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(z.string()),
    explanation: z.string().min(1).max(280)
  }).strict()).max(8)
}).strict();
const stageRepairInput = z.object({
  target: z.discriminatedUnion("type", [
    z.object({ type: z.literal("component"), componentId: z.string() }).strict(),
    z.object({ type: z.literal("wire"), wireId: z.string() }).strict()
  ]),
  action: z.enum(["reconnect_wire", "replace_component", "correct_value", "reverse_component"]),
  evidenceIds: z.array(z.string()).min(2),
  expectedOutcome: z.string().min(1).max(280)
}).strict();
const emptyInput = z.object({}).strict();

function propertyFieldSchema(definition: ComponentDefinition, field: PropertyFieldDefinition): JsonSchema {
  const defaultValue = PropertyFieldDefinitions.value(definition.defaultProperties, field.key);
  if (field.control === PropertyFieldControl.Boolean) return { type: "boolean", default: defaultValue };
  if (field.control === PropertyFieldControl.Select) {
    return { type: "string", enum: (field.options ?? []).map((option) => option.value), default: defaultValue };
  }
  const numericSchema: JsonSchema = { type: "number" };
  if (field.minimum !== undefined) numericSchema.minimum = field.minimum;
  if (field.maximum !== undefined) numericSchema.maximum = field.maximum;
  if (field.exclusiveMinimum !== undefined) numericSchema.exclusiveMinimum = field.exclusiveMinimum;
  if (field.exclusiveMaximum !== undefined) numericSchema.exclusiveMaximum = field.exclusiveMaximum;
  if (field.acceptsSiUnit) return { oneOf: [numericSchema, { type: "string" }], default: defaultValue };
  return { ...numericSchema, default: defaultValue };
}

function propertyPatchSchema(definition: ComponentDefinition): JsonSchema {
  const editableFields = definition.propertyFields.filter((field) => field.control !== PropertyFieldControl.Readonly);
  return {
    title: `${definition.name} properties`,
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(editableFields.map((field) => [field.key, propertyFieldSchema(definition, field)]))
  };
}

const placementSchema: JsonSchema = {
  oneOf: [
    { type: "object", additionalProperties: false, required: ["type", "order"], properties: { type: { const: "auto" }, order: { type: "integer", minimum: 0 } } },
    { type: "object", additionalProperties: false, required: ["type", "x", "y"], properties: { type: { const: "absolute" }, x: { type: "number" }, y: { type: "number" } } }
  ]
};

const buildComponentSchemas = registryDefinitions.map((definition): JsonSchema => ({
  title: definition.name,
  type: "object",
  additionalProperties: false,
  required: ["key", "kind", "placement"],
  properties: {
    key: { type: "string", minLength: 1, maxLength: 48 },
    kind: { type: "string", const: definition.kind },
    label: { type: "string", minLength: 1, maxLength: 32 },
    properties: propertyPatchSchema(definition),
    placement: placementSchema
  }
}));

const schemas: Record<ToolSchemaName, JsonSchema> = {
  [ToolSchemaName.Inspect]: {
    type: "object", additionalProperties: false,
    properties: { scope: { type: "string", enum: [InspectScope.Summary, InspectScope.Design, InspectScope.Simulation, InspectScope.Bench], default: InspectScope.Summary } }
  },
  [ToolSchemaName.Build]: {
    type: "object", additionalProperties: false, required: ["expectedRevision", "components", "connections"],
    properties: {
      expectedRevision: { type: "integer", minimum: 0 },
      components: {
        type: "array", maxItems: 20,
        items: { oneOf: buildComponentSchemas }
      },
      connections: {
        type: "array", maxItems: 30,
        items: {
          type: "object", additionalProperties: false, required: ["from", "to"],
          properties: {
            from: { type: "object", additionalProperties: false, required: ["component", "terminal"], properties: { component: { type: "string" }, terminal: { type: "string" } } },
            to: { type: "object", additionalProperties: false, required: ["component", "terminal"], properties: { component: { type: "string" }, terminal: { type: "string" } } }
          }
        }
      }
    }
  },
  [ToolSchemaName.Update]: {
    type: "object", additionalProperties: false, required: ["expectedRevision", "updates"],
    properties: {
      expectedRevision: { type: "integer", minimum: 0 },
      updates: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["componentId"], properties: { componentId: { type: "string" }, label: { type: "string", minLength: 1, maxLength: 32 }, position: { type: "object", additionalProperties: false, required: ["x", "y"], properties: { x: { type: "number" }, y: { type: "number" } } }, properties: { anyOf: registryDefinitions.map(propertyPatchSchema) } } } }
    }
  },
  [ToolSchemaName.Remove]: {
    type: "object", additionalProperties: false, required: ["expectedRevision", "reason"],
    properties: { expectedRevision: { type: "integer", minimum: 0 }, componentIds: { type: "array", maxItems: 20, items: { type: "string" } }, wireIds: { type: "array", maxItems: 30, items: { type: "string" } }, reason: { type: "string", minLength: 1, maxLength: 240 } }
  },
  [ToolSchemaName.Simulate]: {
    type: "object", additionalProperties: false, required: ["expectedRevision"],
    properties: {
      expectedRevision: { type: "integer", minimum: 0 },
      preferredEngineId: { type: "string", enum: [SimulationEngineId.Deterministic, SimulationEngineId.Spice] }
    }
  },
  [ToolSchemaName.Measurement]: {
    type: "object", additionalProperties: false, required: ["mode", "firstTestPointId", "secondTestPointId", "purpose"],
    properties: { mode: { type: "string", enum: ["dc_voltage", "continuity"] }, firstTestPointId: { type: "string" }, secondTestPointId: { type: "string" }, purpose: { type: "string", minLength: 1, maxLength: 240 } }
  },
  [ToolSchemaName.Hypotheses]: {
    type: "object", additionalProperties: false, required: ["hypotheses"],
    properties: { hypotheses: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["targetType", "targetId", "confidence", "evidenceIds", "explanation"], properties: { targetType: { type: "string", enum: ["component", "wire"] }, targetId: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, evidenceIds: { type: "array", items: { type: "string" } }, explanation: { type: "string", minLength: 1, maxLength: 280 } } } } }
  },
  [ToolSchemaName.Repair]: {
    type: "object", additionalProperties: false, required: ["target", "action", "evidenceIds", "expectedOutcome"],
    properties: {
      target: { oneOf: [{ type: "object", additionalProperties: false, required: ["type", "componentId"], properties: { type: { const: "component" }, componentId: { type: "string" } } }, { type: "object", additionalProperties: false, required: ["type", "wireId"], properties: { type: { const: "wire" }, wireId: { type: "string" } } }] },
      action: { type: "string", enum: ["reconnect_wire", "replace_component", "correct_value", "reverse_component"] },
      evidenceIds: { type: "array", minItems: 2, items: { type: "string" } }, expectedOutcome: { type: "string", minLength: 1, maxLength: 280 }
    }
  },
  [ToolSchemaName.Empty]: { type: "object", additionalProperties: false, properties: {} }
};

function tool(name: ProbePilotToolName, description: string, inputSchema: JsonSchema, execute: WebMcpTool["execute"], readOnlyHint = false): WebMcpTool {
  return { name, description, inputSchema, execute, annotations: { readOnlyHint, destructiveHint: !readOnlyHint, openWorldHint: false } };
}

export function createProbePilotTools(store: StoreApi<StudioState>): WebMcpTool[] {
  return [
    tool(
      ProbePilotToolName.Inspect,
      "Inspect the current public ProbePilot Studio state. Returns exact circuit components, terminals, wires, revisions, simulation results, and public bench evidence. It never reveals the hidden bench fault.",
      schemas[ToolSchemaName.Inspect],
      (raw) => {
        const input = inspectInput.parse(raw);
        return buildPublicStudioDto(store.getState(), input.scope);
      },
      true
    ),
    tool(
      ProbePilotToolName.BuildCircuit,
      "Atomically add supported low-voltage components and semantic terminal-to-terminal connections to the visible design. Use temporary keys to connect components created in the same call.",
      schemas[ToolSchemaName.Build],
      (raw) => {
        const input = buildInput.parse(raw);
        return store.getState().buildCircuit(input, { ...actor, expectedRevision: input.expectedRevision });
      }
    ),
    tool(
      ProbePilotToolName.UpdateComponents,
      "Update supported properties, labels, or positions on existing design components. Human-protected components cannot be changed. Reinspect after any revision conflict.",
      schemas[ToolSchemaName.Update],
      (raw) => {
        const input = updateInput.parse(raw);
        const preflight = preflightComponentUpdates(store.getState(), input);
        if (!preflight.ok) return { ok: false, results: [preflight.result] };
        let revision = input.expectedRevision;
        const results = [];
        for (const update of preflight.updates) {
          const result = store.getState().updateComponent(update.componentId, {
            label: update.label,
            position: update.position,
            properties: update.properties
          }, { ...actor, expectedRevision: revision });
          results.push(result);
          if (!result.ok) return { ok: false, results };
          revision = result.revision;
        }
        return { ok: true, revision, results };
      }
    ),
    tool(
      ProbePilotToolName.RemoveElements,
      "Remove selected components or wires from the editable design. Removing a component also removes its attached wires. Human-protected elements are rejected.",
      schemas[ToolSchemaName.Remove],
      (raw) => {
        const input = removeInput.parse(raw);
        return store.getState().removeElements(input.componentIds, input.wireIds, { ...actor, expectedRevision: input.expectedRevision, activityLabel: `Agent removed elements: ${input.reason}` });
      }
    ),
    tool(
      ProbePilotToolName.Simulate,
      "Validate the current design and asynchronously run the selected local simulation engine. Await the final result before inspecting component voltages, current, output state, or compatibility blockers.",
      schemas[ToolSchemaName.Simulate],
      (raw) => {
        const input = simulateInput.parse(raw);
        return store.getState().runSimulation(
          { ...actor, expectedRevision: input.expectedRevision },
          { preferredEngineId: input.preferredEngineId }
        );
      }
    ),
    tool(
      ProbePilotToolName.RequestMeasurement,
      "Ask the human to perform one voltage or continuity measurement between two exact test-point IDs. This highlights the points and opens the virtual multimeter, but it cannot take or return the measurement itself.",
      schemas[ToolSchemaName.Measurement],
      (raw) => store.getState().requestMeasurement(measurementInput.parse(raw), actor)
    ),
    tool(
      ProbePilotToolName.UpdateHypotheses,
      "Publish concise diagnostic hypotheses into the shared UI. Every hypothesis must cite existing human-performed measurement IDs.",
      schemas[ToolSchemaName.Hypotheses],
      (raw) => store.getState().updateHypotheses(hypothesesInput.parse(raw).hypotheses, actor)
    ),
    tool(
      ProbePilotToolName.StageRepair,
      "Stage an evidence-backed bench repair for human review. At least two completed human measurements are required. This never applies the repair.",
      schemas[ToolSchemaName.Repair],
      (raw) => store.getState().stageRepair(stageRepairInput.parse(raw), actor)
    ),
    tool(
      ProbePilotToolName.VerifyBench,
      "After the human approves a staged repair, compare the virtual bench outputs with the intended design and report whether they match.",
      schemas[ToolSchemaName.Empty],
      (raw) => {
        emptyInput.parse(raw);
        return store.getState().verifyBench(actor);
      }
    )
  ];
}
