import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { CircuitDesign } from "@/domain/types";
import { PhysicalBoardSide, PhysicalPlacementMode, type PhysicalDesign, type PhysicalPlacement } from "@/physical/physical-design";

export class PhysicalLayout {
  static generate(design: CircuitDesign): PhysicalDesign {
    const components = Object.values(design.components).sort((left, right) => left.id.localeCompare(right.id));
    const columns = Math.max(1, Math.ceil(Math.sqrt(components.length)));
    const placements: Record<string, PhysicalPlacement> = {};
    components.forEach((component, index) => {
      placements[component.id] = {
        xMm: 12 + (index % columns) * 18,
        yMm: 12 + Math.floor(index / columns) * 16,
        rotationDegrees: 0,
        side: PhysicalBoardSide.Top,
        footprint: ComponentDefinitionRegistry.get(component.kind).defaultFootprint
      };
    });
    return {
      board: { widthMm: Math.max(80, 24 + columns * 18), heightMm: Math.max(60, 28 + Math.ceil(components.length / columns) * 16), thicknessMm: 1.6 },
      placements,
      placementMode: PhysicalPlacementMode.Automatic
    };
  }

  static reconcile(design: CircuitDesign, current: PhysicalDesign): PhysicalDesign {
    const generated = PhysicalLayout.generate(design);
    const placements: Record<string, PhysicalPlacement> = {};
    for (const componentId of Object.keys(design.components)) placements[componentId] = current.placements[componentId] ?? generated.placements[componentId]!;
    return {
      board: current.placementMode === PhysicalPlacementMode.Manual ? current.board : generated.board,
      placements,
      placementMode: current.placementMode
    };
  }
}
