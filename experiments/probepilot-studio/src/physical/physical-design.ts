export enum PhysicalPlacementMode { Automatic = "automatic", Manual = "manual" }
export enum PhysicalBoardSide { Top = "top", Bottom = "bottom" }
export enum WorkspaceView { Circuit = "circuit", Pcb = "pcb", ThreeD = "3d" }

export interface PhysicalPlacement {
  readonly xMm: number;
  readonly yMm: number;
  readonly rotationDegrees: number;
  readonly side: PhysicalBoardSide;
  readonly footprint: string;
}

export interface PhysicalDesign {
  readonly board: { readonly widthMm: number; readonly heightMm: number; readonly thicknessMm: number };
  readonly placements: Readonly<Record<string, PhysicalPlacement>>;
  readonly placementMode: PhysicalPlacementMode;
}
