import { createComponent } from "@/domain/catalog";
import { createDemoDesign } from "@/domain/fixtures";
import { simulateDcCircuit } from "@/domain/simulation";
import { ComponentKind, type CircuitDesign, type SimulationResult } from "@/domain/types";
import { DeterministicSimulationEngine } from "./deterministic-simulation-engine";
import { SimulationCoordinator } from "./simulation-coordinator";
import {
  SimulationDiagnosticCode,
  SimulationEngineId,
  type SimulationCompatibility,
  type SimulationCompatibilityResolver,
  type SimulationEngine,
  type SimulationRequest
} from "./simulation-engine";
import { describe, expect, it } from "vitest";

const compatible: SimulationCompatibility = { compatible: true, blockers: [] };

function resultFor(design: CircuitDesign, summary: string): SimulationResult {
  return {
    status: "pass",
    designRevision: design.revision,
    issues: [],
    nodeVoltages: {},
    branchCurrents: {},
    components: {},
    observableOutputs: [],
    summary
  };
}

function engine(
  id: SimulationEngineId,
  compatibility: SimulationCompatibility,
  summary: string,
  failure?: Error
): SimulationEngine {
  return {
    id,
    canSimulate: () => compatibility,
    simulate: (design: CircuitDesign, _request: SimulationRequest) => {
      if (failure) return Promise.reject(failure);
      return Promise.resolve(resultFor(design, summary));
    }
  };
}

type TestThrownValue = Error | string | object | null | undefined;

function failingEngine(
  thrownValue: TestThrownValue,
  synchronous: boolean
): SimulationEngine {
  return {
    id: SimulationEngineId.Spice,
    canSimulate: () => compatible,
    simulate: () => {
      if (synchronous) throw thrownValue;
      return Promise.reject(thrownValue);
    }
  };
}

