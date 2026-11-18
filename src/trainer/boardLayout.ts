import { TerminalId, WireColor, ZIFSocketId } from '../types/circuit';

export const BOARD_WIDTH = 1400;
export const BOARD_HEIGHT = 860;

export interface TerminalGeometry {
  id: TerminalId;
  x: number;
  y: number;
  label: string;
  group: 'power' | 'switch' | 'led' | 'clock' | 'pulse' | 'display' | 'zif';
  radius: number;
  socketId?: ZIFSocketId;
  socketPin?: number;
}

export const WIRE_COLOR_HEX: Record<WireColor, { stroke: string; highlight: string; label: string }> = {
  red: { stroke: '#B83A32', highlight: '#DF5D55', label: '+5V (Red)' },
  black: { stroke: '#1D2126', highlight: '#454D56', label: 'GND (Black)' },
  yellow: { stroke: '#C6972C', highlight: '#E4B84D', label: 'Data (Yellow)' },
  blue: { stroke: '#3C6E91', highlight: '#5D92B8', label: 'Clock (Blue)' },
  green: { stroke: '#4A785D', highlight: '#6CA181', label: 'Signal (Green)' },
};

export const ALL_ZIF_SOCKETS: ZIFSocketId[] = ['ZIF1', 'ZIF2', 'ZIF3', 'ZIF4', 'ZIF5'];

export interface ZifSocketLayout {
  socketId: ZIFSocketId;
  index: number;
  maxPins: 16 | 24;
  rows: 8 | 12;
  baseX: number;
  width: number;
  topY: number;
  height: number;
  leftTermX: number;
  rightTermX: number;
  bodyX: number;
  bodyW: number;
  cradleTopY: number;
  cradleH: number;
  pinStartY: number;
  pinStepY: number;
  vccTermId: TerminalId;
  vccX: number;
  vccY: number;
  gndTermId: TerminalId;
  gndX: number;
  gndY: number;
}

export function getZifLayout(socketId: ZIFSocketId): ZifSocketLayout {
  const index = ALL_ZIF_SOCKETS.indexOf(socketId);
  const is24 = socketId === 'ZIF5';
  const width = 254;
  const gap = 16.5;
  const baseX = 32 + index * (width + gap);
  const topY = 232;
  const height = 414;

  const pinStartY = is24 ? 306 : 314;
  const pinStepY = is24 ? 24.8 : 36;
  const cradleTopY = is24 ? 290 : 294;
  const cradleH = is24 ? 304 : 292;

  return {
    socketId,
    index,
    maxPins: is24 ? 24 : 16,
    rows: is24 ? 12 : 8,
    baseX,
    width,
    topY,
    height,
    leftTermX: baseX + 24,
    rightTermX: baseX + width - 24,
    bodyX: baseX + 91,
    bodyW: 72,
    cradleTopY,
    cradleH,
    pinStartY,
    pinStepY,
    vccTermId: `PWR:+5V:${index}`,
    vccX: baseX + width / 2,
    vccY: topY + 36,
    gndTermId: `PWR:GND:${index}`,
    gndX: baseX + width / 2,
    gndY: topY + height - 20,
  };
}

export const DUSTBIN_LAYOUT = {
  x: 1252,
  y: 46,
  width: 116,
  height: 174,
  centerX: 1310,
  centerY: 138,
};

