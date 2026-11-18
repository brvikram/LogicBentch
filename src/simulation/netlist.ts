import { getICDefinition, BREADBOARD_COLS } from '../ic-library';
import { PlacedIC, TerminalId, Wire } from '../types/circuit';

/**
 * Union-Find Disjoint Set for resolving electrical connectivity across
 * breadboard strips, power rails, patch cords, and jumper wires.
 */
class DisjointSet {
  private parent = new Map<string, string>();

  find(x: string): string {
    let curr = x;
    if (!this.parent.has(curr)) {
      this.parent.set(curr, curr);
      return curr;
    }
    while (this.parent.get(curr) !== curr) {
      curr = this.parent.get(curr)!;
    }
    // Path compression
    let node = x;
    while (node !== curr) {
      const next = this.parent.get(node)!;
      this.parent.set(node, curr);
      node = next;
    }
    return curr;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(rb, ra);
    }
  }
}

export const BREADBOARD_TOP_ROWS = ['A', 'B', 'C', 'D', 'E'] as const;
export const BREADBOARD_BOT_ROWS = ['F', 'G', 'H', 'I', 'J'] as const;

export function getAllPowerTerminals(): TerminalId[] {
  return [
    'PWR:+5V:0',
    'PWR:+5V:1',
    'PWR:+5V:2',
    'PWR:+5V:3',
    'PWR:+5V:4',
    'PWR:GND:0',
    'PWR:GND:1',
    'PWR:GND:2',
    'PWR:GND:3',
    'PWR:GND:4',
  ];
}

export function getICPinTerminalId(placedIC: PlacedIC, pinNumber: number): TerminalId | null {
  const def = getICDefinition(placedIC.partNumber);
  if (!def || pinNumber < 1 || pinNumber > def.pinCount) return null;

  if (placedIC.placement.kind === 'zif') {
    const sock = placedIC.placement.socketId;
    if (sock === 'ZIF5') {
      if (def.pinCount === 24) {
        return `ZIF5:${pinNumber}`;
      }
      return null;
    }
    if (def.pinCount === 16) {
      return `${sock}:${pinNumber}`;
    }
    if (def.pinCount === 14) {
      // Top-aligned in 16-pin ZIF socket:
      // IC pins 1..7 -> physical socket 1..7; IC pins 8..14 -> physical socket 10..16
      // (And the UI shifts displayed pin numbers on physical 10..16 to 8..14!)
      const socketPin = pinNumber <= 7 ? pinNumber : pinNumber + 2;
      return `${sock}:${socketPin}`;
    }
    return null;
  }

  // Legacy breadboard DIP placement across center gap (Pin 1 notch on left):
  const half = def.pinCount / 2;
  const startCol = placedIC.placement.startCol;
  if (pinNumber <= half) {
    const col = startCol + (pinNumber - 1);
    return `BB:F:${col}`;
  } else {
    const col = startCol + (def.pinCount - pinNumber);
    return `BB:E:${col}`;
  }
}

/**
 * Computes the dynamically shifted pin number and IC pin metadata for any ZIF socket terminal.
 * When a 14-pin IC is placed in a 16-pin ZIF socket (ZIF1..ZIF4), numbering shifts from 16 to 14:
 * - Left rows 1..7 -> Pin 1..7, row 8 -> 'NC'
 * - Right rows 16..10 (top to bottom) -> Pin 14..8, row 9 (bottom) -> 'NC'
 */
