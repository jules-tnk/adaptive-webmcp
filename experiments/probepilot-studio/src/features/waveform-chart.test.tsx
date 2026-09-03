import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SimulationWaveformAxis, SimulationWaveformQuantity } from "@/domain/types";
import { WaveformChart } from "@/features/waveform-chart";

describe("WaveformChart", () => {
  afterEach(() => cleanup());
  it("renders bounded SVG coordinates and a table alternative", () => {
    render(<WaveformChart waveform={{ id: "vout", label: "Output", axis: SimulationWaveformAxis.Time, quantity: SimulationWaveformQuantity.Voltage, points: [{ x: 0, y: -2 }, { x: 1, y: 3 }, { x: 2, y: 1 }] }} />);
    const path = screen.getByTestId("waveform-path");
    expect(path.getAttribute("d")).toMatch(/^M /);
    expect(screen.getByRole("table", { name: "Output values" })).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
});
