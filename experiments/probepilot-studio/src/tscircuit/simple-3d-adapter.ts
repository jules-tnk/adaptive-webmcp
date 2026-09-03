import { convertCircuitJsonToSimple3dSvg, type AnglePreset } from "circuit-json-to-simple-3d";
import type { AnyCircuitElement } from "circuit-json";

export enum Simple3dAngle { Angle1 = "angle1", Angle2 = "angle2", Left = "left", Right = "right", LeftRaised = "left-raised", RightRaised = "right-raised" }

export class Simple3dAdapter {
  static render(elements: AnyCircuitElement[], anglePreset: Simple3dAngle): Promise<string> {
    return convertCircuitJsonToSimple3dSvg(elements, { anglePreset: anglePreset as AnglePreset, width: 900, height: 560, background: { color: "transparent", opacity: 0 }, showAxes: true });
  }
}