function buildTerminalRegistry(): Record<TerminalId, TerminalGeometry> {
  const map: Record<TerminalId, TerminalGeometry> = {};
  const add = (t: TerminalGeometry) => {
    map[t.id] = t;
  };

  // Clock & Pulse terminals
  add({ id: 'CLK:OUT', x: 468, y: 108, label: 'CLK OUT', group: 'clock', radius: 8 });
  add({ id: 'CLK:OUT_N', x: 506, y: 108, label: '~CLK OUT', group: 'clock', radius: 8 });
  add({ id: 'PULSE:OUT', x: 487, y: 186, label: 'PULSE OUT', group: 'pulse', radius: 8 });

  // Single Onboard 7-Segment Display (DISP1)
  const segRow1 = ['a', 'b', 'c', 'd', 'e'] as const;
  const segRow2 = ['f', 'g', 'dp', 'CA'] as const;
  segRow1.forEach((seg, idx) => {
    add({
      id: `DISP1:${seg}`,
      x: 572 + idx * 38,
      y: 168,
      label: `DISP1 ${seg}`,
      group: 'display',
      radius: 7.0,
    });
  });
  segRow2.forEach((seg, idx) => {
    add({
      id: `DISP1:${seg}`,
      x: 591 + idx * 38,
      y: 200,
      label: `DISP1 ${seg}`,
      group: 'display',
      radius: 7.0,
    });
  });

  // 16 Output LEDs (2 rows of 8, expanded & optimized spacing across x = 768..1240)
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    add({
      id: `LED:${i}`,
      x: 804 + col * 57,
      y: row === 0 ? 112 : 192,
      label: `OUT ${i}`,
      group: 'led',
      radius: 7.5,
    });
  }

  // 5 ZIF Sockets: ZIF1..ZIF4 (16-pin) and ZIF5 (24-pin RAM), each with built-in +5V (top) and GND (bottom)
  for (const sock of ALL_ZIF_SOCKETS) {
    const layout = getZifLayout(sock);

    // Integrated +5V (top center) and GND (bottom center) inside the ZIF socket
    add({
      id: layout.vccTermId,
      x: layout.vccX,
      y: layout.vccY,
      label: `+5V (${ layout.index + 1 })`,
      group: 'power',
      radius: 8.5,
      socketId: sock,
    });
    add({
      id: layout.gndTermId,
      x: layout.gndX,
      y: layout.gndY,
      label: `GND (${ layout.index + 1 })`,
      group: 'power',
      radius: 8.5,
      socketId: sock,
    });

    for (let row = 0; row < layout.rows; row++) {
      const y = layout.pinStartY + row * layout.pinStepY;
      const leftPin = row + 1;
      const rightPin = layout.maxPins - row;
      add({
        id: `${sock}:${leftPin}`,
        x: layout.leftTermX,
        y,
        label: `${sock} Pin ${leftPin}`,
        group: 'zif',
        radius: layout.maxPins === 24 ? 6.2 : 7.0,
        socketId: sock,
        socketPin: leftPin,
      });
      add({
        id: `${sock}:${rightPin}`,
        x: layout.rightTermX,
        y,
        label: `${sock} Pin ${rightPin}`,
        group: 'zif',
        radius: layout.maxPins === 24 ? 6.2 : 7.0,
        socketId: sock,
        socketPin: rightPin,
      });
    }
  }

  // 16 Input Switches along bottom bank
  for (let i = 0; i < 16; i++) {
    add({
      id: `SW:${i}`,
      x: 74 + i * 83.2,
      y: 696,
      label: `IN ${i} (SW${i})`,
      group: 'switch',
      radius: 8,
    });
  }

  return map;
}

export const TERMINAL_REGISTRY = buildTerminalRegistry();
export const ALL_TERMINAL_LIST = Object.values(TERMINAL_REGISTRY);

export function getTerminalGeometry(id: TerminalId): TerminalGeometry | undefined {
  return TERMINAL_REGISTRY[id];
}

/**
 * Generates a realistic, smooth physical patch-cord Bezier path
 * that routes along inter-socket gutters and channels so pin numbers and labels stay clear.
 */
