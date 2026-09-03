import { describe, expect, it } from "vitest";
import { ComponentKind } from "@/domain/types";
import {
  SpiceIdealResistance,
  SpiceModelName,
  SpiceModelRegistry
} from "./spice-model-registry";

describe("SpiceModelRegistry", () => {
  it("provides exact named model cards for every verified diode family", () => {
    expect(SpiceModelRegistry.cardFor(ComponentKind.Diode)?.getString()).toBe(
      ".model PP_DIODE D (IS=2.52n N=1.752)"
    );
    expect(SpiceModelRegistry.cardFor(ComponentKind.ZenerDiode)?.getString()).toBe(
      ".model PP_ZENER D (IS=2.52n N=1.752 BV=5.1 IBV=1m)"
    );
    expect(SpiceModelRegistry.cardFor(ComponentKind.SchottkyDiode)?.getString()).toBe(
      ".model PP_SCHOTTKY D (IS=200n N=1.05 RS=0.1 BV=40 IBV=10u)"
    );
    expect(SpiceModelRegistry.cardFor(ComponentKind.Led)?.getString()).toBe(
      ".model PP_LED D (IS=1e-20 N=2 RS=10 CJO=2p EG=2.1 BV=5 IBV=10u)"
    );
  });

  it("keeps model names and idealized path resistances stable", () => {
    expect(SpiceModelRegistry.modelNameFor(ComponentKind.Diode)).toBe(SpiceModelName.Diode);
    expect(SpiceModelRegistry.modelNameFor(ComponentKind.ZenerDiode)).toBe(SpiceModelName.Zener);
    expect(SpiceModelRegistry.modelNameFor(ComponentKind.SchottkyDiode)).toBe(SpiceModelName.Schottky);
    expect(SpiceModelRegistry.modelNameFor(ComponentKind.Led)).toBe(SpiceModelName.Led);
    expect(SpiceIdealResistance.Closed).toBe("1m");
    expect(SpiceIdealResistance.Open).toBe("1t");
  });

  it.each([
    ComponentKind.NpnBjt,
    ComponentKind.PnpBjt,
    ComponentKind.NChannelMosfet,
    ComponentKind.PChannelMosfet,
    ComponentKind.OpAmp
  ])("does not invent a model for unsupported %s components", (kind) => {
    expect(SpiceModelRegistry.modelNameFor(kind)).toBeUndefined();
    expect(SpiceModelRegistry.cardFor(kind)).toBeUndefined();
  });
});
