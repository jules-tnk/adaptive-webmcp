import { ActivityLog } from "@/activity/activity-log";
import { cloneDesign } from "@/domain/clone";
import type { ActivityEvent, CircuitDesign } from "@/domain/types";
import { ProjectCodec } from "@/projects/project-codec";
import { ProjectSchemaVersion, type ProjectRecord, type ProjectSummary } from "@/projects/project-types";
import { PhysicalLayout } from "@/physical/physical-layout";

enum ProjectStorageKey {
  Collection = "probepilot:projects:v1"
}

export class ProjectRepository {
  constructor(private readonly storage: Storage) {}

  list(): ProjectRecord[] {
    return this.readAll().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  summaries(): ProjectSummary[] {
    return this.list().map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      componentCount: Object.keys(project.design.components).length,
      wireCount: Object.keys(project.design.wires).length,
      activityCount: project.activities.length
    }));
  }

  get(id: string): ProjectRecord | null {
    const project = this.readAll().find((item) => item.id === id);
    return project ? this.copy(project) : null;
  }

  create(design: CircuitDesign, activities: readonly ActivityEvent[]): ProjectRecord {
    const id = `project-${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    const projectDesign = cloneDesign(design);
    projectDesign.id = id;
    const record: ProjectRecord = {
      schemaVersion: ProjectSchemaVersion.Current,
      id,
      name: projectDesign.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      design: projectDesign,
      activities: activities.slice(0, ActivityLog.MaxEntries).map((entry) => ({ ...entry, affectedIds: [...entry.affectedIds] })),
      physicalDesign: PhysicalLayout.generate(projectDesign)
    };
    return this.save(record);
  }

  save(record: ProjectRecord): ProjectRecord {
    const validated = ProjectCodec.parseImport(ProjectCodec.serialize(record));
    const records = this.readAll().filter((item) => item.id !== validated.id);
    records.push(validated);
    this.writeAll(records);
    return this.copy(validated);
  }

  rename(id: string, name: string): ProjectRecord {
    const current = this.require(id);
    const nextName = name.trim() || "Untitled circuit";
    const design = cloneDesign(current.design);
    design.name = nextName;
    return this.save({ ...current, name: nextName, design, updatedAt: new Date().toISOString() });
  }

  duplicate(id: string): ProjectRecord {
    const source = this.require(id);
    const design = cloneDesign(source.design);
    design.name = this.availableCopyName(source.name);
    return this.create(design, source.activities);
  }

  delete(id: string): boolean {
    const records = this.readAll();
    const remaining = records.filter((item) => item.id !== id);
    if (remaining.length === records.length) return false;
    this.writeAll(remaining);
    return true;
  }

  importJson(text: string): ProjectRecord {
    const imported = ProjectCodec.parseImport(text);
    const design = cloneDesign(imported.design);
    design.name = this.availableImportName(imported.name);
    return this.create(design, imported.activities);
  }

  exportJson(id: string): string {
    return ProjectCodec.serialize(this.require(id));
  }

  private availableCopyName(name: string): string {
    const names = new Set(this.readAll().map((item) => item.name.toLowerCase()));
    let candidate = `${name} copy`;
    let suffix = 2;
    while (names.has(candidate.toLowerCase())) {
      candidate = `${name} copy ${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private availableImportName(name: string): string {
    const names = new Set(this.readAll().map((item) => item.name.toLowerCase()));
    if (!names.has(name.toLowerCase())) return name;
    let candidate = `${name} (Imported)`;
    let suffix = 2;
    while (names.has(candidate.toLowerCase())) {
      candidate = `${name} (Imported ${suffix})`;
      suffix += 1;
    }
    return candidate;
  }

  private require(id: string): ProjectRecord {
    const record = this.get(id);
    if (!record) throw new Error("Project not found.");
    return record;
  }

  private readAll(): ProjectRecord[] {
    const text = this.storage.getItem(ProjectStorageKey.Collection);
    return text ? ProjectCodec.parseCollection(text) : [];
  }

  private writeAll(records: readonly ProjectRecord[]): void {
    this.storage.setItem(ProjectStorageKey.Collection, ProjectCodec.serializeCollection(records));
  }

  private copy(record: ProjectRecord): ProjectRecord {
    return ProjectCodec.parseImport(ProjectCodec.serialize(record));
  }
}
