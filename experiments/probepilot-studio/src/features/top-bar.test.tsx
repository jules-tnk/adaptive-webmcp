import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulationEngineId } from "@/simulation/simulation-engine";
import { SimulationRunStatus, studioStore } from "@/state/store";
import { TopBar } from "./top-bar";

describe("TopBar Bench capability gate", () => {
  beforeEach(() => {
    localStorage.clear();
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Idle,
      activeSimulationRunId: null,
      requestedEngineId: null,
      executedEngineId: null
    });
    studioStore.getState().resetDemo();
  });

  afterEach(() => cleanup());

  it("disables Simulate and Bench with visible feedback while a run is pending", async () => {
    expect((await studioStore.getState().runSimulation({ actor: "human" })).ok).toBe(true);
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Pending,
      activeSimulationRunId: 99
    });

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Simulating…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulating…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Bench" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bench" })).toHaveAttribute(
      "title",
      "Bench unavailable while simulation is running."
    );
  });

  it("keeps Bench unavailable after simulation when any component lacks Bench support", async () => {
    expect(studioStore.getState().addComponent("capacitor", { x: 920, y: 260 }, { actor: "human" }).ok).toBe(true);
    expect((await studioStore.getState().runSimulation({ actor: "human" })).ok).toBe(true);

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Bench" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bench" })).toHaveAttribute("title", expect.stringContaining("Capacitor"));
  });

  it("keeps simulation controls disabled while superseded work finishes", () => {
    studioStore.setState({
      mode: "design",
      simulationStatus: SimulationRunStatus.Superseded,
      activeSimulationRunId: 100
    });

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Finishing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bench" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bench" })).toHaveAttribute(
      "title",
      "Bench unavailable while a superseded simulation is finishing."
    );
  });

  it("keeps Bench disabled after a non-failing SPICE execution", async () => {
    expect((await studioStore.getState().runSimulation({ actor: "human" })).ok).toBe(true);
    studioStore.setState({
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: SimulationEngineId.Spice
    });

    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TopBar /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Bench" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bench" })).toHaveAttribute(
      "title",
      `Run a non-failing deterministic simulation for revision ${studioStore.getState().design.revision} before starting Bench.`
    );
  });
});
