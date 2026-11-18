import { getICDefinition } from '../ic-library';
import {
  CircuitSnapshot,
  DiagnosticIssue,
  ICInstanceRuntimeState,
  LogicLevel,
  PlacedIC,
  SevenSegmentDigitState,
  SimulationSnapshot,
  TerminalId,
} from '../types/circuit';
import { evaluateIC } from './icEvaluators';
import { buildNetlist, getICPinTerminalId } from './netlist';

function resolveDrivers(drivers: LogicLevel[]): LogicLevel {
  let has0 = false;
  let has1 = false;
  let hasX = false;
  for (const d of drivers) {
    if (d === 0) has0 = true;
    else if (d === 1) has1 = true;
    else if (d === 'X') hasX = true;
  }
  if ((has0 && has1) || hasX) return 'X';
  if (has0) return 0;
  if (has1) return 1;
  return 'Z';
}

function createEmptyDisplayState(caLevel: LogicLevel = 'Z'): SevenSegmentDigitState {
  return {
    caLevel,
    segments: {
      a: false,
      b: false,
      c: false,
      d: false,
      e: false,
      f: false,
      g: false,
      dp: false,
    },
    pinLevels: {
      a: 'Z',
      b: 'Z',
      c: 'Z',
      d: 'Z',
      e: 'Z',
      f: 'Z',
      g: 'Z',
      dp: 'Z',
      CA: caLevel,
    },
  };
}

interface SequentialPreStepSnapshot {
  flipFlopState?: ICInstanceRuntimeState['flipFlopState'];
  prevClockState?: ICInstanceRuntimeState['prevClockState'];
}

/**
 * Stateful Digital Simulation Engine instance.
 * Preserves sequential flip-flop, counter, shift-register, and 6116 SRAM states
 * across simulation steps while supporting pure event-driven combinational and
 * multi-IC sequential propagation across all 5 ZIF sockets.
 */
export class DigitalSimulationEngine {
  private simTimeNs = 0;
  private icRuntime = new Map<string, ICInstanceRuntimeState>();
  private lastICDriven = new Map<string, Record<number, LogicLevel>>();

  public resetRuntime(): void {
    this.simTimeNs = 0;
    this.icRuntime.clear();
    this.lastICDriven.clear();
  }

  public getRuntimeStates(): Record<string, ICInstanceRuntimeState> {
    const out: Record<string, ICInstanceRuntimeState> = {};
    for (const [k, v] of this.icRuntime.entries()) {
      out[k] = v;
    }
    return out;
  }

  public seedMemory(instanceId: string, memory: Uint8Array): void {
    const rt = this.icRuntime.get(instanceId);
    if (rt) {
      rt.internalMemory = new Uint8Array(memory);
    }
  }

