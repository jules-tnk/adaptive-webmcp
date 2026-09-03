import type { CircuitComponent } from "@/domain/types";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { TscircuitSymbolAdapter } from "@/tscircuit/tscircuit-symbol-adapter";

export function ComponentSymbol({ component, active = false }: { component: CircuitComponent; active?: boolean }) {
  return TscircuitSymbolAdapter.render(ComponentDefinitionRegistry.get(component.kind).symbolName, { active });
}