describe("SimulationCoordinator", () => {
  it.each([
    { label: "passing result with omitted attribution", status: "pass" as const, authoredEngineId: undefined },
    { label: "passing result with mismatched attribution", status: "pass" as const, authoredEngineId: SimulationEngineId.Deterministic },
    { label: "failing result with omitted attribution", status: "fail" as const, authoredEngineId: undefined },
    { label: "failing result with mismatched attribution", status: "fail" as const, authoredEngineId: SimulationEngineId.Deterministic }
  ])("stamps selected SPICE over a $label", async ({ status, authoredEngineId }) => {
    const spiceEngine: SimulationEngine = {
      id: SimulationEngineId.Spice,
      canSimulate: () => compatible,
      simulate: (design) => {
        const result = resultFor(design, "engine-authored result");
        result.status = status;
        if (authoredEngineId) result.engineId = authoredEngineId;
        return Promise.resolve(result);
      }
    };

    const result = await new SimulationCoordinator([spiceEngine]).simulate(createDemoDesign());

    expect(result.status).toBe(status);
    expect(result.summary).toBe("engine-authored result");
    expect(result.engineId).toBe(SimulationEngineId.Spice);
  });

  it("selects deterministic simulation first regardless of injected engine order", async () => {
    const coordinator = new SimulationCoordinator([
      engine(SimulationEngineId.Spice, compatible, "spice"),
      engine(SimulationEngineId.Deterministic, compatible, "deterministic")
    ]);

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.summary).toBe("deterministic");
  });

  it("selects SPICE when deterministic simulation is incompatible", async () => {
    const deterministicCompatibility: SimulationCompatibility = {
      compatible: false,
      blockers: [{ componentId: "c1", reason: "Capacitors require SPICE simulation." }]
    };
    const capabilityResolver: SimulationCompatibilityResolver = {
      resolve: (candidate) => candidate.id === SimulationEngineId.Spice
        ? compatible
        : deterministicCompatibility
    };
    const coordinator = new SimulationCoordinator(
      [
        engine(SimulationEngineId.Deterministic, compatible, "deterministic"),
        engine(SimulationEngineId.Spice, compatible, "spice")
      ],
      capabilityResolver
    );

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.summary).toBe("spice");
  });

  it("does not let permissive policy bypass intrinsic engine incompatibility", async () => {
    const intrinsicCompatibility: SimulationCompatibility = {
      compatible: false,
      blockers: [{ componentId: "u1", reason: "The engine has no verified op-amp model." }]
    };
    const permissivePolicy: SimulationCompatibilityResolver = {
      resolve: () => compatible
    };
    const coordinator = new SimulationCoordinator(
      [engine(SimulationEngineId.Spice, intrinsicCompatibility, "must not execute")],
      permissivePolicy
    );

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.status).toBe("fail");
    expect(result.issues).toEqual([{
      code: SimulationDiagnosticCode.UnsupportedComponent,
      severity: "error",
      message: "The engine has no verified op-amp model.",
      affectedIds: ["u1"]
    }]);
  });

  it("rejects unsupported components with every blocking component and reason", async () => {
    const compatibility: SimulationCompatibility = {
      compatible: false,
      blockers: [
        { componentId: "q1", reason: "No verified NPN model is available." },
        { componentId: "u1", reason: "No verified op-amp model is available." }
      ]
    };
    const coordinator = new SimulationCoordinator([
      engine(SimulationEngineId.Spice, compatibility, "must not execute")
    ]);

    const result = await coordinator.simulate(createDemoDesign(), {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(result.status).toBe("fail");
    expect(result.issues).toEqual([
      {
        code: SimulationDiagnosticCode.UnsupportedComponent,
        severity: "error",
        message: "No verified NPN model is available.",
        affectedIds: ["q1"]
      },
      {
        code: SimulationDiagnosticCode.UnsupportedComponent,
        severity: "error",
        message: "No verified op-amp model is available.",
        affectedIds: ["u1"]
      }
    ]);
  });

  it("honors a compatible preferred-engine override", async () => {
    const coordinator = new SimulationCoordinator([
      engine(SimulationEngineId.Deterministic, compatible, "deterministic"),
      engine(SimulationEngineId.Spice, compatible, "spice")
    ]);

    const result = await coordinator.simulate(createDemoDesign(), {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(result.summary).toBe("spice");
  });

  it("turns engine failures into diagnostics without losing the design revision", async () => {
    const coordinator = new SimulationCoordinator([
      engine(SimulationEngineId.Spice, compatible, "spice", new Error("ngspice exited with status 1"))
    ]);

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.status).toBe("fail");
    expect(result.designRevision).toBe(1);
    expect(result.engineId).toBe(SimulationEngineId.Spice);
    expect(result.issues).toEqual([
      {
        code: SimulationDiagnosticCode.EngineFailure,
        severity: "error",
        message: "SPICE simulation failed: ngspice exited with status 1",
        affectedIds: []
      }
    ]);
  });

  it.each([
    { label: "synchronous null", value: null, synchronous: true, message: "No error details were provided." },
    { label: "rejected null", value: null, synchronous: false, message: "No error details were provided." },
    { label: "synchronous undefined", value: undefined, synchronous: true, message: "No error details were provided." },
    { label: "rejected undefined", value: undefined, synchronous: false, message: "No error details were provided." },
    { label: "synchronous string", value: "engine stopped", synchronous: true, message: "engine stopped" },
    { label: "rejected string", value: "engine stopped", synchronous: false, message: "engine stopped" },
    { label: "synchronous object", value: { cause: "engine stopped" }, synchronous: true, message: "The engine threw a non-Error object." },
    { label: "rejected object", value: { cause: "engine stopped" }, synchronous: false, message: "The engine threw a non-Error object." }
  ])("normalizes a $label engine failure into a resolved result", async ({ value, synchronous, message }) => {
    const coordinator = new SimulationCoordinator([failingEngine(value, synchronous)]);

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.status).toBe("fail");
    expect(result.engineId).toBe(SimulationEngineId.Spice);
    expect(result.issues).toEqual([{
      code: SimulationDiagnosticCode.EngineFailure,
      severity: "error",
      message: `SPICE simulation failed: ${message}`,
      affectedIds: []
    }]);
  });

  it("reports a missing preferred engine without fabricating a component blocker", async () => {
    const coordinator = new SimulationCoordinator([
      engine(SimulationEngineId.Deterministic, compatible, "deterministic")
    ]);

    const result = await coordinator.simulate(createDemoDesign(), {
      preferredEngineId: SimulationEngineId.Spice
    });

    expect(result.status).toBe("fail");
    expect(result.engineId).toBeUndefined();
    expect(result.issues).toEqual([{
      code: SimulationDiagnosticCode.EngineUnavailable,
      severity: "error",
      message: "SPICE simulation is not available.",
      affectedIds: []
    }]);
  });

  it("reports that no simulation engine is available", async () => {
    const coordinator = new SimulationCoordinator([]);

    const result = await coordinator.simulate(createDemoDesign());

    expect(result.status).toBe("fail");
    expect(result.engineId).toBeUndefined();
    expect(result.issues).toEqual([{
      code: SimulationDiagnosticCode.EngineUnavailable,
      severity: "error",
      message: "No simulation engines are available.",
      affectedIds: []
    }]);
  });

  it("preserves the deterministic solver output through the asynchronous boundary", async () => {
    const design = createDemoDesign();
    const expected = simulateDcCircuit(design);
    const coordinator = new SimulationCoordinator([new DeterministicSimulationEngine()]);

    const actual = await coordinator.simulate(design);

    expect(actual).toEqual({
      ...expected,
      engineId: SimulationEngineId.Deterministic
    });
  });

  it("lists all components outside deterministic parity in stable component-id order", () => {
    const design = createDemoDesign();
    design.components.u1 = createComponent(
      ComponentKind.OpAmp,
      "u1",
      { x: 0, y: 0 },
      "human",
      design.components
    );
    design.components.c1 = createComponent(
      ComponentKind.Capacitor,
      "c1",
      { x: 0, y: 0 },
      "human",
      design.components
    );

    expect(new DeterministicSimulationEngine().canSimulate(design)).toEqual({
      compatible: false,
      blockers: [
        {
          componentId: "c1",
          reason: "Capacitor is not supported by deterministic simulation."
        },
        {
          componentId: "u1",
          reason: "Op-amp is not supported by deterministic simulation."
        }
      ]
    });
  });
});
