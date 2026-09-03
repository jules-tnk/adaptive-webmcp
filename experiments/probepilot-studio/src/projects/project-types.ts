import type { ActivityEvent, CircuitDesign } from "@/domain/types";
import type { PhysicalDesign } from "@/physical/physical-design";

export enum ProjectSchemaVersion {
  Legacy = 1,
  Current = 2
}

export enum ProjectSaveStatus {
  Idle = "idle",
  Saving = "saving",
  Saved = "saved",
  Failed = "failed"
}

export interface ProjectRecord {
  readonly schemaVersion: ProjectSchemaVersion.Current;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly design: CircuitDesign;
  readonly activities: ActivityEvent[];
  readonly physicalDesign: PhysicalDesign;
}

export interface ProjectSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly componentCount: number;
  readonly wireCount: number;
  readonly activityCount: number;
}
