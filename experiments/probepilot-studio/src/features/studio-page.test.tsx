import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { createBlankDesign } from "@/domain/fixtures";
import { StudioPage } from "@/features/studio-page";
import { projectRepository } from "@/projects/project-runtime";

vi.mock("@/features/assembly-preview", () => ({
  AssemblyPreview: () => <section aria-label="3D assembly preview"/>
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}{location.search}</output>;
}

describe("StudioPage project routing", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
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

  it("restores workspace navigation and panel state from the URL", async () => {
    const design = createBlankDesign("collapsible-panels");
    design.name = "Collapsible panels";
    const project = projectRepository.create(design, []);
    const entry = `/studio/${project.id}?view=3d&panel=activity&left=collapsed&right=collapsed`;
    const renderStudio = () => render(<MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LocationProbe/><Routes><Route path="/studio/:projectId" element={<StudioPage />} /></Routes></MemoryRouter>);

    const first = renderStudio();
    await waitFor(() => expect(screen.getByLabelText("Project name")).toHaveValue("Collapsible panels"));
    expect(screen.getByRole("button", { name: "Expand components panel" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Expand inspector panel" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "3D Preview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Expand inspector panel" }));
    expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");

    first.unmount();
    renderStudio();
    await waitFor(() => expect(screen.getByRole("button", { name: "Expand components panel" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Expand inspector panel" })).toBeInTheDocument();
  });

  it("writes workspace view, inspector tab, and panel changes into a canonical URL", async () => {
    const project = projectRepository.create(createBlankDesign("url-updates"), []);
    render(<MemoryRouter initialEntries={[`/studio/${project.id}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LocationProbe/><Routes><Route path="/studio/:projectId" element={<StudioPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText("Project name")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "3D Preview" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: "Collapse components panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse inspector panel" }));

    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent(`view=3d&panel=activity&left=collapsed&right=collapsed`));
  });

  it("syncs simulation mode to the URL and restores its circuit-only state", async () => {
    const project = projectRepository.create(createBlankDesign("url-mode"), []);
    render(<MemoryRouter initialEntries={[`/studio/${project.id}?mode=simulate&view=3d`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LocationProbe/><Routes><Route path="/studio/:projectId" element={<StudioPage />} /></Routes></MemoryRouter>);

    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent(`?mode=simulate`));
    expect(screen.getByRole("button", { name: "Circuit" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Simulation results" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent(`/studio/${project.id}`));
  });
});
