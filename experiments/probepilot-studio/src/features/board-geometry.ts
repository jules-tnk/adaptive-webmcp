import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { CircuitComponent, TerminalRef } from "@/domain/types";
import { TscircuitSymbolAdapter } from "@/tscircuit/tscircuit-symbol-adapter";

export const NODE_WIDTH = 148;
export const NODE_HEIGHT = 82;
export const BOARD_WIDTH = 1180;
export const BOARD_HEIGHT = 640;

export function terminalPoint(component: CircuitComponent, terminalId: string): { x: number; y: number } {
  const definition = ComponentDefinitionRegistry.get(component.kind);
  const terminal = definition.terminals.find((item) => item.id === terminalId);
  if (!terminal) return { x: component.position.x + NODE_WIDTH / 2, y: component.position.y + NODE_HEIGHT / 2 };

  const point = TscircuitSymbolAdapter.terminalCoordinate(definition, terminal.id).button;
  return { x: component.position.x + NODE_WIDTH * point.x, y: component.position.y + NODE_HEIGHT * point.y };
}

export function wirePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(44, Math.abs(b.x - a.x) * 0.48);
  const controlA = a.x <= b.x ? a.x + dx : a.x - dx;
  const controlB = a.x <= b.x ? b.x - dx : b.x + dx;
  return `M ${a.x} ${a.y} C ${controlA} ${a.y}, ${controlB} ${b.y}, ${b.x} ${b.y}`;
}

export function refEquals(a: TerminalRef | null, componentId: string, terminalId: string): boolean {
  return Boolean(a && a.componentId === componentId && a.terminalId === terminalId);
}
