import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankDesign } from "@/domain/fixtures";
import { ProjectCodec } from "@/projects/project-codec";
import { ProjectLibrary } from "@/projects/project-library";
import { ProjectRepository } from "@/projects/project-repository";
import type { ProjectRecord } from "@/projects/project-types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("ProjectLibrary", () => {
  let repository: ProjectRepository;
  let opened: ProjectRecord[];

  beforeEach(() => {
    repository = new ProjectRepository(new MemoryStorage());
    opened = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty-state action when no projects exist", () => {
    render(<ProjectLibrary repository={repository} onOpen={(project) => opened.push(project)} />);
    expect(screen.getByRole("region", { name: "Your projects" })).toBeInTheDocument();
    expect(screen.getByText("No saved projects yet.")).toBeInTheDocument();
  });

  it("opens and renames a saved project", () => {
    const project = repository.create(createBlankDesign("source"), []);
    render(<ProjectLibrary repository={repository} onOpen={(record) => opened.push(record)} />);

    fireEvent.click(screen.getByRole("button", { name: `Open ${project.name}` }));
    expect(opened[0]?.id).toBe(project.id);

    fireEvent.click(screen.getByRole("button", { name: `Manage ${project.name}` }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Indicator test" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(repository.get(project.id)?.name).toBe("Indicator test");
  });

  it("duplicates and deletes projects", () => {
    const project = repository.create(createBlankDesign("source"), []);
    render(<ProjectLibrary repository={repository} onOpen={(record) => opened.push(record)} />);
    fireEvent.click(screen.getByRole("button", { name: `Manage ${project.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(opened[0]?.id).not.toBe(project.id);
    expect(repository.list()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete project?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(repository.get(project.id)).toBeNull();
  });

  it("imports a valid project and reports invalid files", async () => {
    const sourceRepository = new ProjectRepository(new MemoryStorage());
    const source = sourceRepository.create(createBlankDesign("source"), []);
    const validFile = new File([ProjectCodec.serialize(source)], "source.probepilot.json", { type: "application/json" });
    Object.defineProperty(validFile, "text", { value: async () => ProjectCodec.serialize(source) });
    const invalidFile = new File(["bad"], "bad.json", { type: "application/json" });
    Object.defineProperty(invalidFile, "text", { value: async () => "bad" });
    render(<ProjectLibrary repository={repository} onOpen={(record) => opened.push(record)} />);
    const input = screen.getByLabelText("Import ProbePilot project");

    fireEvent.change(input, { target: { files: [validFile] } });
    await waitFor(() => expect(opened).toHaveLength(1));
    expect(repository.list()).toHaveLength(1);

    fireEvent.change(input, { target: { files: [invalidFile] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("valid ProbePilot project"));
  });
});
