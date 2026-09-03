import { describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { simulateDcCircuit } from "@/domain/simulation";
import { SimulationAnalysisType } from "@/simulation/simulation-engine";
import { TscircuitSpiceSimulationEngine } from "@/simulation/tscircuit-spice-simulation-engine";

describe("deterministic and SPICE parity", () => {
  it("agrees on the switched LED source, state, and current", async () => {
    const design = createDemoDesign();
    const deterministic = simulateDcCircuit(design);
    const spice = await new TscircuitSpiceSimulationEngine().simulate(design, { analysis: { type: SimulationAnalysisType.OperatingPoint } });

    expect(spice.status, JSON.stringify(spice.issues)).toBe("pass");
    expect(spice.nodeVoltages["v1:positive"]).toBeCloseTo(deterministic.nodeVoltages["v1:positive"] ?? 9, 6);
    expect(spice.components.led1?.state).toBe(deterministic.components.led1?.state);
    expect(spice.components.r1?.currentAmps).toBeCloseTo(deterministic.components.r1?.currentAmps ?? 0, 2);
  }, 20_000);

  it("keeps private fault markers out of SPICE results", async () => {
    const result = await new TscircuitSpiceSimulationEngine().simulate(createDemoDesign(), { analysis: { type: SimulationAnalysisType.OperatingPoint } });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("open_wire");
    expect(serialized).not.toContain("hiddenFault");
    expect(serialized).not.toContain("bench-");
  }, 20_000);
});
