export type Actor = "human" | "agent" | "system";
export type StudioMode = "design" | "simulate" | "bench";
export enum TerminalSide {
  Left = "left",
  Right = "right",
  Top = "top",
  Bottom = "bottom"
}
export enum LedDisplayColor {
  Red = "red",
  Amber = "amber",
  Green = "green",
  Blue = "blue"
}
export enum BatteryStandard {
  Aa = "AA",
  Aaa = "AAA",
  NineVolt = "9V",
  Cr2032 = "CR2032",
  Cell18650 = "18650",
  C = "C"
}
export enum SpdtPosition {
  A = "a",
  B = "b"
}
export enum MosfetChannel {
  N = "n",
  P = "p"
}
export enum MosfetMode {
  Enhancement = "enhancement",
  Depletion = "depletion"
}
export enum ComponentKind {
  DcSource = "dc_source",
  Ground = "ground",
  Resistor = "resistor",
  Led = "led",
  Switch = "switch",
  Battery = "battery",
  CurrentSource = "current_source",
  Capacitor = "capacitor",
  Inductor = "inductor",
  Diode = "diode",
  ZenerDiode = "zener_diode",
  SchottkyDiode = "schottky_diode",
  Fuse = "fuse",
  Potentiometer = "potentiometer",
  PushButton = "push_button",
  SpdtSwitch = "spdt_switch",
  NpnBjt = "npn_bjt",
  PnpBjt = "pnp_bjt",
  NChannelMosfet = "n_channel_mosfet",
  PChannelMosfet = "p_channel_mosfet",
  OpAmp = "op_amp"
}
export type ComponentKindValue = `${ComponentKind}`;

export type Point = { x: number; y: number };

export type SourceProperties = { kind: "dc_source"; voltage: number; enabled: boolean };
export type ResistorProperties = { kind: "resistor"; resistanceOhms: number; tolerance: number };
export type LedProperties = {
  kind: "led";
  forwardVoltage: number;
  maxCurrentMilliamps: number;
  displayColor: LedDisplayColor;
};
export type SwitchProperties = { kind: "switch"; closed: boolean };
export type GroundProperties = { kind: "ground" };
export type BatteryProperties = { kind: "battery"; voltage: number; capacityMilliampHours: number; standard: BatteryStandard };
export type CurrentSourceProperties = { kind: "current_source"; currentAmps: number; enabled: boolean };
export type CapacitorProperties = { kind: "capacitor"; capacitanceFarads: number; polarized: boolean; voltageRating: number };
export type InductorProperties = { kind: "inductor"; inductanceHenries: number; maxCurrentAmps: number };
export type DiodeProperties = { kind: "diode"; forwardVoltage: number };
export type ZenerDiodeProperties = { kind: "zener_diode"; zenerVoltage: number };
export type SchottkyDiodeProperties = { kind: "schottky_diode"; forwardVoltage: number };
export type FuseProperties = { kind: "fuse"; currentRatingAmps: number; voltageRating: number };
export type PotentiometerProperties = { kind: "potentiometer"; resistanceOhms: number; wiperPosition: number };
export type PushButtonProperties = { kind: "push_button"; pressed: boolean };
export type SpdtSwitchProperties = { kind: "spdt_switch"; position: SpdtPosition };
export type NpnBjtProperties = { kind: "npn_bjt"; beta: number };
export type PnpBjtProperties = { kind: "pnp_bjt"; beta: number };
export type NChannelMosfetProperties = { kind: "n_channel_mosfet"; channel: MosfetChannel.N; mode: MosfetMode };
export type PChannelMosfetProperties = { kind: "p_channel_mosfet"; channel: MosfetChannel.P; mode: MosfetMode };
export type OpAmpProperties = { kind: "op_amp"; gain: number };
export type ComponentPropertiesByKind = {
  dc_source: SourceProperties;
  ground: GroundProperties;
  resistor: ResistorProperties;
  led: LedProperties;
  switch: SwitchProperties;
  battery: BatteryProperties;
  current_source: CurrentSourceProperties;
  capacitor: CapacitorProperties;
  inductor: InductorProperties;
  diode: DiodeProperties;
  zener_diode: ZenerDiodeProperties;
  schottky_diode: SchottkyDiodeProperties;
  fuse: FuseProperties;
  potentiometer: PotentiometerProperties;
  push_button: PushButtonProperties;
  spdt_switch: SpdtSwitchProperties;
  npn_bjt: NpnBjtProperties;
  pnp_bjt: PnpBjtProperties;
  n_channel_mosfet: NChannelMosfetProperties;
  p_channel_mosfet: PChannelMosfetProperties;
  op_amp: OpAmpProperties;
};
export type ComponentProperties =
  ComponentPropertiesByKind[ComponentKindValue];