export function computeWirePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  kind: 'patch-cord' | 'jumper',
  indexSeed = 0,
  customOffset?: { dx: number; dy: number }
): { d: string; midX: number; midY: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const ox = customOffset?.dx ?? 0;
  const oy = customOffset?.dy ?? 0;

  if (kind === 'jumper' || dist < 130) {
    // Compact local jumper/supply arch (e.g. built-in ZIF +5V/GND to adjacent IC pin)
    const sideBend = Math.abs(dx) < 95 ? (to.x >= from.x ? 26 : -26) : 0;
    const arch = Math.min(28, Math.max(12, dist * 0.2));
    const cx1 = from.x + dx * 0.28 + sideBend + ox;
    const cy1 = from.y + dy * 0.28 - arch * 0.4 + oy;
    const cx2 = from.x + dx * 0.72 + sideBend + ox;
    const cy2 = from.y + dy * 0.72 + arch * 0.4 + oy;
    const midX = 0.125 * from.x + 0.375 * cx1 + 0.375 * cx2 + 0.125 * to.x;
    const midY = 0.125 * from.y + 0.375 * cy1 + 0.375 * cy2 + 0.125 * to.y;
    return {
      d: `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`,
      midX,
      midY,
    };
  }

  const lane = ((indexSeed % 5) - 2) * 5;
  const isZifArea = (p: { x: number; y: number }) => p.y >= 245 && p.y <= 645;
  const isTopBank = (p: { x: number; y: number }) => p.y < 230;
  const isBottomBank = (p: { x: number; y: number }) => p.y > 660;

  // Find nearest vertical inter-socket gutter X for a point inside the ZIF bay
  const nearestGutterX = (px: number): number => {
    const gutters = [22, 294, 565, 835, 1106, 1378];
    let best = gutters[0];
    let bestDist = Math.abs(px - best);
    for (const g of gutters) {
      const d = Math.abs(px - g);
      if (d < bestDist) {
        best = g;
        bestDist = d;
      }
    }
    return best;
  };

  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if ((isZifArea(from) && isTopBank(to)) || (isZifArea(to) && isTopBank(from))) {
    const zifPt = isZifArea(from) ? from : to;
    const topPt = isZifArea(from) ? to : from;
    const gutterX = nearestGutterX(zifPt.x);
    const channelY = 224 + lane * 0.6;
    const cpZif = { x: gutterX + lane * 0.5 + ox, y: Math.min(zifPt.y - 20, channelY + 45) + oy };
    const cpTop = { x: (gutterX + topPt.x) * 0.5 + ox, y: channelY - 18 + oy };
    if (isZifArea(from)) {
      c1x = cpZif.x;
      c1y = cpZif.y;
      c2x = cpTop.x;
      c2y = cpTop.y;
    } else {
      c1x = cpTop.x;
      c1y = cpTop.y;
      c2x = cpZif.x;
      c2y = cpZif.y;
    }
  } else if ((isZifArea(from) && isBottomBank(to)) || (isZifArea(to) && isBottomBank(from))) {
    const zifPt = isZifArea(from) ? from : to;
    const botPt = isZifArea(from) ? to : from;
    const gutterX = nearestGutterX(zifPt.x);
    const cpZif = { x: gutterX + lane * 0.5 + ox, y: Math.max(zifPt.y + 24, 635) + oy };
    const cpBot = { x: (gutterX + botPt.x) * 0.5 + ox, y: 654 + lane * 0.5 + oy };
    if (isZifArea(from)) {
      c1x = cpZif.x;
      c1y = cpZif.y;
      c2x = cpBot.x;
      c2y = cpBot.y;
    } else {
      c1x = cpBot.x;
      c1y = cpBot.y;
      c2x = cpZif.x;
      c2y = cpZif.y;
    }
  } else {
    const sag = Math.min(95, Math.max(22, dist * 0.18)) + ((indexSeed % 5) - 2) * 6;
    const spread = ((indexSeed % 7) - 3) * 7;
    c1x = from.x + dx * 0.25 + spread + ox;
    c1y = from.y + Math.max(18, dy * 0.25) + sag * 0.55 + oy;
    c2x = from.x + dx * 0.75 - spread + ox;
    c2y = to.y + Math.max(18, -dy * 0.25) + sag * 0.55 + oy;
  }

  const midX = 0.125 * from.x + 0.375 * c1x + 0.375 * c2x + 0.125 * to.x;
  const midY = 0.125 * from.y + 0.375 * c1y + 0.375 * c2y + 0.125 * to.y;

  return {
    d: `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${cy2Fix(c2y)}, ${to.x} ${to.y}`,
    midX,
    midY,
  };
}

function cy2Fix(v: number): number {
  return v;
}
