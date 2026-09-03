import { useEffect, useMemo, useRef, useState } from "react";
import { LockKeyhole, Minus, Plus, Scan, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyFieldDefinitions, PropertyUnit } from "@/components/property-field-definition";
import { componentCatalog } from "@/domain/catalog";
import type { CircuitComponent, ComponentKindValue, Point, TerminalRef } from "@/domain/types";
import { useStudioStore, type Selection } from "@/state/store";
import { BOARD_HEIGHT, BOARD_WIDTH, NODE_HEIGHT, NODE_WIDTH, refEquals, terminalPoint, wirePath } from "./board-geometry";
import { ComponentSymbol } from "./component-symbol";
import { cn } from "@/lib/utils";

type DragState = { id: string; label: string; startClient: Point; origin: Point; current: Point };

enum BoardKeyboardKey {
  Enter = "Enter",
  Space = " ",
  Delete = "Delete",
  Backspace = "Backspace",
  Escape = "Escape"
}

function positionChanged(a: Point, b: Point): boolean {
  return a.x !== b.x || a.y !== b.y;
}

function componentValue(component: CircuitComponent): string {
  const props = component.properties;
  switch (props.kind) {
    case "dc_source": return PropertyFieldDefinitions.normalizedSummary(props.voltage, PropertyUnit.Volts);
    case "ground": return "Ground";
    case "resistor": return PropertyFieldDefinitions.normalizedSummary(props.resistanceOhms, PropertyUnit.Ohms);
    case "led": return PropertyFieldDefinitions.normalizedSummary(props.forwardVoltage, PropertyUnit.Volts);
    case "switch": return props.closed ? "Closed" : "Open";
    case "battery": return PropertyFieldDefinitions.normalizedSummary(props.voltage, PropertyUnit.Volts);
    case "current_source": return PropertyFieldDefinitions.normalizedSummary(props.currentAmps, PropertyUnit.Amperes);
    case "capacitor": return PropertyFieldDefinitions.normalizedSummary(props.capacitanceFarads, PropertyUnit.Farads);
    case "inductor": return PropertyFieldDefinitions.normalizedSummary(props.inductanceHenries, PropertyUnit.Henries);
    case "diode": return PropertyFieldDefinitions.normalizedSummary(props.forwardVoltage, PropertyUnit.Volts);
    case "zener_diode": return PropertyFieldDefinitions.normalizedSummary(props.zenerVoltage, PropertyUnit.Volts);
    case "schottky_diode": return PropertyFieldDefinitions.normalizedSummary(props.forwardVoltage, PropertyUnit.Volts);
    case "fuse": return PropertyFieldDefinitions.normalizedSummary(props.currentRatingAmps, PropertyUnit.Amperes);
    case "potentiometer": return PropertyFieldDefinitions.normalizedSummary(props.resistanceOhms, PropertyUnit.Ohms);
    case "push_button": return props.pressed ? "Pressed" : "Released";
    case "spdt_switch": return `Path ${props.position.toUpperCase()}`;
    case "npn_bjt":
    case "pnp_bjt": return `β ${PropertyFieldDefinitions.normalizedSummary(props.beta)}`;
    case "n_channel_mosfet":
    case "p_channel_mosfet": return props.mode === "enhancement" ? "Enhancement" : "Depletion";
    case "op_amp": return `Gain ${PropertyFieldDefinitions.normalizedSummary(props.gain)}`;
  }
}

