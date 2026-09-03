import type { ReactElement } from "react";
import { symbols, type SchSymbol } from "schematic-symbols";
import type { ComponentDefinition } from "@/components/component-definition";
import { TscircuitSymbolName } from "./tscircuit-symbol-name";

type SymbolRenderOptions = {
  readonly active?: boolean;
  readonly className?: string;
  readonly label?: string;
};

export type NormalizedTerminalPoint = {
  readonly x: number;
  readonly y: number;
};

export type TscircuitTerminalCoordinate = {
  readonly terminalId: string;
  readonly symbol: NormalizedTerminalPoint;
  readonly button: NormalizedTerminalPoint;
};

type SymbolBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

enum SymbolColor {
  Primary = "primary",
  Secondary = "secondary",
  Background = "background"
}

enum SymbolTextAnchor {
  TopLeft = "top_left",
  TopRight = "top_right",
  BottomLeft = "bottom_left",
  BottomRight = "bottom_right",
  Center = "center",
  MiddleTop = "middle_top",
  MiddleBottom = "middle_bottom",
  MiddleLeft = "middle_left",
  MiddleRight = "middle_right"
}

enum SvgTextAnchor {
  Start = "start",
  Middle = "middle",
  End = "end"
}

enum SvgDominantBaseline {
  Auto = "auto",
  Middle = "middle",
  Hanging = "hanging",
  TextAfterEdge = "text-after-edge"
}

const symbolsWithRuntimeOpAmp = symbols as Omit<typeof symbols, TscircuitSymbolName.OpAmp> & {
  opamp_with_power_right: SchSymbol | undefined;
};

const DEFAULT_STROKE_WIDTH = 0.02;
const VIEW_BOX_PADDING = 0.04;
const TEXT_WIDTH_FACTOR = 0.6;

