import {
  BatteryStandard,
  ComponentKind,
  LedDisplayColor,
  MosfetChannel,
  MosfetMode,
  SpdtPosition,
  type CircuitComponent,
  type CircuitDesign,
  type ComponentProperties
} from "./types";

export function createBlankDesign(id = "blank-project"): CircuitDesign {
  return { schemaVersion: 1, id, name: "Untitled circuit", revision: 0, components: {}, wires: {} };
}

export function createDemoDesign(): CircuitDesign {
  return {
    schemaVersion: 1,
    id: "demo-switched-led",
    name: "Switched status LED",
    revision: 1,
    components: {
      v1: {
        id: "v1", kind: "dc_source", label: "V1", position: { x: 95, y: 230 }, agentLocked: false,
        properties: { kind: "dc_source", voltage: 9, enabled: true }, createdBy: "system", lastModifiedBy: "system"
      },
      sw1: {
        id: "sw1", kind: "switch", label: "SW1", position: { x: 310, y: 125 }, agentLocked: false,
        properties: { kind: "switch", closed: true }, createdBy: "system", lastModifiedBy: "system"
      },
      r1: {
        id: "r1", kind: "resistor", label: "R1", position: { x: 530, y: 125 }, agentLocked: false,
        properties: { kind: "resistor", resistanceOhms: 330, tolerance: 0.05 }, createdBy: "system", lastModifiedBy: "system"
      },
      led1: {
        id: "led1", kind: "led", label: "LED1", position: { x: 750, y: 125 }, agentLocked: false,
        properties: { kind: "led", forwardVoltage: 2, maxCurrentMilliamps: 25, displayColor: LedDisplayColor.Red }, createdBy: "system", lastModifiedBy: "system"
      },
      gnd: {
        id: "gnd", kind: "ground", label: "GND", position: { x: 770, y: 370 }, agentLocked: false,
        properties: { kind: "ground" }, createdBy: "system", lastModifiedBy: "system"
      }
    },
    wires: {
      w1: { id: "w1", a: { componentId: "v1", terminalId: "positive" }, b: { componentId: "sw1", terminalId: "a" }, createdBy: "system" },
      w2: { id: "w2", a: { componentId: "sw1", terminalId: "b" }, b: { componentId: "r1", terminalId: "a" }, createdBy: "system" },
      w3: { id: "w3", a: { componentId: "r1", terminalId: "b" }, b: { componentId: "led1", terminalId: "anode" }, createdBy: "system" },
      w4: { id: "w4", a: { componentId: "led1", terminalId: "cathode" }, b: { componentId: "gnd", terminalId: "g" }, createdBy: "system" },
      w5: { id: "w5", a: { componentId: "gnd", terminalId: "g" }, b: { componentId: "v1", terminalId: "negative" }, createdBy: "system" }
    }
  };
}

export class CircuitFixtures {
  private static component(id: string, label: string, properties: ComponentProperties, index: number): CircuitComponent {
    return {
      id,
      kind: properties.kind,
      label,
      position: { x: 80 + (index % 7) * 150, y: 100 + Math.floor(index / 7) * 140 },
      properties,
      agentLocked: false,
      createdBy: "system",
      lastModifiedBy: "system"
    };
  }

  static createComponentCatalogDesign(): CircuitDesign {
    const components = [
      this.component("catalog-dc-source", "V1", { kind: ComponentKind.DcSource, voltage: 12, enabled: true }, 0),
      this.component("catalog-ground", "GND", { kind: ComponentKind.Ground }, 1),
      this.component("catalog-resistor", "R1", { kind: ComponentKind.Resistor, resistanceOhms: 4700, tolerance: 0.01 }, 2),
      this.component("catalog-led", "LED1", { kind: ComponentKind.Led, forwardVoltage: 2.2, maxCurrentMilliamps: 20, displayColor: LedDisplayColor.Green }, 3),
      this.component("catalog-switch", "SW1", { kind: ComponentKind.Switch, closed: false }, 4),
      this.component("catalog-battery", "B1", { kind: ComponentKind.Battery, voltage: 3.7, capacityMilliampHours: 2500, standard: BatteryStandard.Cell18650 }, 5),
      this.component("catalog-current-source", "I1", { kind: ComponentKind.CurrentSource, currentAmps: 0.015, enabled: true }, 6),
      this.component("catalog-capacitor", "C1", { kind: ComponentKind.Capacitor, capacitanceFarads: 0.00001, polarized: true, voltageRating: 50 }, 7),
      this.component("catalog-inductor", "L1", { kind: ComponentKind.Inductor, inductanceHenries: 0.0022, maxCurrentAmps: 0.5 }, 8),
      this.component("catalog-diode", "D1", { kind: ComponentKind.Diode, forwardVoltage: 0.65 }, 9),
      this.component("catalog-zener", "D2", { kind: ComponentKind.ZenerDiode, zenerVoltage: 12 }, 10),
      this.component("catalog-schottky", "D3", { kind: ComponentKind.SchottkyDiode, forwardVoltage: 0.25 }, 11),
      this.component("catalog-fuse", "F1", { kind: ComponentKind.Fuse, currentRatingAmps: 2, voltageRating: 125 }, 12),
      this.component("catalog-potentiometer", "RV1", { kind: ComponentKind.Potentiometer, resistanceOhms: 50000, wiperPosition: 0.75 }, 13),
      this.component("catalog-push-button", "SW2", { kind: ComponentKind.PushButton, pressed: true }, 14),
      this.component("catalog-spdt", "SW3", { kind: ComponentKind.SpdtSwitch, position: SpdtPosition.B }, 15),
      this.component("catalog-npn", "Q1", { kind: ComponentKind.NpnBjt, beta: 180 }, 16),
      this.component("catalog-pnp", "Q2", { kind: ComponentKind.PnpBjt, beta: 220 }, 17),
      this.component("catalog-n-mosfet", "Q3", { kind: ComponentKind.NChannelMosfet, channel: MosfetChannel.N, mode: MosfetMode.Depletion }, 18),
      this.component("catalog-p-mosfet", "Q4", { kind: ComponentKind.PChannelMosfet, channel: MosfetChannel.P, mode: MosfetMode.Enhancement }, 19),
      this.component("catalog-op-amp", "U1", { kind: ComponentKind.OpAmp, gain: 250000 }, 20)
    ];

    return {
      schemaVersion: 1,
      id: "component-catalog",
      name: "Component catalog",
      revision: 7,
      components: Object.fromEntries(components.map((component) => [component.id, component])),
      wires: {}
    };
  }
}
