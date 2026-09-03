export enum SpicePayloadType {
  TransientVoltage = "simulation_transient_voltage_graph",
  TransientCurrent = "simulation_transient_current_graph",
  OperatingPointVoltage = "simulation_dc_operating_point_voltage",
  OperatingPointCurrent = "simulation_dc_operating_point_current",
  DcSweepVoltage = "simulation_dc_sweep_voltage_graph",
  DcSweepCurrent = "simulation_dc_sweep_current_graph",
  AcSweepVoltage = "simulation_ac_sweep_voltage_graph",
  AcSweepCurrent = "simulation_ac_sweep_current_graph"
}

export enum SpiceDcSweepUnit {
  Volts = "V",
  Amps = "A"
}

export interface SpiceComplexSample {
  readonly re: number;
  readonly im: number;
}

export interface SpiceTransientVoltagePayload {
  readonly type: SpicePayloadType.TransientVoltage;
  readonly name: string;
  readonly timestamps_ms: readonly number[];
  readonly voltage_levels: readonly number[];
  readonly time_per_step: number;
  readonly start_time_ms: number;
  readonly end_time_ms: number;
}

export interface SpiceTransientCurrentPayload {
  readonly type: SpicePayloadType.TransientCurrent;
  readonly name: string;
  readonly timestamps_ms: readonly number[];
  readonly current_levels: readonly number[];
  readonly time_per_step: number;
  readonly start_time_ms: number;
  readonly end_time_ms: number;
}

export interface SpiceOperatingPointVoltagePayload {
  readonly type: SpicePayloadType.OperatingPointVoltage;
  readonly name: string;
  readonly voltage: number;
}

export interface SpiceOperatingPointCurrentPayload {
  readonly type: SpicePayloadType.OperatingPointCurrent;
  readonly name: string;
  readonly current: number;
}

export interface SpiceDcSweepVoltagePayload {
  readonly type: SpicePayloadType.DcSweepVoltage;
  readonly name: string;
  readonly sweep_values: readonly number[];
  readonly sweep_unit: SpiceDcSweepUnit;
  readonly voltage_levels: readonly number[];
}

export interface SpiceDcSweepCurrentPayload {
  readonly type: SpicePayloadType.DcSweepCurrent;
  readonly name: string;
  readonly sweep_values: readonly number[];
  readonly sweep_unit: SpiceDcSweepUnit;
  readonly current_levels: readonly number[];
}

export interface SpiceAcSweepVoltagePayload {
  readonly type: SpicePayloadType.AcSweepVoltage;
  readonly name: string;
  readonly frequencies_hz: readonly number[];
  readonly complex_voltages: readonly SpiceComplexSample[];
}

export interface SpiceAcSweepCurrentPayload {
  readonly type: SpicePayloadType.AcSweepCurrent;
  readonly name: string;
  readonly frequencies_hz: readonly number[];
  readonly complex_currents: readonly SpiceComplexSample[];
}

export type SpiceEnginePayloadElement =
  | SpiceTransientVoltagePayload
  | SpiceTransientCurrentPayload
  | SpiceOperatingPointVoltagePayload
  | SpiceOperatingPointCurrentPayload
  | SpiceDcSweepVoltagePayload
  | SpiceDcSweepCurrentPayload
  | SpiceAcSweepVoltagePayload
  | SpiceAcSweepCurrentPayload;

export interface SpiceEnginePayload {
  readonly engineVersionString?: string;
  readonly simulationResultCircuitJson: readonly SpiceEnginePayloadElement[];
}

export interface SpiceRuntimeEngine {
  simulate(spiceString: string): Promise<SpiceEnginePayload>;
}
