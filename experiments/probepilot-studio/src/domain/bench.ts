import { cloneDesign } from "./clone";
import { parseTestPointId, terminalExists } from "./catalog";
import { simulateDcCircuit, terminalsHaveContinuity } from "./simulation";
import type {
  BenchFault,
  CircuitDesign,
  MeasurementMode,
  ObservableOutput,
  PublicBenchSession,
  RepairTarget,
  SimulationOverrides,
  StagedRepair,
  VerificationResult
} from "./types";

type PrivateBenchSession = {
  publicId: string;
  designSnapshot: CircuitDesign;
  fault: BenchFault;
  faultResolved: boolean;
};

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function symptomMessage(output: ObservableOutput): string {
  return output.expectedState === "on"
    ? `${output.label} should be on, but the virtual bench output is off.`
    : `${output.label} should be off, but the virtual bench output is on.`;
}

export class PrivateBenchEngine {
  private readonly sessions = new Map<string, PrivateBenchSession>();

  createSession(design: CircuitDesign, fixedFault?: BenchFault): PublicBenchSession {
    const expected = simulateDcCircuit(design);
    if (expected.status === "fail") throw new Error("A passing or warning simulation is required before creating a bench.");
    const fallbackWire = design.wires.w3 ?? Object.values(design.wires)[0];
    if (!fallbackWire && !fixedFault) throw new Error("The design needs at least one wire for the demo bench.");
    const fault = fixedFault ?? { type: "open_wire", wireId: fallbackWire!.id };
    const sessionId = id("bench");
    this.sessions.set(sessionId, {
      publicId: sessionId,
      designSnapshot: cloneDesign(design),
      fault,
      faultResolved: false
    });
    const actual = this.simulate(sessionId);
    const symptoms = expected.observableOutputs
      .filter((output) => actual.observableOutputs.find((item) => item.componentId === output.componentId)?.expectedState !== output.expectedState)
      .map((output) => ({
        code: "output_mismatch" as const,
        message: symptomMessage(output),
        affectedComponentIds: [output.componentId]
      }));
    return {
      id: sessionId,
      sourceDesignRevision: design.revision,
      sourceDesignSnapshot: cloneDesign(design),
      status: "active",
      symptoms,
      measurements: [],
      pendingMeasurement: null,
      hypotheses: [],
      stagedRepair: null,
      verification: null
    };
  }

  measure(sessionId: string, mode: MeasurementMode, firstTestPointId: string, secondTestPointId: string): { value: number; unit: "V" | "open" | "closed" } {
    const session = this.requireSession(sessionId);
    this.validateTestPoint(session.designSnapshot, firstTestPointId);
    this.validateTestPoint(session.designSnapshot, secondTestPointId);
    const overrides = this.overrides(session);
    if (mode === "dc_voltage") {
      const result = simulateDcCircuit(session.designSnapshot, overrides);
      const first = result.nodeVoltages[firstTestPointId] ?? 0;
      const second = result.nodeVoltages[secondTestPointId] ?? 0;
      return { value: Number((first - second).toFixed(3)), unit: "V" };
    }
    const closed = terminalsHaveContinuity(session.designSnapshot, firstTestPointId, secondTestPointId, overrides);
    return { value: closed ? 1 : 0, unit: closed ? "closed" : "open" };
  }

  applyRepair(sessionId: string, repair: StagedRepair): boolean {
    const session = this.requireSession(sessionId);
    const correct = this.repairMatchesFault(repair.target, repair.action, session.fault);
    if (correct) session.faultResolved = true;
    return correct;
  }

  verify(sessionId: string): VerificationResult {
    const session = this.requireSession(sessionId);
    const expected = simulateDcCircuit(session.designSnapshot);
    const actual = this.simulate(sessionId);
    const unresolved = expected.observableOutputs.filter((output) =>
      actual.observableOutputs.find((candidate) => candidate.componentId === output.componentId)?.expectedState !== output.expectedState
    );
    return {
      result: unresolved.length === 0 ? "pass" : "fail",
      expectedOutputs: expected.observableOutputs,
      actualOutputs: actual.observableOutputs,
      unresolvedSymptoms: unresolved.map((output) => ({
        code: "output_mismatch",
        message: symptomMessage(output),
        affectedComponentIds: [output.componentId]
      })),
      summary: unresolved.length === 0
        ? "The virtual bench now matches the intended design."
        : "The virtual bench still differs from the intended design."
    };
  }

  forget(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  private simulate(sessionId: string) {
    const session = this.requireSession(sessionId);
    return simulateDcCircuit(session.designSnapshot, this.overrides(session));
  }

  private overrides(session: PrivateBenchSession): SimulationOverrides {
    if (session.faultResolved) return {};
    if (session.fault.type === "open_wire") return { disconnectedWireIds: new Set([session.fault.wireId]) };
    if (session.fault.type === "open_component") return { openComponentIds: new Set([session.fault.componentId]) };
    if (session.fault.type === "wrong_resistor_value") return { resistorValues: { [session.fault.componentId]: session.fault.actualResistanceOhms } };
    return { reversedLedIds: new Set([session.fault.componentId]) };
  }

  private repairMatchesFault(target: RepairTarget, action: StagedRepair["action"], fault: BenchFault): boolean {
    if (fault.type === "open_wire") return target.type === "wire" && target.wireId === fault.wireId && action === "reconnect_wire";
    if (fault.type === "open_component") return target.type === "component" && target.componentId === fault.componentId && action === "replace_component";
    if (fault.type === "wrong_resistor_value") return target.type === "component" && target.componentId === fault.componentId && action === "correct_value";
    return target.type === "component" && target.componentId === fault.componentId && action === "reverse_component";
  }

  private validateTestPoint(design: CircuitDesign, value: string): void {
    const parsed = parseTestPointId(value);
    const component = parsed ? design.components[parsed.componentId] : undefined;
    if (!parsed || !component || !terminalExists(component, parsed.terminalId)) {
      throw new Error(`Invalid test point: ${value}`);
    }
  }

  private requireSession(sessionId: string): PrivateBenchSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error("The private bench session is no longer available.");
    return session;
  }
}
