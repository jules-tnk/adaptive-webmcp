import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhysicalBoardSide, PhysicalPlacementMode, type PhysicalPlacement } from "@/physical/physical-design";
import { useStudioStore } from "@/state/store";

enum PhysicalBoardField { Width = "widthMm", Height = "heightMm", Thickness = "thicknessMm" }
enum PhysicalPlacementField { X = "xMm", Y = "yMm", Rotation = "rotationDegrees" }

export function PhysicalInspector() {
  const physical = useStudioStore((state) => state.physicalDesign);
  const design = useStudioStore((state) => state.design);
  const selection = useStudioStore((state) => state.selection);
  const setSelection = useStudioStore((state) => state.setSelection);
  const update = useStudioStore((state) => state.updatePhysicalDesign);
  const reset = useStudioStore((state) => state.resetPhysicalLayout);
  const componentIds = Object.keys(design.components).sort();
  const selectedComponentId = selection?.type === "component" && physical.placements[selection.id]
    ? selection.id
    : componentIds[0] ?? "";
  const selectedPlacement = physical.placements[selectedComponentId];
  const setBoard = (key: PhysicalBoardField, value: string): void => {
    const number = Number(value);
    const valid = key === PhysicalBoardField.Thickness
      ? number >= 0.2 && number <= 10
      : number >= 20 && number <= 500;
    if (!Number.isFinite(number) || !valid) return;
    update({ ...physical, board: { ...physical.board, [key]: number }, placementMode: PhysicalPlacementMode.Manual });
  };
  const setPlacement = (patch: Partial<PhysicalPlacement>): void => {
    if (!selectedPlacement) return;
    update({
      ...physical,
      placements: { ...physical.placements, [selectedComponentId]: { ...selectedPlacement, ...patch } },
      placementMode: PhysicalPlacementMode.Manual
    });
  };
  const setPlacementNumber = (key: PhysicalPlacementField, value: string): void => {
    const number = Number(value);
    const valid = key === PhysicalPlacementField.Rotation
      ? number >= 0 && number <= 359
      : number >= -1000 && number <= 1000;
    if (!Number.isFinite(number) || !valid) return;
    setPlacement({ [key]: number });
  };

  return <div className="space-y-4">
    <div><h2 className="text-sm font-semibold">Physical preview</h2><p className="mt-1 text-xs text-muted-foreground">Board and package placement affects previews only.</p></div>
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs">Board width (mm)<Input className="mt-1" type="number" min="20" max="500" value={physical.board.widthMm} onChange={(event) => setBoard(PhysicalBoardField.Width, event.currentTarget.value)}/></label>
      <label className="block text-xs">Board height (mm)<Input className="mt-1" type="number" min="20" max="500" value={physical.board.heightMm} onChange={(event) => setBoard(PhysicalBoardField.Height, event.currentTarget.value)}/></label>
    </div>
    <label className="block text-xs">Thickness (mm)<Input className="mt-1" type="number" min="0.2" max="10" step="0.1" value={physical.board.thicknessMm} onChange={(event) => setBoard(PhysicalBoardField.Thickness, event.currentTarget.value)}/></label>
    {selectedPlacement && <div className="space-y-3 border-t border-border pt-4">
      <label className="block text-xs">Component placement
        <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs" value={selectedComponentId} onChange={(event) => setSelection({ type: "component", id: event.currentTarget.value })}>
          {componentIds.map((componentId) => <option key={componentId} value={componentId}>{design.components[componentId]?.label ?? componentId}</option>)}
        </select>
      </label>
      <label className="block text-xs">Footprint<Input className="mt-1" maxLength={80} value={selectedPlacement.footprint} onChange={(event) => { if (event.currentTarget.value.trim()) setPlacement({ footprint: event.currentTarget.value }); }}/></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">X position (mm)<Input className="mt-1" type="number" value={selectedPlacement.xMm} onChange={(event) => setPlacementNumber(PhysicalPlacementField.X, event.currentTarget.value)}/></label>
        <label className="block text-xs">Y position (mm)<Input className="mt-1" type="number" value={selectedPlacement.yMm} onChange={(event) => setPlacementNumber(PhysicalPlacementField.Y, event.currentTarget.value)}/></label>
      </div>
      <label className="block text-xs">Rotation (degrees)<Input className="mt-1" type="number" min="0" max="359" step="45" value={selectedPlacement.rotationDegrees} onChange={(event) => setPlacementNumber(PhysicalPlacementField.Rotation, event.currentTarget.value)}/></label>
      <label className="block text-xs">Board side
        <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs" value={selectedPlacement.side} onChange={(event) => setPlacement({ side: event.currentTarget.value as PhysicalBoardSide })}>
          <option value={PhysicalBoardSide.Top}>Top</option><option value={PhysicalBoardSide.Bottom}>Bottom</option>
        </select>
      </label>
    </div>}
    <Button variant="outline" className="w-full" onClick={reset}><RotateCcw className="h-4 w-4"/>Reset auto-layout</Button>
  </div>;
}
