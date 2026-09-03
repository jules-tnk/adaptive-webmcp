import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import type { ComponentDefinition } from "@/components/component-definition";
import { createComponent } from "@/domain/catalog";
import { NODE_HEIGHT, NODE_WIDTH, terminalPoint } from "@/features/board-geometry";
import { ThemeMode } from "@/theme/theme";
import { TscircuitSymbolAdapter } from "./tscircuit-symbol-adapter";

const snapshotDefinitions = [
  ComponentDefinitionRegistry.get("resistor"),
  ComponentDefinitionRegistry.get("capacitor"),
  ComponentDefinitionRegistry.get("diode"),
  ComponentDefinitionRegistry.get("npn_bjt"),
  ComponentDefinitionRegistry.get("n_channel_mosfet"),
  ComponentDefinitionRegistry.get("op_amp"),
  ComponentDefinitionRegistry.get("switch"),
  ComponentDefinitionRegistry.get("ground")
] as const;

const themes = [ThemeMode.Light, ThemeMode.Dark] as const;
const activityStates = [false, true] as const;

function renderSymbol(definition: ComponentDefinition, theme: ThemeMode, active: boolean) {
  return render(
    <div className={theme === ThemeMode.Dark ? ThemeMode.Dark : undefined}>
      {TscircuitSymbolAdapter.render(definition.symbolName, { active })}
    </div>
  );
}

describe("TscircuitSymbolAdapter", () => {
  it.each(snapshotDefinitions.flatMap((definition) => themes.flatMap((theme) => activityStates.map((active) => ({ definition, theme, active })))))
    ("renders $definition.name in $theme mode while active is $active", ({ definition, theme, active }) => {
      const { container } = renderSymbol(definition, theme, active);

      expect(container.firstChild).toMatchSnapshot();
    });

  it("maps every registry terminal to one accessible board coordinate", () => {
    for (const definition of ComponentDefinitionRegistry.list()) {
      const coordinates = TscircuitSymbolAdapter.terminalCoordinates(definition);

      expect(coordinates.map((coordinate) => coordinate.terminalId)).toEqual(definition.terminals.map((terminal) => terminal.id));
      expect(new Set(coordinates.map((coordinate) => coordinate.terminalId)).size).toBe(definition.terminals.length);
      expect(coordinates.every((coordinate) => coordinate.symbol !== null)).toBe(true);
      expect(coordinates.every((coordinate) => Number.isFinite(coordinate.button.x) && Number.isFinite(coordinate.button.y))).toBe(true);
    }
  });

  it("keeps all 50 terminal identities on their exact normalized symbol-port coordinates", () => {
    let terminalCount = 0;

    for (const definition of ComponentDefinitionRegistry.list()) {
      const coordinates = TscircuitSymbolAdapter.terminalCoordinates(definition);
      terminalCount += coordinates.length;

      expect(coordinates.map((coordinate) => coordinate.terminalId)).toEqual(
        definition.terminals.map((terminal) => terminal.id)
      );
      for (const coordinate of coordinates) expect(coordinate.button).toEqual(coordinate.symbol);
    }

    expect(terminalCount).toBe(50);
  });

  it("renders a labelled generic fallback and reports a development diagnostic when a symbol is missing", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const missingSymbol = "missing_probe_pilot_symbol" as ComponentDefinition["symbolName"];

    try {
      const { container } = render(
        TscircuitSymbolAdapter.render(missingSymbol, { label: "Unavailable op-amp symbol" })
      );

      expect(container).toHaveTextContent("Unavailable op-amp symbol");
      expect(container.querySelector('[data-symbol-fallback="true"]')).toBeInTheDocument();
      expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("missing_probe_pilot_symbol"));
    } finally {
      consoleError.mockRestore();
    }
  });

  it("declares explicit semantic aliases for the potentiometer, op-amp, and SPDT ports", () => {
    expect(ComponentDefinitionRegistry.get("potentiometer").symbolName).toBe("potentiometer3_right");
    expect(ComponentDefinitionRegistry.get("potentiometer").terminals.map((terminal) => terminal.symbolPortAlias)).toEqual(["1", "2", "3"]);
    expect(ComponentDefinitionRegistry.get("op_amp").terminals.map((terminal) => terminal.symbolPortAlias)).toEqual(["inp2", "inp1", "out", "V+", "V-"]);
    expect(ComponentDefinitionRegistry.get("spdt_switch").terminals.map((terminal) => terminal.symbolPortAlias)).toEqual(["1", "2", "3"]);
  });

  it("rejects unresolved or duplicate symbol-port aliases", () => {
    const resistor = ComponentDefinitionRegistry.get("resistor");
    const firstTerminal = resistor.terminals[0]!;
    const secondTerminal = resistor.terminals[1]!;
    const unresolved: ComponentDefinition = {
      ...resistor,
      terminals: [{ ...firstTerminal, symbolPortAlias: "missing" }, secondTerminal]
    };
    const duplicate: ComponentDefinition = {
      ...resistor,
      terminals: [{ ...firstTerminal, symbolPortAlias: "1" }, { ...secondTerminal, symbolPortAlias: "1" }]
    };

    expect(() => TscircuitSymbolAdapter.terminalCoordinates(unresolved)).toThrow(/missing/);
    expect(() => TscircuitSymbolAdapter.terminalCoordinates(duplicate)).toThrow(/already maps/);
  });

  it("pads rendered viewBoxes beyond raw primitive and text bounds", () => {
    const { container } = renderSymbol(ComponentDefinitionRegistry.get("resistor"), ThemeMode.Light, false);
    const viewBox = container.querySelector("svg")?.getAttribute("viewBox")?.split(" ").map(Number);

    expect(viewBox).toHaveLength(4);
    expect(viewBox?.[0]).toBeLessThan(0);
    expect(viewBox?.[1]).toBeLessThan(0);
    expect(viewBox?.[2]).toBeGreaterThan(0.94);
    expect(viewBox?.[3]).toBeGreaterThan(0.399910699999999);
  });

  it("keeps the five runtime op-amp ports available through the local adapter contract", () => {
    const coordinates = TscircuitSymbolAdapter.terminalCoordinates(ComponentDefinitionRegistry.get("op_amp"));

    expect(coordinates).toHaveLength(5);
    expect(coordinates.every((coordinate) => coordinate.symbol !== null)).toBe(true);
  });

  it("uses the adapter button coordinates for every board terminal", () => {
    for (const definition of ComponentDefinitionRegistry.list()) {
      const component = createComponent(definition.kind, `${definition.kind}-1`, { x: 24, y: 36 }, "human", {});

      for (const coordinate of TscircuitSymbolAdapter.terminalCoordinates(definition)) {
        expect(terminalPoint(component, coordinate.terminalId)).toEqual({
          x: component.position.x + NODE_WIDTH * coordinate.button.x,
          y: component.position.y + NODE_HEIGHT * coordinate.button.y
        });
      }
    }
  });
});
