import type { AnyCircuitElementInput } from "circuit-json";
import { PhysicalBoardSide, type PhysicalPlacement } from "@/physical/physical-design";

export enum SupportedFootprint {
  Chip0805 = "0805",
  Chip1206 = "1206",
  Sod123 = "SOD-123",
  TerminalBlock = "terminal block",
  TestPoint = "test point",
  BatteryConnector = "battery connector",
  TestPointPair = "test point pair",
  SwitchThroughHole = "SW_THT",
  PotentiometerThroughHole = "POT_THT",
  To92 = "TO-92",
  To220 = "TO-220",
  Dip8 = "DIP-8"
}

export enum FootprintMounting { Surface = "surface", ThroughHole = "through-hole" }

export interface FootprintSpec {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly packageHeightMm: number;
  readonly padWidthMm: number;
  readonly padHeightMm: number;
  readonly mounting: FootprintMounting;
}

export interface FootprintElements {
  readonly elements: AnyCircuitElementInput[];
  readonly terminalPoints: Readonly<Record<string, { readonly x: number; readonly y: number; readonly pcbPortId: string }>>;
  readonly generic: boolean;
}

const footprintSpecs: Readonly<Record<SupportedFootprint, FootprintSpec>> = {
  [SupportedFootprint.Chip0805]: { widthMm: 2, heightMm: 1.25, packageHeightMm: 0.7, padWidthMm: 0.9, padHeightMm: 1.2, mounting: FootprintMounting.Surface },
  [SupportedFootprint.Chip1206]: { widthMm: 3.2, heightMm: 1.6, packageHeightMm: 0.8, padWidthMm: 1.2, padHeightMm: 1.5, mounting: FootprintMounting.Surface },
  [SupportedFootprint.Sod123]: { widthMm: 3.7, heightMm: 1.8, packageHeightMm: 1.35, padWidthMm: 1.2, padHeightMm: 1.6, mounting: FootprintMounting.Surface },
  [SupportedFootprint.TerminalBlock]: { widthMm: 10, heightMm: 8, packageHeightMm: 10, padWidthMm: 2.4, padHeightMm: 2.4, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.TestPoint]: { widthMm: 4, heightMm: 4, packageHeightMm: 1, padWidthMm: 2.2, padHeightMm: 2.2, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.BatteryConnector]: { widthMm: 12, heightMm: 8, packageHeightMm: 9, padWidthMm: 2.4, padHeightMm: 2.4, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.TestPointPair]: { widthMm: 8, heightMm: 4, packageHeightMm: 1, padWidthMm: 2.2, padHeightMm: 2.2, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.SwitchThroughHole]: { widthMm: 12, heightMm: 6, packageHeightMm: 7, padWidthMm: 2.2, padHeightMm: 2.2, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.PotentiometerThroughHole]: { widthMm: 10, heightMm: 10, packageHeightMm: 12, padWidthMm: 2.2, padHeightMm: 2.2, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.To92]: { widthMm: 5, heightMm: 4, packageHeightMm: 6, padWidthMm: 1.8, padHeightMm: 1.8, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.To220]: { widthMm: 10, heightMm: 5, packageHeightMm: 15, padWidthMm: 2, padHeightMm: 2, mounting: FootprintMounting.ThroughHole },
  [SupportedFootprint.Dip8]: { widthMm: 10, heightMm: 8, packageHeightMm: 4, padWidthMm: 1.8, padHeightMm: 1.8, mounting: FootprintMounting.ThroughHole }
};

const genericFootprint: FootprintSpec = { widthMm: 6, heightMm: 4, packageHeightMm: 3, padWidthMm: 1.4, padHeightMm: 1.4, mounting: FootprintMounting.Surface };

export class FootprintAdapter {
  static resolve(name: string): { readonly spec: FootprintSpec; readonly generic: boolean } {
    const spec = footprintSpecs[name as SupportedFootprint];
    return spec ? { spec, generic: false } : { spec: genericFootprint, generic: true };
  }