  public step(circuit: CircuitSnapshot): SimulationSnapshot {
    const netlist = buildNetlist(circuit.wires);
    const diagnostics: DiagnosticIssue[] = [];

    // Reconcile IC runtime map with currently placed ICs
    const activeIds = new Set(circuit.placedICs.map((ic) => ic.instanceId));
    for (const key of this.icRuntime.keys()) {
      if (!activeIds.has(key)) {
        this.icRuntime.delete(key);
        this.lastICDriven.delete(key);
      }
    }
    for (const placed of circuit.placedICs) {
      if (!this.icRuntime.has(placed.instanceId)) {
        const def = getICDefinition(placed.partNumber);
        this.icRuntime.set(placed.instanceId, {
          instanceId: placed.instanceId,
          partNumber: placed.partNumber,
          powered: false,
          hasVcc: false,
          hasGnd: false,
          pinStates: {},
          internalMemory: placed.partNumber === '6116' ? new Uint8Array(2048) : undefined,
          flipFlopState: def?.category === 'sequential' ? {} : undefined,
          prevClockState: def?.category === 'sequential' ? {} : undefined,
        });
      }
    }

    if (!circuit.powerOn) {
      diagnostics.push({
        id: 'power-off',
        severity: 'info',
        code: 'POWER_OFF',
        title: 'Main Trainer Power OFF',
        detail: 'Switch on the main trainer POWER toggle to energize +5V supply rails, switches, clocks, and ICs.',
      });
    }

    // Trainer fixed source drivers
    const fixedNetDrivers = new Map<string, LogicLevel[]>();
    const switchNetDrivers = new Map<string, LogicLevel[]>();
    const addFixedDriver = (terminal: TerminalId, val: LogicLevel) => {
      const netId = netlist.getNetId(terminal);
      let arr = fixedNetDrivers.get(netId);
      if (!arr) {
        arr = [];
        fixedNetDrivers.set(netId, arr);
      }
      arr.push(val);
    };

    if (circuit.powerOn) {
      addFixedDriver('PWR:+5V:0', 1);
      addFixedDriver('PWR:GND:0', 0);

      for (let i = 0; i < 16; i++) {
        const netId = netlist.getNetId(`SW:${i}`);
        let arr = switchNetDrivers.get(netId);
        if (!arr) {
          arr = [];
          switchNetDrivers.set(netId, arr);
        }
        arr.push(circuit.switches[i] ?? 0);
      }
      addFixedDriver('CLK:OUT', circuit.clock.level);
      addFixedDriver('CLK:OUT_N', circuit.clock.level === 1 ? 0 : 1);
      addFixedDriver('PULSE:OUT', circuit.pulse.level);
    }

    // Detect direct +5V to GND short before evaluating ICs
    const vccNetId = netlist.getNetId('PWR:+5V:0');
    const gndNetId = netlist.getNetId('PWR:GND:0');

    if (circuit.powerOn && vccNetId === gndNetId) {
      diagnostics.push({
        id: 'power-short',
        severity: 'error',
        code: 'POWER_SHORT',
        title: 'Direct +5V to GND Short Circuit',
        detail: 'The +5V supply rail is electrically shorted to GND. Remove the shorting wire immediately.',
      });
    }

    // Resolve power status for each placed IC.
    // ZIF sockets (ZIF1..ZIF5) integrate internal +5V and GND supply routing automatically
    // when Main Trainer Power is ON, unless the user explicitly shorts/reverses polarity on the pins.
    for (const placed of circuit.placedICs) {
      const def = getICDefinition(placed.partNumber);
      const rt = this.icRuntime.get(placed.instanceId)!;
      if (!def) continue;

      const isZifSocket = placed.placement.kind === 'zif';
      let hasVcc = false;
      let hasGnd = false;
      let reversed = false;

      if (circuit.powerOn && vccNetId !== gndNetId) {
        for (const pin of def.pins) {
          const term = getICPinTerminalId(placed, pin.pin);
          if (!term) continue;
          const pinNet = netlist.getNetId(term);
          if (pin.direction === 'power-vcc') {
            if (pinNet === gndNetId) {
              reversed = true;
            } else if (pinNet === vccNetId || isZifSocket) {
              hasVcc = true;
              addFixedDriver(term, 1);
            }
          } else if (pin.direction === 'power-gnd') {
            if (pinNet === vccNetId) {
              reversed = true;
            } else if (pinNet === gndNetId || isZifSocket) {
              hasGnd = true;
              addFixedDriver(term, 0);
            }
          }
        }
      }

      rt.hasVcc = hasVcc;
      rt.hasGnd = hasGnd;
      rt.powered = circuit.powerOn && hasVcc && hasGnd && !reversed && vccNetId !== gndNetId;

      if (circuit.powerOn) {
        if (reversed) {
          diagnostics.push({
            id: `rev-${placed.instanceId}`,
            severity: 'error',
            code: 'POWER_REVERSED',
            title: `${placed.partNumber}: Reversed Power Polarity`,
            detail: `VCC and GND pins are connected to opposite polarity on ${placed.partNumber}. Check datasheet power pin numbers.`,
            targetId: placed.instanceId,
          });
        } else {
          if (!hasVcc) {
            const vccPins = def.pins
              .filter((p) => p.direction === 'power-vcc')
              .map((p) => `Pin ${p.pin} (${p.name})`)
              .join(', ');
            diagnostics.push({
              id: `novcc-${placed.instanceId}`,
              severity: 'error',
              code: 'MISSING_VCC',
              title: `${placed.partNumber}: Missing +5V Supply`,
              detail: `Connect +5V to ${vccPins} on ${placed.partNumber}.`,
              targetId: placed.instanceId,
            });
          }
          if (!hasGnd) {
            const gndPins = def.pins
              .filter((p) => p.direction === 'power-gnd')
              .map((p) => `Pin ${p.pin} (${p.name})`)
              .join(', ');
            diagnostics.push({
              id: `nognd-${placed.instanceId}`,
              severity: 'error',
              code: 'MISSING_GND',
              title: `${placed.partNumber}: Missing Ground Connection`,
              detail: `Connect GND to ${gndPins} on ${placed.partNumber}.`,
              targetId: placed.instanceId,
            });
          }
        }
      }
    }

    // Identify 6116 bidirectional I/O nets so input switches wired to 6116 I/O0..I/O7
    // only drive the bus during an active Write cycle (~CS=0 and ~WR=0).
    const sramIOOwnerByNet = new Map<string, PlacedIC[]>();
    const sramIOPins = [9, 10, 11, 13, 14, 15, 16, 17];
    for (const placed of circuit.placedICs) {
      if (placed.partNumber !== '6116') continue;
      const rt = this.icRuntime.get(placed.instanceId);
      if (!rt?.powered) continue;
      for (const ioPin of sramIOPins) {
        const term = getICPinTerminalId(placed, ioPin);
        if (!term) continue;
        const netId = netlist.getNetId(term);
        let list = sramIOOwnerByNet.get(netId);
        if (!list) {
          list = [];
          sramIOOwnerByNet.set(netId, list);
        }
        list.push(placed);
      }
    }

    // Snapshot pre-step sequential state for each placed IC so multi-IC cascades
    // evaluate clock transitions against the true pre-step state across delta cycles.
    const preStepSequential = new Map<string, SequentialPreStepSnapshot>();
    for (const placed of circuit.placedICs) {
      const rt = this.icRuntime.get(placed.instanceId)!;
      preStepSequential.set(placed.instanceId, {
        flipFlopState: rt.flipFlopState ? { ...rt.flipFlopState } : undefined,
        prevClockState: rt.prevClockState ? { ...rt.prevClockState } : undefined,
      });
    }

    // Track per-IC driven pin states across delta cycles (seeded from previous step's steady outputs)
    const icDrivenByInstance = new Map<string, Record<number, LogicLevel>>();
    for (const placed of circuit.placedICs) {
      const prev = this.lastICDriven.get(placed.instanceId);
      if (prev) {
        icDrivenByInstance.set(placed.instanceId, { ...prev });
      }
    }

    // Helper to check if a net is a 6116 bidirectional I/O net whose 6116 is NOT in active Write mode (~CS=0, ~WR=0)
    const isSwitchActiveOnNet = (netId: string, allowRawControlLookup = false): boolean => {
      const owners = sramIOOwnerByNet.get(netId);
      if (!owners || owners.length === 0) return true;
      if (allowRawControlLookup) return false;
      // Switch drives the 6116 I/O net ONLY if at least one connected 6116 has ~CS=0 (Pin 18) and ~WR=0 (Pin 21)
      return owners.some((sramIC) => {
        const csTerm = getICPinTerminalId(sramIC, 18);
        const wrTerm = getICPinTerminalId(sramIC, 21);
        const csNet = csTerm ? netlist.getNetId(csTerm) : null;
        const wrNet = wrTerm ? netlist.getNetId(wrTerm) : null;
        const csVal = csNet ? resolveControlNet(sramIC.instanceId, 18, csNet) : 1;
        const wrVal = wrNet ? resolveControlNet(sramIC.instanceId, 21, wrNet) : 1;
        return csVal === 0 && wrVal === 0;
      });
    };

    const resolveControlNet = (targetInstanceId: string, targetPin: number, netId: string): LogicLevel => {
      const drivers: LogicLevel[] = [];
      const fixed = fixedNetDrivers.get(netId);
      if (fixed) drivers.push(...fixed);
      const sw = switchNetDrivers.get(netId);
      if (sw) drivers.push(...sw);
      for (const other of circuit.placedICs) {
        const driven = icDrivenByInstance.get(other.instanceId);
        if (!driven) continue;
        for (const [pinStr, val] of Object.entries(driven)) {
          if (val === 'Z') continue;
          const pinNum = Number(pinStr);
          if (other.instanceId === targetInstanceId && pinNum === targetPin) continue;
          const term = getICPinTerminalId(other, pinNum);
          if (term && netlist.getNetId(term) === netId) {
            drivers.push(val);
          }
        }
      }
      return resolveDrivers(drivers);
    };

    // Helper to resolve the logic level seen by a specific IC pin (excluding only that exact pin driving itself)
    const resolvePinInput = (targetInstanceId: string, targetPin: number, netId: string): LogicLevel => {
      const drivers: LogicLevel[] = [];
      const fixed = fixedNetDrivers.get(netId);
      if (fixed) {
        drivers.push(...fixed);
      }
      const sw = switchNetDrivers.get(netId);
      if (sw && isSwitchActiveOnNet(netId)) {
        drivers.push(...sw);
      }
      for (const other of circuit.placedICs) {
        const driven = icDrivenByInstance.get(other.instanceId);
        if (!driven) continue;
        for (const [pinStr, val] of Object.entries(driven)) {
          if (val === 'Z') continue;
          const pinNum = Number(pinStr);
          if (other.instanceId === targetInstanceId && pinNum === targetPin) {
            continue;
          }
          const term = getICPinTerminalId(other, pinNum);
          if (!term) continue;
          if (netlist.getNetId(term) === netId) {
            drivers.push(val);
          }
        }
      }
      return resolveDrivers(drivers);
    };

    // Iterative event-driven propagation across all placed ICs
    const MAX_DELTA_CYCLES = 16;
    let settled = false;
    let deltaCount = 0;

    for (let cycle = 0; cycle < MAX_DELTA_CYCLES; cycle++) {
      deltaCount = cycle + 1;
      let changed = false;

      for (const placed of circuit.placedICs) {
        const def = getICDefinition(placed.partNumber);
        const rt = this.icRuntime.get(placed.instanceId)!;
        if (!def) continue;

        // Restore pre-step sequential state before evaluating this IC on the current delta cycle
        const seqSnap = preStepSequential.get(placed.instanceId);
        if (seqSnap) {
          if (seqSnap.flipFlopState) {
            rt.flipFlopState = { ...seqSnap.flipFlopState };
          }
          if (seqSnap.prevClockState) {
            rt.prevClockState = { ...seqSnap.prevClockState };
          }
        }

        const pinInputs: Record<number, LogicLevel> = {};
        for (const pin of def.pins) {
          const term = getICPinTerminalId(placed, pin.pin);
          if (!term) continue;
          const netId = netlist.getNetId(term);
          pinInputs[pin.pin] = resolvePinInput(placed.instanceId, pin.pin, netId);
        }

        const evalRes = evaluateIC({
          partNumber: placed.partNumber,
          pinInputs,
          runtime: rt,
          commitSequential: true,
        });

        const prevDriven = icDrivenByInstance.get(placed.instanceId) ?? {};
        const nextDriven = evalRes.drivenPins;
        const allPinKeys = new Set([
          ...Object.keys(prevDriven),
          ...Object.keys(nextDriven),
        ]);
        for (const k of allPinKeys) {
          const pn = Number(k);
          if ((prevDriven[pn] ?? 'Z') !== (nextDriven[pn] ?? 'Z')) {
            changed = true;
            break;
          }
        }
        icDrivenByInstance.set(placed.instanceId, nextDriven);
      }

      if (!changed) {
        settled = true;
        break;
      }
    }

    // Merge active switch drivers into fixedNetDrivers for final global net and conflict calculation
    for (const [netId, swList] of switchNetDrivers.entries()) {
      if (isSwitchActiveOnNet(netId)) {
        let arr = fixedNetDrivers.get(netId);
        if (!arr) {
          arr = [];
          fixedNetDrivers.set(netId, arr);
        }
        arr.push(...swList);
      }
    }

    // Compute final global net values from settled fixed + IC drivers
    const netValues = new Map<string, LogicLevel>();
    const allNetDrivers = new Map<string, LogicLevel[]>();

    for (const [netId, list] of fixedNetDrivers.entries()) {
      allNetDrivers.set(netId, [...list]);
    }

    for (const placed of circuit.placedICs) {
      const driven = icDrivenByInstance.get(placed.instanceId);
      if (!driven) continue;
      for (const [pinStr, val] of Object.entries(driven)) {
        if (val === 'Z') continue;
        const term = getICPinTerminalId(placed, Number(pinStr));
        if (!term) continue;
        const netId = netlist.getNetId(term);
        let arr = allNetDrivers.get(netId);
        if (!arr) {
          arr = [];
          allNetDrivers.set(netId, arr);
        }
        arr.push(val);
      }
    }

    for (const [netId, drivers] of allNetDrivers.entries()) {
      netValues.set(netId, resolveDrivers(drivers));
    }

    // Persist steady-state driven IC outputs for next step's pre-edge reference
    this.lastICDriven.clear();
    for (const [id, driven] of icDrivenByInstance.entries()) {
      this.lastICDriven.set(id, { ...driven });
    }

    if (circuit.placedICs.length > 0 && circuit.powerOn) {
      const maxDelay = Math.max(
        ...circuit.placedICs.map((p) => getICDefinition(p.partNumber)?.propagationDelayNs ?? 10)
      );
      this.simTimeNs += maxDelay * deltaCount;
    }

    if (!settled) {
      diagnostics.push({
        id: 'osc-loop',
        severity: 'warning',
        code: 'OSCILLATION_DETECTED',
        title: 'Combinational Feedback Oscillation',
        detail: 'Signals did not stabilize within 16 delta cycles (ring oscillator or feedback loop detected).',
      });
    }

    // Update final pinStates on IC runtime & check floating inputs / driver conflicts
    const netDriversMap = new Map<string, Array<{ label: string; level: LogicLevel }>>();
    for (const [netId, list] of fixedNetDrivers.entries()) {
      netDriversMap.set(
        netId,
        list.map((level) => ({ label: 'Trainer Source', level }))
      );
    }
    for (const placed of circuit.placedICs) {
      const def = getICDefinition(placed.partNumber);
      const rt = this.icRuntime.get(placed.instanceId)!;
      const driven = icDrivenByInstance.get(placed.instanceId) ?? {};
      if (!def) continue;

      let hasAnySignalWire = false;
      const floatingInputNames: string[] = [];

      for (const pin of def.pins) {
        const term = getICPinTerminalId(placed, pin.pin);
        if (!term) continue;
        const netId = netlist.getNetId(term);
        const val = netValues.get(netId) ?? 'Z';
        rt.pinStates[pin.pin] = val;

        const netTerminals = netlist.nets.get(netId) ?? [];
        if (
          pin.direction !== 'power-vcc' &&
          pin.direction !== 'power-gnd' &&
          pin.direction !== 'nc' &&
          (netTerminals.length > 1 || circuit.wires.some((w) => w.from === term || w.to === term))
        ) {
          hasAnySignalWire = true;
        }

        const outVal = driven[pin.pin];
        if (outVal !== undefined && outVal !== 'Z') {
          let arr = netDriversMap.get(netId);
          if (!arr) {
            arr = [];
            netDriversMap.set(netId, arr);
          }
          arr.push({ label: `${placed.partNumber} Pin ${pin.pin} (${pin.name})`, level: outVal });
        }

        if (pin.direction === 'input' && val === 'Z') {
          if (def.family === 'CMOS' || hasAnySignalWire) {
            floatingInputNames.push(`${pin.pin}:${pin.name}`);
          }
        }
      }

      if (circuit.powerOn && rt.powered && !hasAnySignalWire) {
        diagnostics.push({
          id: `unconn-${placed.instanceId}`,
          severity: 'info',
          code: 'UNCONNECTED_IC',
          title: `${placed.partNumber}: No Signal Connections`,
          detail: `${placed.partNumber} is powered by its ZIF socket but has no input or output signal wires connected.`,
          targetId: placed.instanceId,
        });
      } else if (circuit.powerOn && rt.powered && floatingInputNames.length > 0) {
        const isCmos = def.family === 'CMOS';
        diagnostics.push({
          id: `float-${placed.instanceId}`,
          severity: isCmos ? 'warning' : 'info',
          code: isCmos ? 'CMOS_FLOATING_INPUT' : 'FLOATING_INPUT',
          title: `${placed.partNumber}: Unconnected ${isCmos ? 'CMOS ' : ''}Input${floatingInputNames.length > 1 ? 's' : ''}`,
          detail: `Unconnected input pin(s): ${floatingInputNames.slice(0, 6).join(', ')}${floatingInputNames.length > 6 ? ` (+${floatingInputNames.length - 6} more)` : ''}.`,
          targetId: placed.instanceId,
        });
      }
    }

    // Check driver conflicts (0 vs 1 on same net, excluding redundant +5V/GND supplies)
    for (const [netId, drivers] of netDriversMap.entries()) {
      const has0 = drivers.some((d) => d.level === 0);
      const has1 = drivers.some((d) => d.level === 1);
      if (has0 && has1 && netId !== vccNetId) {
        diagnostics.push({
          id: `conflict-${netId}`,
          severity: 'error',
          code: 'DRIVER_CONFLICT',
          title: 'Bus / Output Driver Conflict',
          detail: `Multiple drivers are driving conflicting 0 and 1 states onto the same net (${drivers.map((d) => `${d.label}=${d.level}`).join(', ')}).`,
        });
      }
    }

    // Build terminalStates lookup for UI inspection
    const terminalStates: Record<TerminalId, LogicLevel> = {};
    for (const t of netlist.allTerminals) {
      const netId = netlist.getNetId(t);
      terminalStates[t] = netValues.get(netId) ?? 'Z';
    }

    const ledStates: LogicLevel[] = [];
    for (let i = 0; i < 16; i++) {
      ledStates.push(terminalStates[`LED:${i}`] ?? 'Z');
    }

    // Compute onboard LTS542 Common-Anode 7-segment display states
    const evalDisplay = (dispId: 'DISP1' | 'DISP2'): SevenSegmentDigitState => {
      const rawCa = terminalStates[`${dispId}:CA`] ?? 'Z';
      // Onboard LTS542 display module has internal +5V common-anode bias unless CA is explicitly driven LOW (0)
      const effectiveCa: LogicLevel = circuit.powerOn ? (rawCa === 'Z' ? 1 : rawCa) : 'Z';
      const state = createEmptyDisplayState(effectiveCa);
      const segKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;
      let anyDrivenWhenCaLow = false;

      for (const s of segKeys) {
        const lvl = terminalStates[`${dispId}:${s}`] ?? 'Z';
        state.pinLevels[s] = lvl;
        // Common-anode LTS542: illuminates when CA == 1 (+5V) and segment cathode == 0 (LOW)
        if (circuit.powerOn && effectiveCa === 1 && lvl === 0) {
          state.segments[s] = true;
        }
        if (lvl !== 'Z' && rawCa === 0) {
          anyDrivenWhenCaLow = true;
        }
      }

      if (circuit.powerOn && anyDrivenWhenCaLow) {
        diagnostics.push({
          id: `disp-ca-${dispId}`,
          severity: 'warning',
          code: 'DISPLAY_POLARITY',
          title: `${dispId}: Common Anode Grounded`,
          detail: `${dispId}:CA is connected to GND (0V). Connect CA to +5V (or leave on internal +5V anode pull-up) for common-anode operation.`,
          targetId: dispId,
        });
      }
      return state;
    };

    return {
      simTimeNs: this.simTimeNs,
      powerOn: circuit.powerOn,
      terminalStates,
      ledStates,
      displays: {
        DISP1: evalDisplay('DISP1'),
        DISP2: evalDisplay('DISP2'),
      },
      icStates: this.getRuntimeStates(),
      diagnostics,
      netCount: netlist.nets.size,
    };
  }
}