export function CircuitBoard() {
  const design = useStudioStore((state) => state.design);
  const mode = useStudioStore((state) => state.mode);
  const simulation = useStudioStore((state) => state.simulation);
  const bench = useStudioStore((state) => state.bench);
  const selection = useStudioStore((state) => state.selection);
  const wireDraft = useStudioStore((state) => state.wireDraft);
  const zoom = useStudioStore((state) => state.zoom);
  const setSelection = useStudioStore((state) => state.setSelection);
  const setWireDraft = useStudioStore((state) => state.setWireDraft);
  const setZoom = useStudioStore((state) => state.setZoom);
  const connect = useStudioStore((state) => state.connectTerminals);
  const update = useStudioStore((state) => state.updateComponent);
  const add = useStudioStore((state) => state.addComponent);
  const remove = useStudioStore((state) => state.removeElements);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (!drag) return;
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const next = {
        ...current,
        current: {
          x: Math.max(20, Math.min(BOARD_WIDTH - NODE_WIDTH - 20, current.origin.x + (event.clientX - current.startClient.x) / zoom)),
          y: Math.max(20, Math.min(BOARD_HEIGHT - NODE_HEIGHT - 20, current.origin.y + (event.clientY - current.startClient.y) / zoom))
        }
      };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (current && positionChanged(current.origin, current.current)) {
        update(current.id, { position: current.current }, { actor: "human", activityLabel: `Human moved ${current.label}.` });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag?.id, update, zoom]);

  const positioned = useMemo(() => {
    if (!drag) return design.components;
    return { ...design.components, [drag.id]: { ...design.components[drag.id]!, position: drag.current } };
  }, [design.components, drag]);

  const activeCurrent = simulation && simulation.status !== "fail" && Object.values(simulation.branchCurrents).some((value) => value > 0);
  const pendingPoints = new Set(bench?.pendingMeasurement ? [bench.pendingMeasurement.firstTestPointId, bench.pendingMeasurement.secondTestPointId] : []);

  const handleTerminal = (ref: TerminalRef) => {
    if (mode !== "design") return;
    if (!wireDraft) {
      setWireDraft(ref);
      return;
    }
    if (refEquals(wireDraft, ref.componentId, ref.terminalId)) {
      setWireDraft(null);
      return;
    }
    const result = connect(wireDraft, ref, { actor: "human" });
    if (result.ok) setWireDraft(null);
  };

  const handleSelectableKey = (event: React.KeyboardEvent<Element>, nextSelection: Exclude<Selection, null>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === BoardKeyboardKey.Enter || event.key === BoardKeyboardKey.Space) {
      event.preventDefault();
      event.stopPropagation();
      setSelection(nextSelection);
      return;
    }
    if ((event.key === BoardKeyboardKey.Delete || event.key === BoardKeyboardKey.Backspace) && mode === "design") {
      event.preventDefault();
      event.stopPropagation();
      const result = remove(nextSelection.type === "component" ? [nextSelection.id] : [], nextSelection.type === "wire" ? [nextSelection.id] : [], { actor: "human" });
      if (result.ok) setSelection(null);
    }
  };

  const boardPointFromDrop = (event: React.DragEvent): Point => {
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    const x = ((event.clientX - (rect?.left ?? 0)) + (viewport?.scrollLeft ?? 0)) / zoom - NODE_WIDTH / 2;
    const y = ((event.clientY - (rect?.top ?? 0)) + (viewport?.scrollTop ?? 0)) / zoom - NODE_HEIGHT / 2;
    return { x: Math.max(20, Math.min(BOARD_WIDTH - NODE_WIDTH - 20, x)), y: Math.max(20, Math.min(BOARD_HEIGHT - NODE_HEIGHT - 20, y)) };
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
      <div className="absolute left-3 top-3 z-30 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-lg backdrop-blur">
        <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom(zoom - 0.1)}><Minus className="h-4 w-4" /></Button>
        <span className="mono w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom(zoom + 0.1)}><Plus className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Reset zoom" onClick={() => setZoom(1)}><Scan className="h-4 w-4" /></Button>
      </div>

      {wireDraft && mode === "design" && (
        <div className="absolute right-3 top-3 z-30 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Select a second terminal to create the wire. Press Escape to cancel.
        </div>
      )}

      <div
        ref={viewportRef}
        className="board-grid h-full w-full overflow-auto"
        onClick={() => { setSelection(null); setWireDraft(null); }}
        onDragOver={(event) => { if (mode === "design") event.preventDefault(); }}
        onDrop={(event) => {
          if (mode !== "design") return;
          event.preventDefault();
          const kind = event.dataTransfer.getData("application/x-probepilot-component") as ComponentKindValue;
          if (kind && kind in componentCatalog) add(kind, boardPointFromDrop(event), { actor: "human" });
        }}
        onKeyDown={(event) => {
          if (event.key === BoardKeyboardKey.Escape) { setWireDraft(null); setSelection(null); }
          if ((event.key === BoardKeyboardKey.Delete || event.key === BoardKeyboardKey.Backspace) && selection && mode === "design") {
            remove(selection.type === "component" ? [selection.id] : [], selection.type === "wire" ? [selection.id] : [], { actor: "human" });
          }
        }}
        tabIndex={0}
        aria-label="Circuit design board"
      >
        <div style={{ width: BOARD_WIDTH * zoom, height: BOARD_HEIGHT * zoom }}>
          <div className="relative origin-top-left" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${zoom})` }}>
            {Object.keys(design.components).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="max-w-md rounded-xl border border-dashed border-border bg-card/70 p-8 text-center shadow-xl">
                  <p className="text-lg font-semibold">Start a circuit</p>
                  <p className="mt-2 text-sm text-muted-foreground">Drop a component here, or ask the agent to build a 9 V switched LED circuit.</p>
                </div>
              </div>
            )}

            <svg className="absolute inset-0 z-0 h-full w-full overflow-visible" aria-label="Circuit wires">
              {Object.values(design.wires).map((wire) => {
                const componentA = positioned[wire.a.componentId];
                const componentB = positioned[wire.b.componentId];
                if (!componentA || !componentB) return null;
                const terminalA = componentCatalog[componentA.kind].terminals.find((terminal) => terminal.id === wire.a.terminalId);
                const terminalB = componentCatalog[componentB.kind].terminals.find((terminal) => terminal.id === wire.b.terminalId);
                const selected = selection?.type === "wire" && selection.id === wire.id;
                return (
                  <path
                    key={wire.id}
                    d={wirePath(terminalPoint(componentA, wire.a.terminalId), terminalPoint(componentB, wire.b.terminalId))}
                    className={cn("wire-path", selected && "selected", mode === "simulate" && activeCurrent && "energized", mode === "bench" && bench?.verification?.result === "pass" && "energized")}
                    onClick={(event) => { event.stopPropagation(); setSelection({ type: "wire", id: wire.id }); }}
                    onKeyDown={(event) => handleSelectableKey(event, { type: "wire", id: wire.id })}
                    role="button"
                    tabIndex={0}
                    focusable="true"
                    aria-pressed={selected}
                    aria-label={`Wire ${wire.id}, ${componentA.label} terminal ${terminalA?.label ?? wire.a.terminalId} to ${componentB.label} terminal ${terminalB?.label ?? wire.b.terminalId}`}
                  />
                );
              })}
            </svg>

            {Object.values(positioned).map((component) => {
              const selected = selection?.type === "component" && selection.id === component.id;
              const simulatedState = simulation?.components[component.id]?.state;
              const benchOutput = bench?.verification?.actualOutputs.find((output) => output.componentId === component.id)?.expectedState;
              const benchAffected = bench?.symptoms.some((symptom) => symptom.affectedComponentIds.includes(component.id));
              const active = component.kind === "led" && (mode === "simulate" ? simulatedState === "on" : mode === "bench" ? (benchOutput ? benchOutput === "on" : !benchAffected) : false);
              return (
                <div
                  key={component.id}
                  className={cn("circuit-node z-10", selected && "selected", component.agentLocked && "agent-locked", mode === "bench" && "cursor-default")}
                  style={{ left: component.position.x, top: component.position.y }}
                >
                  <button
                    type="button"
                    tabIndex={0}
                    className="absolute inset-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={(event) => { event.stopPropagation(); setSelection({ type: "component", id: component.id }); }}
                    onPointerDown={(event) => {
                      if (mode !== "design") return;
                      event.stopPropagation();
                      setSelection({ type: "component", id: component.id });
                      const nextDrag = { id: component.id, label: component.label, startClient: { x: event.clientX, y: event.clientY }, origin: component.position, current: component.position };
                      dragRef.current = nextDrag;
                      setDrag(nextDrag);
                    }}
                    onKeyDown={(event) => handleSelectableKey(event, { type: "component", id: component.id })}
                    aria-pressed={selected}
                    aria-label={`${component.label}, ${componentCatalog[component.kind].name}, ${componentValue(component)}`}
                  >
                    <span className="flex h-7 items-center justify-between border-b border-border/80 px-2">
                      <span className="mono text-[11px] font-bold tracking-wide">{component.label}</span>
                      <span className="mono flex items-center gap-1 text-[10px] text-muted-foreground">{component.agentLocked && <LockKeyhole className="h-3 w-3 text-amber-300" />}{componentValue(component)}</span>
                    </span>
                    <span className="flex h-[54px] items-center justify-center"><ComponentSymbol component={component} active={active} /></span>
                  </button>
                  {componentCatalog[component.kind].terminals.map((terminal) => {
                    const point = terminalPoint({ ...component, position: { x: 0, y: 0 } }, terminal.id);
                    const testId = `${component.id}:${terminal.id}`;
                    return (
                      <button
                        key={terminal.id}
                        type="button"
                        className={cn("terminal", refEquals(wireDraft, component.id, terminal.id) && "draft", pendingPoints.has(testId) && "pending")}
                        style={{ left: point.x, top: point.y }}
                        onClick={(event) => { event.stopPropagation(); handleTerminal({ componentId: component.id, terminalId: terminal.id }); }}
                        aria-label={`${component.label} terminal ${terminal.label}`}
                        title={`${component.label} · ${terminal.label}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selection && mode === "design" && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute bottom-3 right-3 z-30"
          aria-label="Delete selected element"
          onClick={() => remove(selection.type === "component" ? [selection.id] : [], selection.type === "wire" ? [selection.id] : [], { actor: "human" })}
        ><Trash2 className="h-4 w-4" /></Button>
      )}
    </div>
  );
}
