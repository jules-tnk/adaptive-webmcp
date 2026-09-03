import { describe, expect, it } from "vitest";
import { createDemoDesign } from "./fixtures";
import { simulateDcCircuit } from "./simulation";

describe("DC simulation", () => {
  it("lights the intended demo LED", () => {
    const result = simulateDcCircuit(createDemoDesign());
    expect(result.status).toBe("pass");
    expect(result.observableOutputs).toContainEqual({ componentId: "led1", label: "LED1", expectedState: "on" });
    expect(result.components.led1?.currentAmps).toBeCloseTo(7 / 330, 5);
    expect(result.nodeVoltages["r1:b"]).toBeCloseTo(2, 3);
  });

  it("models an open wire without revealing a diagnosis", () => {
    const result = simulateDcCircuit(createDemoDesign(), { disconnectedWireIds: new Set(["w3"]) });
    expect(result.status).toBe("fail");
    expect(result.observableOutputs[0]?.expectedState).toBe("off");
    expect(result.nodeVoltages["r1:b"]).toBe(9);
    expect(result.nodeVoltages["led1:anode"]).toBe(0);
  });

  it("rejects a current path with no limiting resistance", () => {
    const design = createDemoDesign();
    delete design.components.r1;
    delete design.wires.w2;
    delete design.wires.w3;
    design.wires.direct = { id: "direct", a: { componentId: "sw1", terminalId: "b" }, b: { componentId: "led1", terminalId: "anode" }, createdBy: "human" };
    const result = simulateDcCircuit(design);
    expect(result.status).toBe("fail");
    expect(result.issues.some((issue) => issue.code === "SOURCE_SHORT")).toBe(true);
  });
});
