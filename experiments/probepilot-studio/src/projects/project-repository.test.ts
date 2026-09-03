import { beforeEach, describe, expect, it } from "vitest";
import { ActivityLog } from "@/activity/activity-log";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { CircuitFixtures, createBlankDesign, createDemoDesign } from "@/domain/fixtures";
import type { ActivityEvent } from "@/domain/types";
import { ProjectCodec } from "@/projects/project-codec";
import { ProjectRepository } from "@/projects/project-repository";
import { ProjectSchemaVersion } from "@/projects/project-types";
import { PhysicalPlacementMode } from "@/physical/physical-design";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function activity(index: number): ActivityEvent {
  return {
    id: `activity-${index}`,
    actor: "human",
    action: "component_added",
    summary: `Activity ${index}`,
    affectedIds: [],
    createdAt: new Date(2026, 7, 31, 0, 0, index).toISOString()
  };
}

describe("ProjectRepository", () => {
  let repository: ProjectRepository;

  beforeEach(() => {
    repository = new ProjectRepository(new MemoryStorage());
  });

  it("creates, reads, updates, lists, and deletes projects", () => {
    const created = repository.create(createBlankDesign("source"), []);
    expect(repository.get(created.id)?.name).toBe("Untitled circuit");

    const renamed = repository.rename(created.id, "Power indicator");
    expect(renamed.name).toBe("Power indicator");
    expect(renamed.design.name).toBe("Power indicator");
    expect(repository.list()).toHaveLength(1);

    expect(repository.delete(created.id)).toBe(true);
    expect(repository.get(created.id)).toBeNull();
  });

  it("lists the most recently updated project first", () => {
    const first = repository.create(createBlankDesign("first"), []);
    const second = repository.create(createBlankDesign("second"), []);
    repository.save({ ...first, updatedAt: "2026-08-31T12:00:00.000Z" });
    repository.save({ ...second, updatedAt: "2026-08-31T13:00:00.000Z" });
    expect(repository.list().map((project) => project.id)).toEqual([second.id, first.id]);
  });

  it("duplicates a project under a new ID", () => {
    const source = repository.create(createBlankDesign("source"), [activity(1)]);
    const duplicate = repository.duplicate(source.id);
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.design.id).toBe(duplicate.id);
    expect(duplicate.name).toBe("Untitled circuit copy");
    expect(duplicate.activities).toHaveLength(1);
  });

  it("imports as a new project without overwriting an ID", () => {
    const existing = repository.create(createBlankDesign("existing"), []);
    const imported = repository.importJson(ProjectCodec.serialize(existing));
    expect(imported.id).not.toBe(existing.id);
    expect(imported.design.id).toBe(imported.id);
    expect(imported.name).toBe("Untitled circuit (Imported)");
    expect(repository.list()).toHaveLength(2);
  });

  it("rejects malformed JSON and imports with more than 100 activities", () => {
    expect(() => repository.importJson("not-json")).toThrow("valid ProbePilot project");
    const record = repository.create(createBlankDesign("source"), []);
    const tooMany = Array.from({ length: ActivityLog.MaxEntries + 1 }, (_, index) => activity(index));
    const json = JSON.stringify({ ...record, activities: tooMany });
    expect(() => repository.importJson(json)).toThrow("valid ProbePilot project");
  });

  it("round-trips an exported project through the validated import format", () => {
    const source = repository.create(createBlankDesign("source"), [activity(1)]);
    const json = repository.exportJson(source.id);
    const decoded = ProjectCodec.parseImport(json);
    expect(decoded.name).toBe(source.name);
    expect(decoded.activities).toEqual(source.activities);
    expect(ProjectCodec.fileName(source)).toBe("untitled-circuit.probepilot.json");
  });

  it("rejects physical metadata outside the bounded project schema", () => {
    const source = repository.create(createDemoDesign(), []);
    const invalidBoard = JSON.stringify({ ...source, physicalDesign: { ...source.physicalDesign, board: { ...source.physicalDesign.board, widthMm: 501 } } });
    const invalidRotation = JSON.stringify({
      ...source,
      physicalDesign: {
        ...source.physicalDesign,
        placements: { ...source.physicalDesign.placements, r1: { ...source.physicalDesign.placements.r1!, rotationDegrees: 360 } }
      }
    });

    expect(() => ProjectCodec.parseImport(invalidBoard)).toThrow("valid ProbePilot project");
    expect(() => ProjectCodec.parseImport(invalidRotation)).toThrow("valid ProbePilot project");
  });

  it("round-trips every registered component kind and its normalized version-1 properties", () => {
    const source = repository.create(CircuitFixtures.createComponentCatalogDesign(), [activity(1)]);

    const decoded = ProjectCodec.parseImport(ProjectCodec.serialize(source));

    expect(Object.values(decoded.design.components).map((component) => component.kind)).toEqual([
      "dc_source", "ground", "resistor", "led", "switch", "battery", "current_source",
      "capacitor", "inductor", "diode", "zener_diode", "schottky_diode", "fuse",
      "potentiometer", "push_button", "spdt_switch", "npn_bjt", "pnp_bjt",
      "n_channel_mosfet", "p_channel_mosfet", "op_amp"
    ]);
    expect(decoded.design.components).toEqual(source.design.components);
    expect(decoded.design.id).toBe(source.design.id);
    expect(decoded.design.revision).toBe(7);
  });

  it("keeps every project-codec property branch aligned with registry default keys", () => {
    const source = repository.create(CircuitFixtures.createComponentCatalogDesign(), []);
    const decoded = ProjectCodec.parseImport(ProjectCodec.serialize(source));

    for (const definition of ComponentDefinitionRegistry.list()) {
      const properties = decoded.design.components[`catalog-${definition.kind.replaceAll("_", "-")}`]?.properties
        ?? Object.values(decoded.design.components).find((component) => component.kind === definition.kind)?.properties;

      expect(properties?.kind).toBe(definition.kind);
      expect(Object.keys(properties ?? {}).sort()).toEqual(Object.keys(definition.defaultProperties).sort());
    }
  });

  it("rejects unknown persisted property keys", () => {
    const source = repository.create(createDemoDesign(), []);
    const invalid = ProjectCodec.serialize(source).replace('"enabled": true', '"enabled": true,\n          "unexpected": 1');

    expect(() => ProjectCodec.parseImport(invalid)).toThrow("valid ProbePilot project");
  });

  it("rejects properties from the wrong discriminated component branch", () => {
    const source = repository.create(createDemoDesign(), []);
    const invalid = ProjectCodec.serialize(source).replace('"kind": "dc_source",\n          "voltage"', '"kind": "resistor",\n          "voltage"');

    expect(() => ProjectCodec.parseImport(invalid)).toThrow("valid ProbePilot project");
  });

  it("rejects non-normalized SI strings in persisted component properties", () => {
    const source = repository.create(createDemoDesign(), []);
    const invalid = ProjectCodec.serialize(source).replace('"resistanceOhms": 330', '"resistanceOhms": "330Ω"');

    expect(() => ProjectCodec.parseImport(invalid)).toThrow("valid ProbePilot project");
  });

  it("migrates legacy resistor projects to the normalized default tolerance and persists it", () => {
    const source = repository.create(createDemoDesign(), []);
    const legacyJson = ProjectCodec.serialize(source).replace('"tolerance": 0.05,', "");

    const migrated = ProjectCodec.parseImport(legacyJson);

    expect(migrated.design.components.r1?.properties).toMatchObject({ resistanceOhms: 330, tolerance: 0.05 });
    expect(ProjectCodec.serialize(migrated)).toContain('"tolerance": 0.05');
    expect(migrated.id).toBe(source.id);
    expect(migrated.design.id).toBe(source.design.id);
    expect(migrated.design.revision).toBe(source.design.revision);
  });

  it("migrates legacy version-1 collections without changing project IDs or circuit revisions", () => {
    const source = repository.create(createDemoDesign(), [activity(1)]);
    const { physicalDesign: _physicalDesign, ...legacySource } = source;
    const legacyCollection = JSON.stringify([{ ...legacySource, schemaVersion: ProjectSchemaVersion.Legacy }]);

    const [migrated] = ProjectCodec.parseCollection(legacyCollection);

    expect(migrated).toMatchObject({ id: source.id, schemaVersion: ProjectSchemaVersion.Current });
    expect(migrated?.physicalDesign.placementMode).toBe(PhysicalPlacementMode.Automatic);
    expect(migrated?.design).toMatchObject({ id: source.design.id, revision: source.design.revision });
    expect(migrated?.activities).toEqual(source.activities);
    expect(migrated?.design.components.r1?.properties).toMatchObject({ tolerance: 0.05 });
  });
});
