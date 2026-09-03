import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitFixtures, createDemoDesign } from "@/domain/fixtures";
import { ProjectAutosave } from "@/projects/project-autosave";
import { ProjectRepository } from "@/projects/project-repository";
import { ProjectSaveIndicator } from "@/projects/project-save-indicator";
import { ProjectSaveStatus, ProjectSchemaVersion, type ProjectRecord } from "@/projects/project-types";
import { PhysicalLayout } from "@/physical/physical-layout";
import { studioStore } from "@/state/store";
import { CircuitBoard } from "./circuit-board";

async function loadDemo(): Promise<void> {
  const design = createDemoDesign();
  const record: ProjectRecord = {
    schemaVersion: ProjectSchemaVersion.Current,
    id: design.id,
    name: design.name,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    design,
    activities: [],
    physicalDesign: PhysicalLayout.generate(design)
  };
  studioStore.getState().loadProject(record);
  expect((await studioStore.getState().runSimulation({ actor: "human" })).ok).toBe(true);
  expect(studioStore.getState().setMode("design").ok).toBe(true);
}

function loadCatalog(): void {
  const design = CircuitFixtures.createComponentCatalogDesign();
  const record: ProjectRecord = {
    schemaVersion: ProjectSchemaVersion.Current,
    id: design.id,
    name: design.name,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    design,
    activities: [],
    physicalDesign: PhysicalLayout.generate(design)
  };
  studioStore.getState().loadProject(record);
}

function renderBoardWithAutosave() {
  const autosave = new ProjectAutosave(new ProjectRepository(window.localStorage), studioStore);
  const stopAutosave = autosave.start();
  render(<><CircuitBoard /><ProjectSaveIndicator autosave={autosave} /></>);
  return { autosave, stopAutosave };
}

function resistorCard(): HTMLElement {
  return screen.getByRole("button", { name: "R1, Resistor, 330 Ω" });
}

function pointer(target: Element | Window, type: "pointerdown" | "pointermove" | "pointerup", clientX: number, clientY: number): void {
  fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }));
}

describe("CircuitBoard pointer interactions", () => {
  beforeEach(async () => {
    localStorage.clear();
    await loadDemo();
  });

  afterEach(() => cleanup());

  it("does not report a React console error for a stationary pointer lifecycle", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { autosave, stopAutosave } = renderBoardWithAutosave();

    try {
      pointer(resistorCard(), "pointerdown", 530, 125);
      await waitFor(() => expect(studioStore.getState().selection).toEqual({ type: "component", id: "r1" }));
      pointer(window, "pointerup", 530, 125);
      await act(async () => { await autosave.flush(); });

      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      stopAutosave();
    }
  });

  it("selects a stationary pointer without changing the design, history, activity, simulation, or autosave state", async () => {
    const { autosave, stopAutosave } = renderBoardWithAutosave();
    const before = studioStore.getState();
    const beforeRevision = before.design.revision;
    const beforePosition = before.design.components.r1?.position;
    const beforeHistory = before.historyPast.length;
    const beforeActivities = before.activities.length;
    const beforeSimulation = before.simulation;

    pointer(resistorCard(), "pointerdown", 530, 125);
    await waitFor(() => expect(studioStore.getState().selection).toEqual({ type: "component", id: "r1" }));
    pointer(window, "pointerup", 530, 125);
    await act(async () => { await autosave.flush(); });

    const after = studioStore.getState();
    expect(after.selection).toEqual({ type: "component", id: "r1" });
    expect(after.design.revision).toBe(beforeRevision);
    expect(after.design.components.r1?.position).toEqual(beforePosition);
    expect(after.historyPast).toHaveLength(beforeHistory);
    expect(after.activities).toHaveLength(beforeActivities);
    expect(after.simulation).toBe(beforeSimulation);
    expect(autosave.getStatus()).toBe(ProjectSaveStatus.Idle);
    stopAutosave();
  });

  it("commits one position update after a real pointer movement", async () => {
    const { autosave, stopAutosave } = renderBoardWithAutosave();
    const before = studioStore.getState();
    const beforeRevision = before.design.revision;
    const beforeHistory = before.historyPast.length;
    const beforeActivities = before.activities.length;

    pointer(resistorCard(), "pointerdown", 530, 125);
    await waitFor(() => expect(studioStore.getState().selection).toEqual({ type: "component", id: "r1" }));
    pointer(window, "pointermove", 570, 155);
    pointer(window, "pointerup", 570, 155);
    await act(async () => { await autosave.flush(); });
    pointer(window, "pointerup", 570, 155);

    const after = studioStore.getState();
    expect(after.design.components.r1?.position).toEqual({ x: 570, y: 155 });
    expect(after.design.revision).toBe(beforeRevision + 1);
    expect(after.historyPast).toHaveLength(beforeHistory + 1);
    expect(after.activities).toHaveLength(beforeActivities + 1);
    expect(after.simulation).toBeNull();
    expect(autosave.getStatus()).toBe(ProjectSaveStatus.Saved);
    stopAutosave();
  });

  it("shows a component-specific value for every catalog card", () => {
    loadCatalog();
    render(<CircuitBoard />);

    expect(screen.getAllByRole("button", { name: /, / })).toHaveLength(21);
    expect(screen.queryByText("Reference")).not.toBeInTheDocument();
  });

  it("focuses, selects with Enter, and deletes a component from the Design board", () => {
    render(<CircuitBoard />);
    const component = resistorCard();

    expect(component.tagName).toBe("BUTTON");
    expect(component.querySelector("button, input, select, a[href]")).toBeNull();
    component.focus();
    expect(component).toHaveFocus();
    expect(component).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(component, { key: "Enter" });
    expect(studioStore.getState().selection).toEqual({ type: "component", id: "r1" });
    expect(component).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(component, { key: "Delete" });
    expect(studioStore.getState().design.components.r1).toBeUndefined();
    expect(studioStore.getState().design.wires.w2).toBeUndefined();
    expect(studioStore.getState().design.wires.w3).toBeUndefined();
  });

  it("focuses, selects with Space, and deletes a wire from the Design board", () => {
    render(<CircuitBoard />);
    const wire = screen.getByRole("button", { name: "Wire w3, R1 terminal B to LED1 terminal Anode (+)" });

    wire.focus();
    expect(wire).toHaveFocus();
    expect(wire).toHaveAttribute("tabindex", "0");
    expect(wire).toHaveAttribute("focusable", "true");
    fireEvent.keyDown(wire, { key: " " });
    expect(studioStore.getState().selection).toEqual({ type: "wire", id: "w3" });
    expect(wire).toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(wire, { key: "Delete" });
    expect(studioStore.getState().design.wires.w3).toBeUndefined();
  });

  it("does not delete a focused element outside Design mode", async () => {
    expect((await studioStore.getState().runSimulation({ actor: "human" })).ok).toBe(true);
    render(<CircuitBoard />);
    const wire = screen.getByRole("button", { name: "Wire w3, R1 terminal B to LED1 terminal Anode (+)" });

    fireEvent.keyDown(wire, { key: "Enter" });
    fireEvent.keyDown(wire, { key: "Delete" });

    expect(studioStore.getState().design.wires.w3).toBeDefined();
  });
});
