/**
 * LogicBench Core Circuit & Simulation Domain Types
 * Pure TypeScript definitions shared across simulation engine, netlist resolver,
 * storage layer, and UI components.
 */

export type LogicLevel = 0 | 1 | 'X' | 'Z';

export type PinDirection =
  | 'input'
  | 'output'
  | 'open-collector'
  | 'bidirectional'
  | 'power-vcc'
  | 'power-gnd'
  | 'nc';

export type ICFamily = 'TTL' | 'CMOS';

export type ICCategory =
  | 'logic-gates'
  | 'combinational'
  | 'sequential'
  | 'memory';

export type PackageType = 'DIP-14' | 'DIP-16' | 'DIP-24';

export interface ICPinDefinition {
  pin: number;
  name: string;
  direction: PinDirection;
  description: string;
  activeLow?: boolean;
}

export interface TruthTableRow {
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  note?: string;
}

export interface ICDefinition {
  partNumber: string;
  name: string;
  category: ICCategory;
  family: ICFamily;
  packageType: PackageType;
  pinCount: 14 | 16 | 24;
  propagationDelayNs: number;
  supplyVoltage: string;
  description: string;
  datasheetSummary: string;
  triggerType?: 'combinational' | 'positive-edge' | 'negative-edge' | 'level-async';
  pins: ICPinDefinition[];
  truthTablePreview: TruthTableRow[];
  pinoutVerified: boolean;
}

export type ZIFSocketId = 'ZIF1' | 'ZIF2' | 'ZIF3' | 'ZIF4' | 'ZIF5';

export type ICPlacementTarget =
  | { kind: 'zif'; socketId: ZIFSocketId }
  | { kind: 'breadboard'; startCol: number };

export interface PlacedIC {
  instanceId: string;
  partNumber: string;
  placement: ICPlacementTarget;
}

export type WireColor = 'red' | 'black' | 'yellow' | 'blue' | 'green';

/**
 * Unified Terminal Identifiers used by both visual patch cords and simulation netlist:
 * - Built-in ZIF Power: "PWR:+5V:0" .. "PWR:+5V:4", "PWR:GND:0" .. "PWR:GND:4"
 * - Switches: "SW:0" .. "SW:15"
 * - Output LEDs: "LED:0" .. "LED:15"
 * - Clock: "CLK:OUT", "CLK:OUT_N"
 * - Pulse: "PULSE:OUT"
 * - 7-Seg Displays: "DISP1:a" .. "DISP1:g", "DISP1:dp", "DISP1:CA", same for DISP2
 * - ZIF Sockets: "ZIF1:1" .. "ZIF4:16" (16-pin), "ZIF5:1" .. "ZIF5:24" (24-pin RAM)
 */
export type TerminalId = string;

export interface Wire {
  id: string;
  from: TerminalId;
  to: TerminalId;
  color: WireColor;
  kind: 'patch-cord' | 'jumper';
  controlOffset?: { dx: number; dy: number };
}

export interface ClockConfig {
  mode: 'manual' | 'auto' | 'single-step';
  autoRunning: boolean;
  frequencyHz: number;
  dutyCyclePercent: number;
  level: 0 | 1;
}

export interface PulseConfig {
  running: boolean;
  frequencyHz: number;
  dutyCyclePercent: number;
  level: 0 | 1;
}

export interface DiagnosticIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  code:
    | 'POWER_OFF'
    | 'MISSING_VCC'
    | 'MISSING_GND'
    | 'POWER_SHORT'
    | 'POWER_REVERSED'
    | 'FLOATING_INPUT'
    | 'CMOS_FLOATING_INPUT'
    | 'DRIVER_CONFLICT'
    | 'UNCONNECTED_IC'
    | 'DISPLAY_POLARITY'
    | 'INVALID_SOCKET'
    | 'OSCILLATION_DETECTED';
  title: string;
  detail: string;
  targetId?: string;
}

export interface ICInstanceRuntimeState {
  instanceId: string;
  partNumber: string;
  powered: boolean;
  hasVcc: boolean;
  hasGnd: boolean;
  pinStates: Record<number, LogicLevel>;
  internalMemory?: Uint8Array;
  flipFlopState?: Record<string, 0 | 1>;
  prevClockState?: Record<string, LogicLevel>;
}

export interface SevenSegmentDigitState {
  caLevel: LogicLevel;
  segments: {
    a: boolean;
    b: boolean;
    c: boolean;
    d: boolean;
    e: boolean;
    f: boolean;
    g: boolean;
    dp: boolean;
  };
  pinLevels: Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'dp' | 'CA', LogicLevel>;
}

export interface SimulationSnapshot {
  simTimeNs: number;
  powerOn: boolean;
  terminalStates: Record<TerminalId, LogicLevel>;
  ledStates: LogicLevel[]; // 16 LEDs
  displays: {
    DISP1: SevenSegmentDigitState;
    DISP2: SevenSegmentDigitState;
  };
  icStates: Record<string, ICInstanceRuntimeState>;
  diagnostics: DiagnosticIssue[];
  netCount: number;
}

export interface CircuitSnapshot {
  powerOn: boolean;
  switches: (0 | 1)[]; // 16 switches
  clock: ClockConfig;
  pulse: PulseConfig;
  placedICs: PlacedIC[];
  wires: Wire[];
}

export interface ExperimentTruthRow {
  id: string;
  label: string;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1 | 'X' | 'Z'>;
  observed?: Record<string, LogicLevel>;
  passed?: boolean;
}

export interface ExperimentTemplate {
  id: string;
  title: string;
  category: string;
  isExample: boolean;
  aim: string;
  requiredICs: string[];
  constructionNotes: string[];
  pinConnections: Array<{ from: string; to: string; signal: string }>;
  procedure: string[];
  truthTable: ExperimentTruthRow[];
  expectedResult: string;
}

export interface ProjectDocument {
  schema: 'logicbench-project/v1';
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  createdAt: string;
  circuit: CircuitSnapshot;
  activeExperimentId?: string;
  experimentNotes?: Record<string, { observedNotes: string; finalResult: string }>;
}
