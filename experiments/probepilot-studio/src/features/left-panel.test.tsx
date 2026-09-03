import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SimulationEngineId } from "@/simulation/simulation-engine";
import { SimulationRunStatus, studioStore } from "@/state/store";
import { LeftPanel } from "./left-panel";

describe("LeftPanel simulation lifecycle", () => {
  beforeEach(() => {
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Idle,
      activeSimulationRunId: null,
      requestedEngineId: null,
      executedEngineId: null
    });
    studioStore.getState().resetDemo();
    studioStore.setState({ mode: "simulate" });
  });

  afterEach(() => cleanup());

  it("announces an active simulation instead of presenting it as not run", () => {
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Pending,
      activeSimulationRunId: 41,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null
    });

    render(<LeftPanel />);

    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("Simulation is running with a SPICE preference.")).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Executed")).toBeInTheDocument();
    expect(screen.getByText("SPICE")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("shows engine, duration, warnings, and exact compatibility blockers", () => {
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Failure,
      activeSimulationRunId: null,
      requestedEngineId: SimulationEngineId.Spice,
      executedEngineId: null,
      simulationDurationMs: 42,
      simulationWarnings: ["The source is close to its configured current limit."],
      simulationCompatibility: {
        compatible: false,
        blockers: [
          { componentId: "q1", reason: "NPN BJT has no verified SPICE mapping." },
          { componentId: "u1", reason: "Op-amp has no verified SPICE mapping." }
        ]
      },
      simulation: {
        status: "fail",
        designRevision: studioStore.getState().design.revision,
        issues: [],
        nodeVoltages: {},
        branchCurrents: {},
        components: {},
        observableOutputs: [],
        summary: "No available engine can simulate this design."
      }
    });

    render(<LeftPanel />);

    expect(screen.getByText("SPICE")).toBeInTheDocument();
    expect(screen.getByText("NOT RUN")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toBeInTheDocument();
    expect(screen.getByText("The source is close to its configured current limit.")).toBeInTheDocument();
    expect(screen.getByText("q1 · NPN BJT has no verified SPICE mapping.")).toBeInTheDocument();
    expect(screen.getByText("u1 · Op-amp has no verified SPICE mapping.")).toBeInTheDocument();
  });

  it("explains that superseded work is draining before another run", () => {
    studioStore.setState({
      simulationStatus: SimulationRunStatus.Superseded,
      activeSimulationRunId: 42
    });

    render(<LeftPanel />);

    expect(screen.getByText("SUPERSEDED")).toBeInTheDocument();
    expect(screen.getByText("The superseded simulation is finishing before another run can start.")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });
});