export function getDisplayedZifPinInfo(
  socketId: 'ZIF1' | 'ZIF2' | 'ZIF3' | 'ZIF4' | 'ZIF5',
  physicalSocketPin: number,
  placedICs: PlacedIC[]
): {
  displayedPin: number | 'NC';
  icPinNumber: number | null;
  icPinName: string | null;
  icPinDirection: string | null;
  partNumber: string | null;
} {
  const occupant = placedICs.find(
    (p) => p.placement.kind === 'zif' && p.placement.socketId === socketId
  );
  const def = occupant ? getICDefinition(occupant.partNumber) : undefined;

  if (!occupant || !def) {
    return {
      displayedPin: physicalSocketPin,
      icPinNumber: null,
      icPinName: null,
      icPinDirection: null,
      partNumber: null,
    };
  }

  if (def.pinCount === 14 && socketId !== 'ZIF5') {
    if (physicalSocketPin === 8 || physicalSocketPin === 9) {
      return {
        displayedPin: 'NC',
        icPinNumber: null,
        icPinName: 'NC',
        icPinDirection: 'nc',
        partNumber: occupant.partNumber,
      };
    }
    const shiftedPin = physicalSocketPin <= 7 ? physicalSocketPin : physicalSocketPin - 2;
    const pinDef = def.pins.find((p) => p.pin === shiftedPin);
    return {
      displayedPin: shiftedPin,
      icPinNumber: shiftedPin,
      icPinName: pinDef?.name ?? null,
      icPinDirection: pinDef?.direction ?? null,
      partNumber: occupant.partNumber,
    };
  }

  const pinDef = def.pins.find((p) => p.pin === physicalSocketPin);
  return {
    displayedPin: physicalSocketPin,
    icPinNumber: physicalSocketPin,
    icPinName: pinDef?.name ?? null,
    icPinDirection: pinDef?.direction ?? null,
    partNumber: occupant.partNumber,
  };
}

/**
 * Returns the canonical electrical node key for a terminal.
 */
export function getBaseStripId(terminal: TerminalId): string {
  if (!terminal.startsWith('BB:')) return terminal;
  const parts = terminal.split(':');
  if (parts.length !== 3) return terminal;
  const [, row, colStr] = parts;
  if (row === 'TOP+' || row === 'TOP-' || row === 'BOT+' || row === 'BOT-') {
    return `BB_RAIL:${row}`;
  }
  if (BREADBOARD_TOP_ROWS.includes(row as (typeof BREADBOARD_TOP_ROWS)[number])) {
    return `BB_STRIP:TOP:${colStr}`;
  }
  if (BREADBOARD_BOT_ROWS.includes(row as (typeof BREADBOARD_BOT_ROWS)[number])) {
    return `BB_STRIP:BOT:${colStr}`;
  }
  return terminal;
}

export interface NetlistResult {
  /** Maps any TerminalId (or canonical base strip) to a NetId string */
  getNetId: (terminal: TerminalId) => string;
  /** All distinct electrical net IDs */
  nets: Map<string, TerminalId[]>;
  /** All trainer terminals registered */
  allTerminals: TerminalId[];
}

export function getAllTrainerTerminals(): TerminalId[] {
  const terminals: TerminalId[] = [...getAllPowerTerminals()];
  for (let i = 0; i < 16; i++) terminals.push(`SW:${i}`);
  for (let i = 0; i < 16; i++) terminals.push(`LED:${i}`);
  terminals.push('CLK:OUT', 'CLK:OUT_N', 'PULSE:OUT');
  for (const disp of ['DISP1', 'DISP2'] as const) {
    for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'CA']) {
      terminals.push(`${disp}:${seg}`);
    }
  }
  for (const zif of ['ZIF1', 'ZIF2', 'ZIF3', 'ZIF4'] as const) {
    for (let p = 1; p <= 16; p++) {
      terminals.push(`${zif}:${p}`);
    }
  }
  for (let p = 1; p <= 24; p++) {
    terminals.push(`ZIF5:${p}`);
  }
  for (let c = 1; c <= BREADBOARD_COLS; c++) {
    terminals.push(`BB:TOP+:${c}`, `BB:TOP-:${c}`, `BB:BOT+:${c}`, `BB:BOT-:${c}`);
    for (const r of [...BREADBOARD_TOP_ROWS, ...BREADBOARD_BOT_ROWS]) {
      terminals.push(`BB:${r}:${c}`);
    }
  }
  return terminals;
}

