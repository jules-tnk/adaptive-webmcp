import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createBlankDesign } from "@/domain/fixtures";
import { StudioPage } from "@/features/studio-page";
import { projectRepository } from "@/projects/project-runtime";

describe("StudioPage project routing", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("hydrates the requested saved project", async () => {
    const design = createBlankDesign("source");
    design.name = "Hydrated project";
    const project = projectRepository.create(design, []);
    render(<MemoryRouter initialEntries={[`/studio/${project.id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/:projectId" element={<StudioPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText("Project name")).toHaveValue("Hydrated project"));
  });

  it("redirects an unknown project to the launchpad", async () => {
    render(<MemoryRouter initialEntries={["/studio/missing"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/studio/:projectId" element={<StudioPage />} /><Route path="/" element={<div>Project library</div>} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Project library")).toBeInTheDocument());
  });
});
