import { SpiceRuntime } from "@/tscircuit/spice-runtime";
import { describe, expect, it, vi } from "vitest";

describe("browser SPICE runtime contract", () => {
  it("builds the complete V1/R1/R2 voltage-divider topology", () => {
    const divider = SpiceRuntime.createVoltageDividerNetlist();

    expect(divider.trimEnd().split("\n")).toEqual([
      "Voltage divider",
      "V1 vin 0 DC 5",
      "R1 vin vout 10k",
      "R2 vout 0 10k",
      ".end"
    ]);
  });

  it("exposes a callable ngspice factory without simulating", async () => {
    const createNgspiceSpiceEngine = SpiceRuntime.getNgspiceEngine();

    expect(createNgspiceSpiceEngine).toBeTypeOf("function");
    const engine = await createNgspiceSpiceEngine();

    expect(engine.simulate).toBeTypeOf("function");
    expect(SpiceRuntime.getCircuitJsonConverter()).toBeTypeOf("function");
  });

  it("simulates locally when hosted fetches are blocked", async () => {
    const blockedFetch = vi.fn<typeof fetch>(() => Promise.reject(new Error("Hosted fetch blocked")));
    vi.stubGlobal("fetch", blockedFetch);

    try {
      const engine = await SpiceRuntime.getNgspiceEngine()();
      const operatingPointDivider = SpiceRuntime.createVoltageDividerNetlist().replace(
        ".end",
        ".op\n.end"
      );
      const result = await engine.simulate(operatingPointDivider);

      expect(result.engineVersionString).toMatch(/^ngspice-/);
      expect(result.simulationResultCircuitJson).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "simulation_dc_operating_point_voltage",
          name: "vout",
          voltage: 2.5
        })
      ]));
      expect(blockedFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
