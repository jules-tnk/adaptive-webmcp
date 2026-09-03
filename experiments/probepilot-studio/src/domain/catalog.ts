import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { TerminalDefinition } from "@/components/component-definition";
import type { Actor, CircuitComponent, ComponentKindValue, ComponentProperties, Point } from "./types";

export type { TerminalDefinition } from "@/components/component-definition";

export type CatalogEntry = {
  kind: ComponentKindValue;
  name: string;
  prefix: string;
  description: string;
  terminals: readonly TerminalDefinition[];
  defaultProperties: ComponentProperties;
};

export type ComponentPropertyPatch = Partial<ComponentProperties> | Record<string, string | number | boolean>;

export const componentCatalog: Record<ComponentKindValue, CatalogEntry> = Object.fromEntries(
  ComponentDefinitionRegistry.list().map((definition) => [definition.kind, {
    kind: definition.kind,
    name: definition.name,
    prefix: definition.prefix,
    description: definition.description,
    terminals: definition.terminals,
    defaultProperties: definition.defaultProperties
  }])
) as Record<ComponentKindValue, CatalogEntry>;

export function mergeComponentProperties(
  kind: ComponentKindValue,
  current: ComponentProperties,
  patch?: ComponentPropertyPatch
): ComponentProperties {
  if (!patch) return current;
  return ComponentDefinitionRegistry.get(kind).propertySchema.parse({ ...current, ...patch, kind });
}

export function terminalExists(component: CircuitComponent, terminalId: string): boolean {
  return componentCatalog[component.kind].terminals.some((item) => item.id === terminalId);
}

export function nextLabel(kind: ComponentKindValue, components: Record<string, CircuitComponent>): string {
  const prefix = componentCatalog[kind].prefix;
  if (kind === "ground") return "GND";
  let index = 1;
  const labels = new Set(Object.values(components).map((component) => component.label));
  while (labels.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function createComponent(
  kind: ComponentKindValue,
  id: string,
  position: Point,
  actor: Actor,
  existing: Record<string, CircuitComponent>,
  patch?: Partial<ComponentProperties>,
  label?: string
): CircuitComponent {
  const defaults = componentCatalog[kind].defaultProperties;
  const properties = mergeComponentProperties(kind, defaults, patch);
  return {
    id,
    kind,
    label: label ?? nextLabel(kind, existing),
    position,
    properties,
    agentLocked: false,
    createdBy: actor,
    lastModifiedBy: actor
  };
}

export function testPointId(componentId: string, terminalId: string): string {
  return `${componentId}:${terminalId}`;
}

export function parseTestPointId(id: string): { componentId: string; terminalId: string } | null {
  const delimiter = id.indexOf(":");
  if (delimiter < 1 || delimiter === id.length - 1) return null;
  return { componentId: id.slice(0, delimiter), terminalId: id.slice(delimiter + 1) };
}