export type ComponentPropertyInput =
  | ComponentProperties
  | { kind: "dc_source"; voltage: number | string; enabled: boolean }
  | { kind: "resistor"; resistanceOhms: number | string; tolerance?: number | string }
  | { kind: "battery"; voltage: number | string; capacityMilliampHours: number | string; standard: BatteryStandard }
  | { kind: "current_source"; currentAmps: number | string; enabled: boolean }
  | { kind: "capacitor"; capacitanceFarads: number | string; polarized: boolean; voltageRating: number | string }
  | { kind: "inductor"; inductanceHenries: number | string; maxCurrentAmps: number }
  | { kind: "fuse"; currentRatingAmps: number | string; voltageRating: number | string }
  | { kind: "potentiometer"; resistanceOhms: number | string; wiperPosition: number };

export type CircuitComponent = {
  id: string;
  kind: ComponentKindValue;
  label: string;
  position: Point;
  properties: ComponentProperties;
  agentLocked: boolean;
  createdBy: Actor;
  lastModifiedBy: Actor;
};

export type TerminalRef = { componentId: string; terminalId: string };
export type CircuitWire = {
  id: string;
  a: TerminalRef;
  b: TerminalRef;
  createdBy: Actor;
};

export type CircuitDesign = {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: number;
  components: Record<string, CircuitComponent>;
  wires: Record<string, CircuitWire>;
};

export type IssueSeverity = "error" | "warning";
export type CircuitIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
  affectedIds: string[];
};
export type ValidationResult = { valid: boolean; issues: CircuitIssue[] };

export type ComponentSimulation = {
  voltageDrop: number;
  currentAmps: number;
  state?: "on" | "off" | "open" | "closed";
};
export type ObservableOutput = {
  componentId: string;
  label: string;
  expectedState: "on" | "off";
};
export type SimulationStatus = "pass" | "warning" | "fail";
export enum SimulationEngineId {
  Deterministic = "deterministic",
  Spice = "spice"
}
export enum SimulationWaveformQuantity {
  Voltage = "voltage",
  Current = "current"
}
export enum SimulationWaveformAxis {
  Time = "time",
  DcVoltage = "dc_voltage",
  DcCurrent = "dc_current",
  Frequency = "frequency"
}
export type SimulationWaveformPoint = {
  readonly x: number;
  readonly y: number;
  readonly phaseDegrees?: number;
};
export type SimulationWaveform = {
  readonly id: string;
  readonly label: string;
  readonly quantity: SimulationWaveformQuantity;
  readonly axis: SimulationWaveformAxis;
  readonly componentId?: string;
  readonly terminalId?: string;
  readonly points: readonly SimulationWaveformPoint[];
};
export type SimulationResult = {
  status: SimulationStatus;
  designRevision: number;
  issues: CircuitIssue[];
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  components: Record<string, ComponentSimulation>;
  observableOutputs: ObservableOutput[];
  summary: string;
  engineId?: SimulationEngineId;
  waveforms?: readonly SimulationWaveform[];
};

export type BenchFault =
  | { type: "open_wire"; wireId: string }
  | { type: "open_component"; componentId: string }
  | { type: "wrong_resistor_value"; componentId: string; actualResistanceOhms: number }
  | { type: "reversed_led"; componentId: string };

