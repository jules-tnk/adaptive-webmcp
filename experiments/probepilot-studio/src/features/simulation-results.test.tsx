import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SimulationResults } from "@/features/simulation-results";
import { SimulationEngineId, SimulationWaveformAxis, SimulationWaveformQuantity, type SimulationResult } from "@/domain/types";
import { SimulationAnalysisType } from "@/simulation/simulation-engine";

const result: SimulationResult = {
  status: "pass", designRevision: 4, issues: [], summary: "RC transient completed.", engineId: SimulationEngineId.Spice,
  nodeVoltages: { "c1:a": 4.9 }, branchCurrents: { r1: 0.0049 },
  components: { r1: { voltageDrop: 4.9, currentAmps: 0.0049 } }, observableOutputs: [],
  waveforms: [{ id: "c1:a", label: "C1 voltage", quantity: SimulationWaveformQuantity.Voltage, axis: SimulationWaveformAxis.Time, componentId: "c1", terminalId: "a", points: [{ x: 0, y: 0 }, { x: 0.01, y: 4.9 }] }]
};

describe("SimulationResults", () => {
  afterEach(() => cleanup());

  it("renders engine, readings, accessible waveform, and tabular values", () => {
    render(<SimulationResults result={result} requestedEngineId={SimulationEngineId.Spice} requestedAnalysisType={SimulationAnalysisType.Transient} executedEngineId={SimulationEngineId.Spice} durationMs={32} warnings={[]} compatibility={{ compatible: true, blockers: [] }} />);
    expect(screen.getAllByText("SPICE")).toHaveLength(2);
    expect(screen.getByText("32 ms")).toBeInTheDocument();
    expect(screen.getByText("TRANSIENT")).toBeInTheDocument();
    expect(screen.getByText("Node voltages")).toBeInTheDocument();
    expect(screen.getByText("Component readings")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "C1 voltage waveform" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "C1 voltage values" })).toBeInTheDocument();
  });

  it("renders failure diagnostics without a chart", () => {
    render(<SimulationResults result={{ ...result, status: "fail", summary: "Unsupported model.", issues: [{ code: "NO_MODEL", severity: "error", message: "Q1 cannot be simulated.", affectedIds: ["q1"] }], nodeVoltages: {}, components: {}, waveforms: undefined }} requestedEngineId={SimulationEngineId.Spice} requestedAnalysisType={SimulationAnalysisType.OperatingPoint} executedEngineId={null} durationMs={null} warnings={["Q1 has no model."]} compatibility={{ compatible: false, blockers: [{ componentId: "q1", reason: "No verified model." }] }} />);
    expect(screen.getByText("Unsupported model.")).toBeInTheDocument();
    expect(screen.getByText("Q1 has no model.")).toBeInTheDocument();
    expect(screen.getByText("Q1 cannot be simulated.")).toBeInTheDocument();
    expect(screen.getByText(/No verified model/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