export class TscircuitSymbolAdapter {
  static render(symbolName: TscircuitSymbolName, options: SymbolRenderOptions = {}): ReactElement {
    const symbol = this.symbol(symbolName);
    if (!symbol) return this.renderFallback(symbolName, options);
    const active = options.active ?? false;
    const viewBox = this.viewBox(symbol);

    return (
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.maxX - viewBox.minX} ${viewBox.maxY - viewBox.minY}`}
        aria-hidden="true"
        className={options.className ?? "h-9 w-24"}
        data-active={active}
        preserveAspectRatio="xMidYMid meet"
      >
        {symbol.primitives.map((primitive, index) => this.renderPrimitive(symbol, primitive, index, active))}
      </svg>
    );
  }

  static terminalCoordinates(definition: ComponentDefinition): readonly TscircuitTerminalCoordinate[] {
    const symbol = this.requiredSymbol(definition.symbolName);
    const usedPortIndexes = new Set<number>();

    return definition.terminals.map((terminal) => {
      const portIndex = symbol.ports.findIndex((port) => port.labels.includes(terminal.symbolPortAlias));
      if (portIndex < 0) throw new Error(`The schematic symbol ${definition.symbolName} does not expose alias ${terminal.symbolPortAlias} for terminal ${terminal.id}.`);
      if (usedPortIndexes.has(portIndex)) throw new Error(`The schematic symbol ${definition.symbolName} already maps port alias ${terminal.symbolPortAlias}.`);
      usedPortIndexes.add(portIndex);

      const symbolPoint = this.normalizePoint(symbol, symbol.ports[portIndex]!);
      return {
        terminalId: terminal.id,
        symbol: symbolPoint,
        button: symbolPoint
      };
    });
  }

  static terminalCoordinate(definition: ComponentDefinition, terminalId: string): TscircuitTerminalCoordinate {
    const coordinate = this.terminalCoordinates(definition).find((item) => item.terminalId === terminalId);
    if (!coordinate) throw new Error(`Unknown terminal ${terminalId} for ${definition.kind}.`);
    return coordinate;
  }

  static pinNumber(definition: ComponentDefinition, terminalId: string): number {
    const terminal = definition.terminals.find((item) => item.id === terminalId);
    if (!terminal) throw new Error(`Unknown terminal ${terminalId} for ${definition.kind}.`);
    const symbol = this.requiredSymbol(definition.symbolName);
    const port = symbol.ports.find((item) => item.labels.includes(terminal.symbolPortAlias));
    if (!port) throw new Error(`The schematic symbol ${definition.symbolName} does not expose alias ${terminal.symbolPortAlias} for terminal ${terminal.id}.`);
    const numericAlias = port.labels.find((label) => /^\d+$/.test(label));
    if (!numericAlias) throw new Error(`The schematic symbol ${definition.symbolName} does not expose a numeric pin alias for terminal ${terminal.id}.`);
    return Number(numericAlias);
  }

  static portAliases(definition: ComponentDefinition): readonly (readonly string[])[] {
    return this.requiredSymbol(definition.symbolName).ports.map((port) => [...port.labels]);
  }

  private static symbol(symbolName: TscircuitSymbolName): SchSymbol | null {
    if (symbolName === TscircuitSymbolName.DcVoltmeter) return symbols.dc_voltmeter_right ?? null;
    if (symbolName === TscircuitSymbolName.Ground) return symbols.ground_down ?? null;
    if (symbolName === TscircuitSymbolName.Resistor) return symbols.resistor_right ?? null;
    if (symbolName === TscircuitSymbolName.Led) return symbols.led_right ?? null;
    if (symbolName === TscircuitSymbolName.SpstSwitch) return symbols.spst_switch_right ?? null;
    if (symbolName === TscircuitSymbolName.Battery) return symbols.battery_right ?? null;
    if (symbolName === TscircuitSymbolName.CurrentSource) return symbols.current_source_right ?? null;
    if (symbolName === TscircuitSymbolName.Capacitor) return symbols.capacitor_right ?? null;
    if (symbolName === TscircuitSymbolName.Inductor) return symbols.inductor_right ?? null;
    if (symbolName === TscircuitSymbolName.Diode) return symbols.diode_right ?? null;
    if (symbolName === TscircuitSymbolName.ZenerDiode) return symbols.zener_diode_horz ?? null;
    if (symbolName === TscircuitSymbolName.SchottkyDiode) return symbols.schottky_diode_right ?? null;
    if (symbolName === TscircuitSymbolName.Fuse) return symbols.fuse_horz ?? null;
    if (symbolName === TscircuitSymbolName.Potentiometer) return symbols.potentiometer3_right ?? null;
    if (symbolName === TscircuitSymbolName.PushButton) return symbols.push_button_normally_open_momentary_right ?? null;
    if (symbolName === TscircuitSymbolName.SpdtSwitch) return symbols.spdt_switch_right ?? null;
    if (symbolName === TscircuitSymbolName.NpnBjt) return symbols.npn_bipolar_transistor_right ?? null;
    if (symbolName === TscircuitSymbolName.PnpBjt) return symbols.pnp_bipolar_transistor_right ?? null;
    if (symbolName === TscircuitSymbolName.NChannelMosfet) return symbols.n_channel_e_mosfet_transistor_horz ?? null;
    if (symbolName === TscircuitSymbolName.PChannelMosfet) return symbols.p_channel_e_mosfet_transistor_horz ?? null;
    if (symbolName === TscircuitSymbolName.OpAmp) return symbolsWithRuntimeOpAmp.opamp_with_power_right ?? null;
    return null;
  }

  private static requiredSymbol(symbolName: TscircuitSymbolName): SchSymbol {
    const symbol = this.symbol(symbolName);
    if (!symbol) throw new Error(`The schematic symbol ${symbolName} is unavailable at runtime.`);
    return symbol;
  }

  private static renderFallback(symbolName: TscircuitSymbolName, options: SymbolRenderOptions): ReactElement {
    if (import.meta.env.DEV) console.error(`ProbePilot could not resolve schematic symbol ${symbolName}; rendering the generic fallback.`);
    return (
      <svg
        viewBox="0 0 1.6 0.8"
        aria-hidden="true"
        className={options.className ?? "h-9 w-24"}
        data-active={options.active ?? false}
        data-symbol-fallback="true"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0.04" y="0.04" width="1.52" height="0.72" rx="0.08" fill="none" stroke="hsl(var(--symbol-stroke))" strokeWidth="0.04" />
        <text x="0.8" y="0.4" fill="hsl(var(--symbol-stroke))" fontSize="0.16" textAnchor="middle" dominantBaseline="middle">
          {options.label ?? String(symbolName)}
        </text>
      </svg>
    );
  }

  private static viewBox(symbol: SchSymbol): SymbolBounds {
    let bounds: SymbolBounds = { minX: 0, minY: 0, maxX: symbol.size.width, maxY: symbol.size.height };

    for (const primitive of symbol.primitives) {
      if (primitive.type === "path") {
        const strokeRadius = (primitive.strokeWidth ?? DEFAULT_STROKE_WIDTH) / 2;
        for (const sourcePoint of primitive.points) {
          const point = this.svgPoint(symbol, sourcePoint);
          bounds = this.expandBounds(bounds, point.x - strokeRadius, point.y - strokeRadius, point.x + strokeRadius, point.y + strokeRadius);
        }
        continue;
      }

      if (primitive.type === "circle") {
        const point = this.svgPoint(symbol, primitive);
        const radius = primitive.radius + DEFAULT_STROKE_WIDTH / 2;
        bounds = this.expandBounds(bounds, point.x - radius, point.y - radius, point.x + radius, point.y + radius);
        continue;
      }

      if (primitive.type === "box") {
        const point = this.svgPoint(symbol, primitive);
        const strokeRadius = DEFAULT_STROKE_WIDTH / 2;
        bounds = this.expandBounds(bounds, point.x - primitive.width / 2 - strokeRadius, point.y - primitive.height / 2 - strokeRadius, point.x + primitive.width / 2 + strokeRadius, point.y + primitive.height / 2 + strokeRadius);
        continue;
      }

      const point = this.svgPoint(symbol, primitive);
      const fontSize = primitive.fontSize ?? 0.1;
      const halfWidth = primitive.text.length * fontSize * TEXT_WIDTH_FACTOR;
      bounds = this.expandBounds(bounds, point.x - halfWidth, point.y - fontSize, point.x + halfWidth, point.y + fontSize);
    }

    return this.expandBounds(bounds, bounds.minX - VIEW_BOX_PADDING, bounds.minY - VIEW_BOX_PADDING, bounds.maxX + VIEW_BOX_PADDING, bounds.maxY + VIEW_BOX_PADDING);
  }

  private static expandBounds(bounds: SymbolBounds, minX: number, minY: number, maxX: number, maxY: number): SymbolBounds {
    return {
      minX: Math.min(bounds.minX, minX),
      minY: Math.min(bounds.minY, minY),
      maxX: Math.max(bounds.maxX, maxX),
      maxY: Math.max(bounds.maxY, maxY)
    };
  }

  private static normalizePoint(symbol: SchSymbol, point: { readonly x: number; readonly y: number }): NormalizedTerminalPoint {
    return {
      x: (point.x - (symbol.center.x - symbol.size.width / 2)) / symbol.size.width,
      y: ((symbol.center.y + symbol.size.height / 2) - point.y) / symbol.size.height
    };
  }

  private static renderPrimitive(symbol: SchSymbol, primitive: SchSymbol["primitives"][number], index: number, active: boolean): ReactElement {
    if (primitive.type === "path") {
      const color = this.colorFor(primitive.color, active);
      const points = primitive.points.map((point) => this.svgPoint(symbol, point));
      const d = points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      return <path key={index} d={primitive.closed ? `${d} Z` : d} fill={primitive.fill ? color : "none"} stroke={color} strokeWidth={primitive.strokeWidth ?? 0.02} strokeLinecap="round" strokeLinejoin="round" />;
    }

    if (primitive.type === "circle") {
      const color = this.colorFor(primitive.color, active);
      const point = this.svgPoint(symbol, primitive);
      return <circle key={index} cx={point.x} cy={point.y} r={primitive.radius} fill={primitive.fill ? color : "none"} stroke={color} strokeWidth={0.02} />;
    }

    if (primitive.type === "box") {
      const color = this.colorFor(SymbolColor.Primary, active);
      const point = this.svgPoint(symbol, primitive);
      return <rect key={index} x={point.x - primitive.width / 2} y={point.y - primitive.height / 2} width={primitive.width} height={primitive.height} fill="none" stroke={color} strokeWidth={0.02} />;
    }

    const point = this.svgPoint(symbol, primitive);
    const alignment = this.textAlignment(primitive.anchor);
    return <text key={index} x={point.x} y={point.y} fill={this.colorFor(SymbolColor.Primary, active)} fontSize={primitive.fontSize ?? 0.1} textAnchor={alignment.textAnchor} dominantBaseline={alignment.dominantBaseline}>{primitive.text}</text>;
  }

  private static svgPoint(symbol: SchSymbol, point: { readonly x: number; readonly y: number }): NormalizedTerminalPoint {
    return {
      x: point.x - (symbol.center.x - symbol.size.width / 2),
      y: (symbol.center.y + symbol.size.height / 2) - point.y
    };
  }

  private static colorFor(color: string, active: boolean): string {
    if (active && color !== SymbolColor.Background) return "hsl(var(--primary))";
    if (color === SymbolColor.Secondary) return "hsl(var(--muted-foreground))";
    if (color === SymbolColor.Background) return "hsl(var(--background))";
    return "hsl(var(--symbol-stroke))";
  }

  private static textAlignment(anchor: string): { readonly textAnchor: SvgTextAnchor; readonly dominantBaseline: SvgDominantBaseline } {
    if (anchor === SymbolTextAnchor.TopLeft) return { textAnchor: SvgTextAnchor.Start, dominantBaseline: SvgDominantBaseline.Hanging };
    if (anchor === SymbolTextAnchor.TopRight) return { textAnchor: SvgTextAnchor.End, dominantBaseline: SvgDominantBaseline.Hanging };
    if (anchor === SymbolTextAnchor.BottomLeft) return { textAnchor: SvgTextAnchor.Start, dominantBaseline: SvgDominantBaseline.TextAfterEdge };
    if (anchor === SymbolTextAnchor.BottomRight) return { textAnchor: SvgTextAnchor.End, dominantBaseline: SvgDominantBaseline.TextAfterEdge };
    if (anchor === SymbolTextAnchor.Center) return { textAnchor: SvgTextAnchor.Middle, dominantBaseline: SvgDominantBaseline.Middle };
    if (anchor === SymbolTextAnchor.MiddleTop) return { textAnchor: SvgTextAnchor.Middle, dominantBaseline: SvgDominantBaseline.Hanging };
    if (anchor === SymbolTextAnchor.MiddleBottom) return { textAnchor: SvgTextAnchor.Middle, dominantBaseline: SvgDominantBaseline.TextAfterEdge };
    if (anchor === SymbolTextAnchor.MiddleLeft) return { textAnchor: SvgTextAnchor.Start, dominantBaseline: SvgDominantBaseline.Middle };
    if (anchor === SymbolTextAnchor.MiddleRight) return { textAnchor: SvgTextAnchor.End, dominantBaseline: SvgDominantBaseline.Middle };
    return { textAnchor: SvgTextAnchor.Start, dominantBaseline: SvgDominantBaseline.Auto };
  }
}
