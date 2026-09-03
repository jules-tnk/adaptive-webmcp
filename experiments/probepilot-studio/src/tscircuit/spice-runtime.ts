import { circuitJsonToSpice } from "circuit-json-to-spice";
import { Resistor, SpiceNetlist, VoltageSource } from "spicets";
import type { SpiceRuntimeEngine } from "./spice-engine-payload";

export class SpiceRuntime {
  static createVoltageDividerNetlist(): string {
    const divider = new SpiceNetlist({
      title: "Voltage divider",
      cards: [
        new VoltageSource({ name: "V1", nodes: ["vin", "0"], dc: 5 }),
        new Resistor({ name: "R1", nodes: ["vin", "vout"], resistance: "10k" }),
        new Resistor({ name: "R2", nodes: ["vout", "0"], resistance: "10k" })
      ]
    });

    return divider.getString();
  }

  static getNgspiceEngine(): () => Promise<SpiceRuntimeEngine> {
    return async () => {
      const module = await import("./local-ngspice-engine-adapter");
      return module.LocalNgspiceEngineAdapter.create();
    };
  }

  static getCircuitJsonConverter(): typeof circuitJsonToSpice {
    return circuitJsonToSpice;
  }
}