  static create(
    componentId: string,
    componentLabel: string,
    placement: PhysicalPlacement,
    sourcePortIds: readonly string[],
    boardThicknessMm: number
  ): FootprintElements {
    const { spec, generic } = FootprintAdapter.resolve(placement.footprint);
    const pcbComponentId = `pcb_component_${componentId}`;
    const sourceComponentId = `source_component_${componentId}`;
    const radians = placement.rotationDegrees * Math.PI / 180;
    const points = sourcePortIds.map((sourcePortId, index) => {
      const ratio = sourcePortIds.length <= 1 ? 0.5 : index / (sourcePortIds.length - 1);
      const localX = (ratio - 0.5) * Math.max(1, spec.widthMm - spec.padWidthMm);
      const x = placement.xMm + localX * Math.cos(radians);
      const y = placement.yMm + localX * Math.sin(radians);
      return { sourcePortId, x, y, pcbPortId: `pcb_port_${componentId}_${index + 1}` };
    });
    const elements: AnyCircuitElementInput[] = [{
      type: "pcb_component",
      pcb_component_id: pcbComponentId,
      source_component_id: sourceComponentId,
      center: { x: placement.xMm, y: placement.yMm },
      layer: placement.side,
      rotation: placement.rotationDegrees,
      width: spec.widthMm,
      height: spec.heightMm,
      positioned_relative_to_pcb_board_id: undefined
    }, {
      type: "cad_component",
      cad_component_id: `cad_component_${componentId}`,
      pcb_component_id: pcbComponentId,
      source_component_id: sourceComponentId,
      position: { x: placement.xMm, y: placement.yMm, z: boardThicknessMm / 2 + spec.packageHeightMm / 2 },
      rotation: { x: 0, y: 0, z: placement.rotationDegrees },
      size: { x: spec.widthMm, y: spec.heightMm, z: spec.packageHeightMm },
      layer: placement.side,
      footprinter_string: placement.footprint,
      model_object_fit: "contain_within_bounds",
      show_as_bounding_box: true,
      anchor_alignment: "center_of_component_on_board_surface"
    }, {
      type: "pcb_silkscreen_rect",
      pcb_silkscreen_rect_id: `pcb_silkscreen_rect_${componentId}`,
      pcb_component_id: pcbComponentId,
      center: { x: placement.xMm, y: placement.yMm },
      width: spec.widthMm,
      height: spec.heightMm,
      layer: placement.side,
      stroke_width: 0.2,
      corner_radius: 0.3,
      ccw_rotation: placement.rotationDegrees
    }, {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: `pcb_silkscreen_text_${componentId}`,
      pcb_component_id: pcbComponentId,
      text: componentLabel,
      font: "tscircuit2024",
      font_size: 1,
      layer: placement.side,
      anchor_position: { x: placement.xMm, y: placement.yMm + spec.heightMm / 2 + 1.2 },
      anchor_alignment: "bottom_center",
      ccw_rotation: placement.rotationDegrees,
      is_mirrored: placement.side === PhysicalBoardSide.Bottom
    }];
    const terminalPoints: Record<string, { readonly x: number; readonly y: number; readonly pcbPortId: string }> = {};
    points.forEach((point, index) => {
      terminalPoints[point.sourcePortId] = { x: point.x, y: point.y, pcbPortId: point.pcbPortId };
      elements.push({
        type: "pcb_port",
        pcb_port_id: point.pcbPortId,
        source_port_id: point.sourcePortId,
        pcb_component_id: pcbComponentId,
        x: point.x,
        y: point.y,
        layers: spec.mounting === FootprintMounting.ThroughHole ? ["top", "bottom"] : [placement.side]
      });
      if (spec.mounting === FootprintMounting.ThroughHole) {
        elements.push({
          type: "pcb_plated_hole",
          shape: "circle",
          pcb_plated_hole_id: `pcb_hole_${componentId}_${index + 1}`,
          outer_diameter: Math.max(spec.padWidthMm, spec.padHeightMm),
          hole_diameter: Math.min(spec.padWidthMm, spec.padHeightMm) * 0.45,
          x: point.x,
          y: point.y,
          layers: ["top", "bottom"],
          pcb_component_id: pcbComponentId,
          pcb_port_id: point.pcbPortId
        });
      } else {
        elements.push({
          type: "pcb_smtpad",
          shape: "pill",
          pcb_smtpad_id: `pcb_pad_${componentId}_${index + 1}`,
          x: point.x,
          y: point.y,
          width: spec.padWidthMm,
          height: spec.padHeightMm,
          radius: Math.min(spec.padWidthMm, spec.padHeightMm) / 2,
          layer: placement.side,
          pcb_component_id: pcbComponentId,
          pcb_port_id: point.pcbPortId
        });
      }
    });
    return { elements, terminalPoints, generic };
  }
}
