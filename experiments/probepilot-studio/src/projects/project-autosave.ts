import type { StoreApi } from "zustand/vanilla";
import { cloneDesign } from "@/domain/clone";
import type { ProjectRepository } from "@/projects/project-repository";
import { ProjectSaveStatus, ProjectSchemaVersion, type ProjectRecord } from "@/projects/project-types";
import type { StudioState } from "@/state/store";

export class ProjectAutosave {
  private status = ProjectSaveStatus.Idle;
  private readonly listeners = new Set<() => void>();
  private lastFingerprint = "";
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: ProjectRepository,
    private readonly store: StoreApi<StudioState>
  ) {}

  start(): () => void {
    this.lastFingerprint = this.fingerprint(this.store.getState());
    return this.store.subscribe((state) => {
      const fingerprint = this.fingerprint(state);
      if (fingerprint === this.lastFingerprint) return;
      this.lastFingerprint = fingerprint;
      this.setStatus(ProjectSaveStatus.Saving);
      this.pending = this.pending.then(() => this.save(state));
    });
  }

  flush(): Promise<void> {
    return this.pending;
  }

  getStatus(): ProjectSaveStatus {
    return this.status;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private save(state: StudioState): void {
    try {
      const current = this.repository.get(state.projectId);
      const timestamp = new Date().toISOString();
      const design = cloneDesign(state.design);
      design.id = state.projectId;
      design.name = state.projectName;
      const record: ProjectRecord = {
        schemaVersion: ProjectSchemaVersion.Current,
        id: state.projectId,
        name: state.projectName,
        createdAt: current?.createdAt ?? timestamp,
        updatedAt: timestamp,
        design,
        activities: state.activities.map((entry) => ({ ...entry, affectedIds: [...entry.affectedIds] })),
        physicalDesign: state.physicalDesign
      };
      this.repository.save(record);
      this.setStatus(ProjectSaveStatus.Saved);
    } catch {
      this.setStatus(ProjectSaveStatus.Failed);
    }
  }

  private fingerprint(state: StudioState): string {
    return JSON.stringify({ id: state.projectId, name: state.projectName, design: state.design, activities: state.activities, physicalDesign: state.physicalDesign });
  }

  private setStatus(status: ProjectSaveStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener();
  }
}
