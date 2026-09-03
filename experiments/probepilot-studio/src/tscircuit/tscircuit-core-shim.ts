import type { ReactNode } from "react";
import type { AnyCircuitElement } from "circuit-json";

export class Circuit {
  add(_children: ReactNode): void {
    throw new Error("ProbePilot supplies Circuit JSON directly; CadViewer JSX children are unsupported.");
  }

  render(): void {
    throw new Error("ProbePilot supplies Circuit JSON directly; CadViewer JSX children are unsupported.");
  }

  getCircuitJson(): AnyCircuitElement[] {
    return [];
  }
}
