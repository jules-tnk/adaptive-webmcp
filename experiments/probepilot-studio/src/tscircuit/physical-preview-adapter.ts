import { convertCircuitJsonToPcbSvg } from "circuit-to-svg";
import { any_circuit_element, type AnyCircuitElement, type AnyCircuitElementInput, type SourcePort, type SourceTrace } from "circuit-json";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { CircuitDesign } from "@/domain/types";
import type { PhysicalDesign } from "@/physical/physical-design";
import { FootprintAdapter } from "@/tscircuit/footprint-adapter";
import { TscircuitAdapter } from "@/tscircuit/tscircuit-adapter";
import { TscircuitDiagnosticSeverity } from "@/tscircuit/tscircuit-diagnostics";

export interface PhysicalPreviewResult {
  readonly elements: AnyCircuitElement[];
  readonly svg: string;
  readonly warnings: readonly string[];
}

export interface PhysicalPreviewSummary {
  readonly pcbAvailable: boolean;
  readonly threeDAvailable: boolean;
  readonly warnings: readonly string[];
}

export class PhysicalPreviewAdapter {
  private static isSourcePort(element: AnyCircuitElement): element is SourcePort {
    return element.type === "source_port";
  }

  private static isSourceTrace(element: AnyCircuitElement): element is SourceTrace {
    return element.type === "source_trace";
  }

  static summarize(design: CircuitDesign, physical: PhysicalDesign): PhysicalPreviewSummary {
    const schematic = TscircuitAdapter.toCircuitJson(design);
    const conversionErrors = schematic.diagnostics.filter((diagnostic) => diagnostic.severity === TscircuitDiagnosticSeverity.Error);
    if (conversionErrors.length > 0) {
      return { pcbAvailable: false, threeDAvailable: false, warnings: conversionErrors.map((diagnostic) => diagnostic.message) };
    }
    const warnings: string[] = [];
    for (const component of Object.values(design.components)) {
      const placement = physical.placements[component.id];
      if (!placement) {
        warnings.push(`${component.label} has no physical placement.`);
      } else if (FootprintAdapter.resolve(placement.footprint).generic) {
        warnings.push(`${component.label} uses generic geometry for ${placement.footprint}.`);
      }
    }
    return { pcbAvailable: true, threeDAvailable: true, warnings };
  }

  static convert(design: CircuitDesign, physical: PhysicalDesign): PhysicalPreviewResult {
    const schematic = TscircuitAdapter.toCircuitJson(design);
    if (schematic.diagnostics.some((diagnostic) => diagnostic.severity === TscircuitDiagnosticSeverity.Error)) {
      return { elements: [], svg: "", warnings: schematic.diagnostics.map((diagnostic) => diagnostic.message) };
    }
    const board: AnyCircuitElementInput = {
      type: "pcb_board", pcb_board_id: `pcb_board_${design.id}`, center: { x: physical.board.widthMm / 2, y: physical.board.heightMm / 2 },
      width: physical.board.widthMm, height: physical.board.heightMm, thickness: physical.board.thicknessMm,
      shape: "rect", material: "fr4", solder_mask_color: "#0f766e", silkscreen_color: "#ffffff"
    };
    const physicalElements: AnyCircuitElementInput[] = [];
    const terminalPoints = new Map<string, { readonly x: number; readonly y: number; readonly pcbPortId: string }>();
    const warnings = [...PhysicalPreviewAdapter.summarize(design, physical).warnings];
    for (const component of Object.values(design.components)) {
      const placement = physical.placements[component.id];
      if (!placement) continue;
      const sourcePorts = schematic.elements.filter(PhysicalPreviewAdapter.isSourcePort).filter((element) => element.source_component_id === `source_component_${component.id}`);
      const definition = ComponentDefinitionRegistry.get(component.kind);
      const sourcePortIds = definition.terminals.map((terminal) => sourcePorts.find((port) => port.name === terminal.id)?.source_port_id).filter((sourcePortId): sourcePortId is string => Boolean(sourcePortId));
      const generated = FootprintAdapter.create(component.id, component.label, placement, sourcePortIds, physical.board.thicknessMm);
      physicalElements.push(...generated.elements.map((element) => element.type === "pcb_component" ? { ...element, positioned_relative_to_pcb_board_id: `pcb_board_${design.id}` } : element));
      for (const [sourcePortId, point] of Object.entries(generated.terminalPoints)) terminalPoints.set(sourcePortId, point);
    }
    for (const wire of Object.values(design.wires)) {
      const sourceTrace = schematic.elements.filter(PhysicalPreviewAdapter.isSourceTrace).find((element) => element.source_trace_id === `source_trace_${wire.id}`);
      if (!sourceTrace || sourceTrace.connected_source_port_ids.length < 2) continue;
      const start = terminalPoints.get(sourceTrace.connected_source_port_ids[0]!);
      const end = terminalPoints.get(sourceTrace.connected_source_port_ids[1]!);
      if (!start || !end) continue;
      const layer = physical.placements[wire.a.componentId]?.side ?? physical.placements[wire.b.componentId]?.side;
      if (!layer) continue;
      physicalElements.push({
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${wire.id}`,
        source_trace_id: sourceTrace.source_trace_id,
        should_round_corners: true,
        route: [
          { route_type: "wire", x: start.x, y: start.y, width: 0.35, layer, start_pcb_port_id: start.pcbPortId },
          { route_type: "wire", x: end.x, y: end.y, width: 0.35, layer, end_pcb_port_id: end.pcbPortId }
        ]
      });
    }
    const parsed = any_circuit_element.array().safeParse([...schematic.elements, board, ...physicalElements]);
    if (!parsed.success) return { elements: [], svg: "", warnings: ["The generated physical preview did not pass Circuit JSON validation."] };
    const elements = parsed.data;
    const svg = convertCircuitJsonToPcbSvg(elements, {
      width: 900,
      height: 560,
      matchBoardAspectRatio: true,
      showCourtyards: true,
      showPinNumbers: true,
      backgroundColor: "transparent",
      colorOverrides: {
        boardOutline: "#475569",
        substrate: "#d9f5ef",
        silkscreen: { top: "#0f172a", bottom: "#6d28d9" },
        copper: { top: "#dc2626", bottom: "#2563eb" }
      }
    });
    return { elements, svg, warnings };
  }
}
