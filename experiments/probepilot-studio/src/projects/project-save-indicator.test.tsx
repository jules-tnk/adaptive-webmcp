import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createBlankDesign } from "@/domain/fixtures";
import { ProjectAutosave } from "@/projects/project-autosave";
import { ProjectRepository } from "@/projects/project-repository";
import { ProjectSaveIndicator } from "@/projects/project-save-indicator";
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

describe("ProjectSaveIndicator", () => {
  afterEach(() => cleanup());

  it("announces successful local autosave", async () => {
    const store = createStudioStore(createBlankDesign("initial"));
    const autosave = new ProjectAutosave(new ProjectRepository(new MemoryStorage()), store);
    const stop = autosave.start();
    render(<ProjectSaveIndicator autosave={autosave} />);
    store.getState().newBlankProject();
    await autosave.flush();
    await waitFor(() => expect(screen.getByText("Saved locally")).toBeInTheDocument());
    stop();
  });
});