export type BenchSymptom = {
  code: "output_mismatch";
  message: string;
  affectedComponentIds: string[];
};
export type MeasurementMode = "dc_voltage" | "continuity";
export type MeasurementRequest = {
  id: string;
  mode: MeasurementMode;
  firstTestPointId: string;
  secondTestPointId: string;
  purpose: string;
  requestedBy: "agent";
  status: "awaiting_human" | "completed";
};
export type Measurement = {
  id: string;
  requestId: string;
  mode: MeasurementMode;
  firstTestPointId: string;
  secondTestPointId: string;
  value: number;
  unit: "V" | "open" | "closed";
  purpose: string;
  requestedBy: "agent";
  performedBy: "human";
  createdAt: string;
};
export type DiagnosticHypothesis = {
  targetType: "component" | "wire";
  targetId: string;
  confidence: number;
  evidenceIds: string[];
  explanation: string;
};
export type RepairAction = "reconnect_wire" | "replace_component" | "correct_value" | "reverse_component";
export type RepairTarget =
  | { type: "component"; componentId: string }
  | { type: "wire"; wireId: string };
export type StagedRepair = {
  id: string;
  target: RepairTarget;
  action: RepairAction;
  evidenceIds: string[];
  expectedOutcome: string;
  stagedBy: "agent";
  status: "awaiting_human" | "approved" | "rejected";
};
export type VerificationResult = {
  result: "pass" | "fail";
  expectedOutputs: ObservableOutput[];
  actualOutputs: ObservableOutput[];
  unresolvedSymptoms: BenchSymptom[];
  summary: string;
};
export type PublicBenchSession = {
  id: string;
  sourceDesignRevision: number;
  sourceDesignSnapshot: CircuitDesign;
  status: "active" | "measurement_requested" | "repair_staged" | "repair_applied" | "verified";
  symptoms: BenchSymptom[];
  measurements: Measurement[];
  pendingMeasurement: MeasurementRequest | null;
  hypotheses: DiagnosticHypothesis[];
  stagedRepair: StagedRepair | null;
  verification: VerificationResult | null;
};

export type ActivityKind =
  | "component_added"
  | "component_updated"
  | "component_removed"
  | "wire_added"
  | "wire_removed"
  | "simulation_run"
  | "bench_started"
  | "measurement_requested"
  | "measurement_completed"
  | "hypotheses_updated"
  | "repair_staged"
  | "repair_approved"
  | "repair_rejected"
  | "repair_verified"
  | "action_rejected"
  | "project_reset";
export type ActivityEvent = {
  id: string;
  actor: Actor;
  action: ActivityKind;
  summary: string;
  affectedIds: string[];
  createdAt: string;
};

export type CommandContext = {
  actor: Actor;
  expectedRevision?: number;
  activityLabel?: string;
};
export enum SimulationCommandErrorCode {
  Superseded = "SIMULATION_SUPERSEDED"
}
export type CommandErrorCode =
  | "REVISION_CONFLICT"
  | "AGENT_LOCKED"
  | "INVALID_MODE"
  | "VALIDATION_FAILED"
  | "SIMULATION_REQUIRED"
  | "BENCH_REQUIRED"
  | "HUMAN_ACTION_REQUIRED"
  | "MEASUREMENT_PENDING"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_INPUT"
  | SimulationCommandErrorCode.Superseded;
export type CommandError = {
  code: CommandErrorCode;
  message: string;
  recovery?: string;
  currentRevision?: number;
};
export type CommandResult<T = undefined> =
  | { ok: true; revision: number; value: T; changedIds: string[]; warnings: string[] }
  | { ok: false; revision: number; error: CommandError };

export type SimulationOverrides = {
  disconnectedWireIds?: ReadonlySet<string>;
  openComponentIds?: ReadonlySet<string>;
  resistorValues?: Readonly<Record<string, number>>;
  reversedLedIds?: ReadonlySet<string>;
};
