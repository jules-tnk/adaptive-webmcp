import { describe, expect, it } from "vitest";
import { createBlankDesign } from "@/domain/fixtures";
import { ProjectAutosave } from "@/projects/project-autosave";
import { ProjectRepository } from "@/projects/project-repository";
import { ProjectSaveStatus } from "@/projects/project-types";
import { createStudioStore } from "@/state/store";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class FailingStorage extends MemoryStorage {
  override setItem(): void { throw new Error("quota"); }
}

describe("ProjectAutosave", () => {
  it("saves durable project changes", async () => {
    const repository = new ProjectRepository(new MemoryStorage());
    const store = createStudioStore(createBlankDesign("initial"));
    const autosave = new ProjectAutosave(repository, store);
    const stop = autosave.start();

    store.getState().newBlankProject();
    await autosave.flush();

    const saved = repository.get(store.getState().projectId);
    expect(saved?.name).toBe("Untitled circuit");
    expect(autosave.getStatus()).toBe(ProjectSaveStatus.Saved);
    stop();
  });

  it("reports storage failures without breaking the active store", async () => {
    const repository = new ProjectRepository(new FailingStorage());
    const store = createStudioStore(createBlankDesign("initial"));
    const autosave = new ProjectAutosave(repository, store);
    const stop = autosave.start();

    store.getState().newBlankProject();
    await autosave.flush();

    expect(store.getState().projectName).toBe("Untitled circuit");
    expect(autosave.getStatus()).toBe(ProjectSaveStatus.Failed);
    stop();
  });
});