export function buildNetlist(wires: Wire[]): NetlistResult {
  const ds = new DisjointSet();
  const allTerminals = getAllTrainerTerminals();

  // Group all +5V trainer supply terminals together (internal trainer +5V bus across all 5 ZIF sockets)
  for (let i = 1; i < 5; i++) {
    ds.union('PWR:+5V:0', `PWR:+5V:${i}`);
    ds.union('PWR:GND:0', `PWR:GND:${i}`);
  }

  // Register all terminals under their base electrical strips
  for (const t of allTerminals) {
    const base = getBaseStripId(t);
    ds.union(t, base);
  }

  // Merge user patch cords and breadboard jumpers
  for (const w of wires) {
    if (!w.from || !w.to) continue;
    ds.union(getBaseStripId(w.from), getBaseStripId(w.to));
    ds.union(w.from, getBaseStripId(w.from));
    ds.union(w.to, getBaseStripId(w.to));
  }

  const nets = new Map<string, TerminalId[]>();
  for (const t of allTerminals) {
    const root = ds.find(t);
    let list = nets.get(root);
    if (!list) {
      list = [];
      nets.set(root, list);
    }
    list.push(t);
  }

  return {
    getNetId: (t: TerminalId) => ds.find(getBaseStripId(t)),
    nets,
    allTerminals,
  };
}

export type WireConnectionCategory =
  | 'INTER-GATE'
  | 'INTER-IC'
  | 'EXT-IN'
  | 'EXT-OUT'
  | 'EXT-LINK';

export interface WireClassificationInfo {
  category: WireConnectionCategory;
  categoryLabel: string;
  shortTag: string;
  fromFormatted: string;
  toFormatted: string;
  summary: string;
}

export function formatDirectionTag(dir: string | null): 'IN' | 'OUT' | 'I/O' | 'VCC' | 'GND' | 'NC' {
  if (dir === 'power-vcc') return 'VCC';
  if (dir === 'power-gnd') return 'GND';
  if (dir === 'output' || dir === 'open-collector') return 'OUT';
  if (dir === 'bidirectional') return 'I/O';
  if (dir === 'nc') return 'NC';
  return 'IN';
}

export function describeTerminalEndpoint(
  terminalId: TerminalId,
  placedICs: PlacedIC[]
): {
  shortLabel: string;
  fullLabel: string;
  directionTag: 'IN' | 'OUT' | 'I/O' | 'VCC' | 'GND' | 'NC';
  socketId: string | null;
  icPinName: string | null;
} {
  if (terminalId.startsWith('ZIF')) {
    const [sock, pinStr] = terminalId.split(':');
    const physPin = Number(pinStr);
    const info = getDisplayedZifPinInfo(
      sock as 'ZIF1' | 'ZIF2' | 'ZIF3' | 'ZIF4' | 'ZIF5',
      physPin,
      placedICs
    );
    const shortSock = sock.replace('ZIF', 'Z');
    const dirTag = formatDirectionTag(info.icPinDirection);
    if (info.icPinName && info.displayedPin !== 'NC') {
      return {
        shortLabel: `${shortSock}:${info.icPinName}(${dirTag})`,
        fullLabel: `${sock}:Pin ${info.displayedPin} [${info.icPinName} ${dirTag}]`,
        directionTag: dirTag,
        socketId: sock,
        icPinName: info.icPinName,
      };
    }
    return {
      shortLabel: `${shortSock}:P${info.displayedPin}`,
      fullLabel: `${sock}:Pin ${info.displayedPin}`,
      directionTag: dirTag,
      socketId: sock,
      icPinName: null,
    };
  }

  if (terminalId.startsWith('SW:')) {
    const idx = terminalId.split(':')[1];
    return {
      shortLabel: `SW${idx}(IN)`,
      fullLabel: `SW${idx} (Ext Input)`,
      directionTag: 'IN',
      socketId: null,
      icPinName: null,
    };
  }

  if (terminalId.startsWith('LED:')) {
    const idx = terminalId.split(':')[1];
    return {
      shortLabel: `L${idx}(OUT)`,
      fullLabel: `L${idx} (Ext Output)`,
      directionTag: 'OUT',
      socketId: null,
      icPinName: null,
    };
  }

  if (terminalId.startsWith('DISP1:') || terminalId.startsWith('DISP2:')) {
    const [, seg] = terminalId.split(':');
    return {
      shortLabel: `7SEG:${seg}(OUT)`,
      fullLabel: `7-Seg ${seg} (Ext Output)`,
      directionTag: 'OUT',
      socketId: null,
      icPinName: null,
    };
  }

  if (terminalId === 'CLK:OUT') {
    return {
      shortLabel: 'CLK(IN)',
      fullLabel: 'CLK (Clock Source)',
      directionTag: 'IN',
      socketId: null,
      icPinName: null,
    };
  }
  if (terminalId === 'CLK:OUT_N') {
    return {
      shortLabel: '~CLK(IN)',
      fullLabel: '~CLK (Inv Clock)',
      directionTag: 'IN',
      socketId: null,
      icPinName: null,
    };
  }
  if (terminalId === 'PULSE:OUT') {
    return {
      shortLabel: 'PLS(IN)',
      fullLabel: 'PULSE (Pulse Gen)',
      directionTag: 'IN',
      socketId: null,
      icPinName: null,
    };
  }
  if (terminalId.startsWith('PWR:+5V:')) {
    return {
      shortLabel: '+5V(VCC)',
      fullLabel: '+5V Supply',
      directionTag: 'VCC',
      socketId: null,
      icPinName: null,
    };
  }
  if (terminalId.startsWith('PWR:GND:')) {
    return {
      shortLabel: 'GND',
      fullLabel: 'GND (0V)',
      directionTag: 'GND',
      socketId: null,
      icPinName: null,
    };
  }

  return {
    shortLabel: terminalId,
    fullLabel: terminalId,
    directionTag: 'IN',
    socketId: null,
    icPinName: null,
  };
}

