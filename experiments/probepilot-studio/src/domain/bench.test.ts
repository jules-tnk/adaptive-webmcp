import { describe, expect, it } from "vitest";
import { PrivateBenchEngine } from "./bench";
import { createDemoDesign } from "./fixtures";
import type { StagedRepair } from "./types";

function repair(wireId: string): StagedRepair {
  return {
    id: "repair-1",
    target: { type: "wire", wireId },
    action: "reconnect_wire",
    evidenceIds: ["M1", "M2"],
    expectedOutcome: "Restore power to LED1.",
    stagedBy: "agent",
    status: "awaiting_human"
  };
}

describe("private bench engine", () => {
  it("keeps the hidden fault out of its public session", () => {
    const engine = new PrivateBenchEngine();
    const session = engine.createSession(createDemoDesign(), { type: "open_wire", wireId: "w3" });
    const serialized = JSON.stringify(session);
    expect(serialized).not.toContain("open_wire");
    expect(serialized).not.toContain('"wireId":"w3"');
    expect(session.symptoms[0]?.message).toContain("should be on");
  });

  it("returns bench readings from the faulty implementation", () => {
    const engine = new PrivateBenchEngine();
    const session = engine.createSession(createDemoDesign(), { type: "open_wire", wireId: "w3" });
    expect(engine.measure(session.id, "dc_voltage", "r1:a", "gnd:g")).toEqual({ value: 9, unit: "V" });
    expect(engine.measure(session.id, "dc_voltage", "led1:anode", "gnd:g")).toEqual({ value: 0, unit: "V" });
  });

  it("fails a wrong repair and passes the matching repair", () => {
    const engine = new PrivateBenchEngine();
    const wrongSession = engine.createSession(createDemoDesign(), { type: "open_wire", wireId: "w3" });
    expect(engine.applyRepair(wrongSession.id, repair("w2"))).toBe(false);
    expect(engine.verify(wrongSession.id).result).toBe("fail");

    const correctSession = engine.createSession(createDemoDesign(), { type: "open_wire", wireId: "w3" });
    expect(engine.applyRepair(correctSession.id, repair("w3"))).toBe(true);
    expect(engine.verify(correctSession.id).result).toBe("pass");
  });
});
