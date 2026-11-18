import { ICCategory, ICDefinition } from '../types/circuit';
import { IC_DEFINITIONS } from './definitions';

export const IC_MAP: Record<string, ICDefinition> = Object.fromEntries(
  IC_DEFINITIONS.map((ic) => [ic.partNumber, ic])
);

export function getICDefinition(partNumber: string): ICDefinition | undefined {
  return IC_MAP[partNumber];
}

export function getAllICDefinitions(): ICDefinition[] {
  return IC_DEFINITIONS;
}

export function filterICDefinitions(query: string, category: ICCategory | 'all'): ICDefinition[] {
  const q = query.trim().toLowerCase();
  return IC_DEFINITIONS.filter((ic) => {
    if (category !== 'all' && ic.category !== category) return false;
    if (!q) return true;
    return (
      ic.partNumber.toLowerCase().includes(q) ||
      ic.name.toLowerCase().includes(q) ||
      ic.description.toLowerCase().includes(q) ||
      ic.family.toLowerCase().includes(q)
    );
  });
}

export function canInsertIntoZif(
  partNumber: string,
  socketId: 'ZIF1' | 'ZIF2' | 'ZIF3' | 'ZIF4' | 'ZIF5' = 'ZIF1'
): { ok: boolean; reason?: string } {
  const ic = getICDefinition(partNumber);
  if (!ic) return { ok: false, reason: `Unknown IC part number: ${partNumber}` };

  if (socketId === 'ZIF5') {
    if (ic.pinCount === 24) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `${ic.partNumber} (${ic.packageType}, ${ic.pinCount} pins) is a ${ic.pinCount}-pin IC. Insert it into 16-pin sockets ZIF-1, ZIF-2, ZIF-3, or ZIF-4 (ZIF-5 is the 24-pin RAM socket).`,
    };
  }

  if (ic.pinCount === 14 || ic.pinCount === 16) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `${ic.partNumber} (${ic.packageType}, ${ic.pinCount} pins) exceeds the 16-pin ZIF socket capacity. Insert it into ZIF-5 (24-Pin RAM Socket).`,
  };
}

export const BREADBOARD_COLS = 40;

export function canPlaceOnBreadboard(
  partNumber: string,
  startCol: number,
  existingBreadboardICs: Array<{ instanceId: string; partNumber: string; startCol: number }>,
  ignoreInstanceId?: string
): { ok: boolean; reason?: string } {
  const ic = getICDefinition(partNumber);
  if (!ic) return { ok: false, reason: `Unknown IC part number: ${partNumber}` };
  const span = ic.pinCount / 2;
  if (startCol < 1 || startCol + span - 1 > BREADBOARD_COLS) {
    return {
      ok: false,
      reason: `${ic.partNumber} requires ${span} columns across the center gap (cols 1..${BREADBOARD_COLS}).`,
    };
  }
  const endCol = startCol + span - 1;
  for (const other of existingBreadboardICs) {
    if (ignoreInstanceId && other.instanceId === ignoreInstanceId) continue;
    const otherDef = getICDefinition(other.partNumber);
    if (!otherDef) continue;
    const otherEnd = other.startCol + otherDef.pinCount / 2 - 1;
    if (!(endCol < other.startCol || startCol > otherEnd)) {
      return {
        ok: false,
        reason: `Column range ${startCol}–${endCol} overlaps with ${other.partNumber} at columns ${other.startCol}–${otherEnd}.`,
      };
    }
  }
  return { ok: true };
}

export const CATEGORY_LABELS: Record<ICCategory, string> = {
  'logic-gates': 'Basic Logic Gates',
  combinational: 'Combinational Logic',
  sequential: 'Sequential Logic',
  memory: 'Memory',
};