export function classifyWireConnection(
  wire: Wire,
  placedICs: PlacedIC[]
): WireClassificationInfo {
  const a = describeTerminalEndpoint(wire.from, placedICs);
  const b = describeTerminalEndpoint(wire.to, placedICs);

  let category: WireConnectionCategory = 'EXT-LINK';
  let categoryLabel = 'External Link';

  if (a.socketId && b.socketId) {
    if (a.socketId === b.socketId) {
      category = 'INTER-GATE';
      categoryLabel = 'Inter-Gate (Intra-IC)';
    } else {
      category = 'INTER-IC';
      categoryLabel = 'Inter-IC Gate Link';
    }
  } else if (a.socketId || b.socketId) {
    const extEnd = a.socketId ? b : a;
    if (extEnd.directionTag === 'OUT') {
      category = 'EXT-OUT';
      categoryLabel = 'Gate Out → Ext Output';
    } else {
      category = 'EXT-IN';
      categoryLabel = 'Ext Input → Gate In';
    }
  }

  return {
    category,
    categoryLabel,
    shortTag: `${category}: ${a.shortLabel}→${b.shortLabel}`,
    fromFormatted: a.fullLabel,
    toFormatted: b.fullLabel,
    summary: `${a.fullLabel} → ${b.fullLabel}`,
  };
}

export interface TerminalConnectionCallout {
  badgeText: string;
  directionTag: 'IN' | 'OUT' | 'I/O' | 'VCC' | 'GND' | 'NC';
  category: WireConnectionCategory;
  peerCount: number;
  tooltipSummary: string;
}

/**
 * Returns the connected pin label and direction to display directly at a connected terminal
 * on the trainer board (e.g., on SW0..15, L0..15, DISP1, CLK, or ZIF pins).
 */
export function getTerminalConnectionCallout(
  terminalId: TerminalId,
  wires: Wire[],
  placedICs: PlacedIC[]
): TerminalConnectionCallout | null {
  const connectedWires = wires.filter((w) => w.from === terminalId || w.to === terminalId);
  if (connectedWires.length === 0) return null;

  const peers = connectedWires.map((w) => {
    const peerId = w.from === terminalId ? w.to : w.from;
    const ep = describeTerminalEndpoint(peerId, placedICs);
    const cls = classifyWireConnection(w, placedICs);
    return { peerId, ep, cls };
  });

  const primary = peers[0];
  const extra = peers.length > 1 ? `+${peers.length - 1}` : '';

  return {
    badgeText: `${primary.ep.shortLabel}${extra}`,
    directionTag: primary.ep.directionTag,
    category: primary.cls.category,
    peerCount: peers.length,
    tooltipSummary: peers.map((p) => `${p.cls.categoryLabel}: ${p.ep.fullLabel}`).join(' | '),
  };
}

