import { ICInstanceRuntimeState, LogicLevel } from '../types/circuit';

function inv(a: LogicLevel): LogicLevel {
  if (a === 0) return 1;
  if (a === 1) return 0;
  return 'X';
}

/**
 * Evaluates a multi-input NAND gate.
 * In real 74xx TTL hardware, if at least one input of a gate is wired (0 or 1)
 * and remaining input(s) of that gate are left unconnected ('Z'), open TTL emitter
 * inputs float HIGH (1). If any input is 0, NAND output is 1 immediately.
 */
function nandN(inputs: LogicLevel[], ttlFloatHigh = true): LogicLevel {
  if (inputs.some((v) => v === 0)) return 1;
  const anyConnected = inputs.some((v) => v === 0 || v === 1);
  const resolved = inputs.map((v) => (v === 'Z' && ttlFloatHigh && anyConnected ? 1 : v));
  if (resolved.some((v) => v === 0)) return 1;
  if (resolved.every((v) => v === 1)) return 0;
  return 'X';
}

function and2(a: LogicLevel, b: LogicLevel, ttlFloatHigh = true): LogicLevel {
  if (a === 0 || b === 0) return 0;
  const anyConnected = a === 1 || b === 1;
  const ra: LogicLevel = a === 'Z' && ttlFloatHigh && anyConnected ? 1 : a;
  const rb: LogicLevel = b === 'Z' && ttlFloatHigh && anyConnected ? 1 : b;
  if (ra === 1 && rb === 1) return 1;
  return 'X';
}

function or2(a: LogicLevel, b: LogicLevel): LogicLevel {
  if (a === 1 || b === 1) return 1;
  const anyConnected = a === 0 || b === 0;
  const ra: LogicLevel = a === 'Z' && anyConnected ? 0 : a;
  const rb: LogicLevel = b === 'Z' && anyConnected ? 0 : b;
  if (ra === 0 && rb === 0) return 0;
  return 'X';
}

function norN(inputs: LogicLevel[]): LogicLevel {
  if (inputs.some((v) => v === 1)) return 0;
  const anyConnected = inputs.some((v) => v === 0 || v === 1);
  const resolved = inputs.map((v) => (v === 'Z' && anyConnected ? 0 : v));
  if (resolved.some((v) => v === 1)) return 0;
  if (resolved.every((v) => v === 0)) return 1;
  return 'X';
}

function xor2(a: LogicLevel, b: LogicLevel): LogicLevel {
  const anyConnected = a === 0 || a === 1 || b === 0 || b === 1;
  const ra = a === 'Z' && anyConnected ? 0 : a;
  const rb = b === 'Z' && anyConnected ? 0 : b;
  if ((ra === 0 || ra === 1) && (rb === 0 || rb === 1)) {
    return ra !== rb ? 1 : 0;
  }
  return 'X';
}

function xnor2(a: LogicLevel, b: LogicLevel): LogicLevel {
  const anyConnected = a === 0 || a === 1 || b === 0 || b === 1;
  const ra = a === 'Z' && anyConnected ? 0 : a;
  const rb = b === 'Z' && anyConnected ? 0 : b;
  if ((ra === 0 || ra === 1) && (rb === 0 || rb === 1)) {
    return ra === rb ? 1 : 0;
  }
  return 'X';
}

function isBinary(v: LogicLevel): v is 0 | 1 {
  return v === 0 || v === 1;
}

// Helper for TTL control/data pins where unconnected ('Z') assumes default level
function withDefault(v: LogicLevel, fallback: 0 | 1): LogicLevel {
  return v === 'Z' ? fallback : v;
}

// TI SN7446A / SN7447A BCD-to-7-Segment active-low segment patterns (a, b, c, d, e, f, g)
// 0 = Segment ON (current sinking), 1 = Segment OFF
const BCD_7SEG_ACTIVE_LOW: Record<number, [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1]> = {
  0: [0, 0, 0, 0, 0, 0, 1],
  1: [1, 0, 0, 1, 1, 1, 1],
  2: [0, 0, 1, 0, 0, 1, 0],
  3: [0, 0, 0, 0, 1, 1, 0],
  4: [1, 0, 0, 1, 1, 0, 0],
  5: [0, 1, 0, 0, 1, 0, 0],
  6: [1, 1, 0, 0, 0, 0, 0], // SN7446A/7447A datasheet: segment a is OFF for 6
  7: [0, 0, 0, 1, 1, 1, 1],
  8: [0, 0, 0, 0, 0, 0, 0],
  9: [0, 0, 0, 1, 1, 0, 0], // SN7446A/7447A datasheet: segment d is OFF for 9
  10: [1, 1, 1, 0, 0, 1, 0],
  11: [1, 1, 0, 0, 1, 1, 0],
  12: [1, 0, 1, 1, 1, 0, 0],
  13: [0, 1, 1, 0, 1, 0, 0],
  14: [1, 1, 1, 0, 0, 0, 0],
  15: [1, 1, 1, 1, 1, 1, 1], // Blank
};

export interface ICEvalInput {
  partNumber: string;
  pinInputs: Record<number, LogicLevel>;
  runtime: ICInstanceRuntimeState;
  commitSequential: boolean;
}

export interface ICEvalOutput {
  drivenPins: Record<number, LogicLevel>;
}

/**
 * Evaluates a single IC instance given its pin net values and persistent state.
 * Strictly models the internal gate/latch/decoder/memory architecture of all 25 ICs.
 * When powered === false, all output pins are High-Z ('Z') (power off / unpowered).
 */
export function evaluateIC({
  partNumber,
  pinInputs,
  runtime,
  commitSequential,
}: ICEvalInput): ICEvalOutput {
  if (!runtime.powered) {
    return { drivenPins: {} };
  }

  const p = (n: number): LogicLevel => pinInputs[n] ?? 'Z';
  const out: Record<number, LogicLevel> = {};

  switch (partNumber) {
    // ======================== GROUP A: BASIC LOGIC GATES ========================
    case '7400': {
      // Quad 2-Input NAND Gate (SN74LS00)
      out[3] = nandN([p(1), p(2)]);
      out[6] = nandN([p(4), p(5)]);
      out[8] = nandN([p(9), p(10)]);
      out[11] = nandN([p(12), p(13)]);
      break;
    }
    case '7402': {
      // Quad 2-Input NOR Gate (SN74LS02: 1Y=1, 1A=2, 1B=3 | 2Y=4, 2A=5, 2B=6 | 3Y=10, 3A=8, 3B=9 | 4Y=13, 4A=11, 4B=12)
      out[1] = norN([p(2), p(3)]);
      out[4] = norN([p(5), p(6)]);
      out[10] = norN([p(8), p(9)]);
      out[13] = norN([p(11), p(12)]);
      break;
    }
    case '7404': {
      // Hex Inverter (SN74LS04)
      out[2] = inv(p(1));
      out[4] = inv(p(3));
      out[6] = inv(p(5));
      out[8] = inv(p(9));
      out[10] = inv(p(11));
      out[12] = inv(p(13));
      break;
    }
    case '7408': {
      // Quad 2-Input AND Gate (SN74LS08)
      out[3] = and2(p(1), p(2));
      out[6] = and2(p(4), p(5));
      out[8] = and2(p(9), p(10));
      out[11] = and2(p(12), p(13));
      break;
    }
    case '7410': {
      // Triple 3-Input NAND Gate (SN74LS10)
      out[12] = nandN([p(1), p(2), p(13)]);
      out[6] = nandN([p(3), p(4), p(5)]);
      out[8] = nandN([p(9), p(10), p(11)]);
      break;
    }
    case '7420': {
      // Dual 4-Input NAND Gate (SN74LS20)
      out[6] = nandN([p(1), p(2), p(4), p(5)]);
      out[8] = nandN([p(9), p(10), p(12), p(13)]);
      break;
    }
    case '7427': {
      // Triple 3-Input NOR Gate (SN74LS27)
      out[12] = norN([p(1), p(2), p(13)]);
      out[6] = norN([p(3), p(4), p(5)]);
      out[8] = norN([p(9), p(10), p(11)]);
      break;
    }
    case '7432': {
      // Quad 2-Input OR Gate (SN74LS32)
      out[3] = or2(p(1), p(2));
      out[6] = or2(p(4), p(5));
      out[8] = or2(p(9), p(10));
      out[11] = or2(p(12), p(13));
      break;
    }
    case '7486': {
      // Quad 2-Input XOR Gate (SN74LS86: internal 4-NAND / AOI XOR structure)
      out[3] = xor2(p(1), p(2));
      out[6] = xor2(p(4), p(5));
      out[8] = xor2(p(9), p(10));
      out[11] = xor2(p(12), p(13));
      break;
    }
    case '4077': {
      // CMOS Quad 2-Input XNOR Gate (CD4077B: 1Y=3, 2Y=4, 3Y=10, 4Y=11)
      out[3] = xnor2(p(1), p(2));
      out[4] = xnor2(p(5), p(6));
      out[10] = xnor2(p(8), p(9));
      out[11] = xnor2(p(12), p(13));
      break;
    }

    // ======================== GROUP B: COMBINATIONAL ==========================
    case '7483': {
      // 4-Bit Binary Full Adder with Fast Carry (SN74LS83A)
      // A: 10(A1), 8(A2), 3(A3), 1(A4) | B: 11(B1), 7(B2), 4(B3), 16(B4) | C0: 13
      // Sum: 9(S1), 6(S2), 2(S3), 15(S4) | C4: 14
      const rawPins = [p(10), p(8), p(3), p(1), p(11), p(7), p(4), p(16), p(13)];
      const bitsA = [withDefault(p(10), 0), withDefault(p(8), 0), withDefault(p(3), 0), withDefault(p(1), 0)];
      const bitsB = [withDefault(p(11), 0), withDefault(p(7), 0), withDefault(p(4), 0), withDefault(p(16), 0)];
      const cin = withDefault(p(13), 0);

      if (rawPins.some((v) => v === 'X')) {
        out[9] = out[6] = out[2] = out[15] = out[14] = 'X';
      } else if ([...bitsA, ...bitsB, cin].every(isBinary)) {
        // Gate-level stage-by-stage Full Adder propagation (FA1 -> FA2 -> FA3 -> FA4)
        let carry = cin as number;
        const sumPins = [9, 6, 2, 15];
        for (let i = 0; i < 4; i++) {
          const ai = bitsA[i] as number;
          const bi = bitsB[i] as number;
          const si = ai ^ bi ^ carry;
          carry = (ai & bi) | (ai & carry) | (bi & carry);
          out[sumPins[i]] = (si & 1) as 0 | 1;
        }
        out[14] = (carry & 1) as 0 | 1;
      } else {
        out[9] = out[6] = out[2] = out[15] = out[14] = 'X';
      }
      break;
    }

    case '7485': {
      // 4-Bit Magnitude Comparator (SN74LS85)
      // A: 10(A0), 12(A1), 13(A2), 15(A3) | B: 9(B0), 11(B1), 14(B2), 1(B3)
      // Cascade in: 2(IA<B), 3(IA=B), 4(IA>B) | Out: 5(OA>B), 6(OA=B), 7(OA<B)
      const aBits = [withDefault(p(10), 0), withDefault(p(12), 0), withDefault(p(13), 0), withDefault(p(15), 0)];
      const bBits = [withDefault(p(9), 0), withDefault(p(11), 0), withDefault(p(14), 0), withDefault(p(1), 0)];
      if (aBits.every(isBinary) && bBits.every(isBinary)) {
        const aVal =
          (aBits[0] as number) +
          ((aBits[1] as number) << 1) +
          ((aBits[2] as number) << 2) +
          ((aBits[3] as number) << 3);
        const bVal =
          (bBits[0] as number) +
          ((bBits[1] as number) << 1) +
          ((bBits[2] as number) << 2) +
          ((bBits[3] as number) << 3);
        if (aVal > bVal) {
          out[5] = 1;
          out[6] = 0;
          out[7] = 0;
        } else if (aVal < bVal) {
          out[5] = 0;
          out[6] = 0;
          out[7] = 1;
        } else {
          // A == B: check cascade inputs (IA<B=2, IA=B=3, IA>B=4)
          // If all cascade inputs are unconnected ('Z'), default to standalone comparator (IA=B = 1)
          const rawLt = p(2);
          const rawEq = p(3);
          const rawGt = p(4);
          const allUnconnected = rawLt === 'Z' && rawEq === 'Z' && rawGt === 'Z';
          const iLt = allUnconnected ? 0 : withDefault(rawLt, 0);
          const iEq = allUnconnected ? 1 : withDefault(rawEq, 0);
          const iGt = allUnconnected ? 0 : withDefault(rawGt, 0);

          if (iEq === 1) {
            out[5] = 0;
            out[6] = 1;
            out[7] = 0;
          } else if (iEq === 0) {
            if (iGt === 1 && iLt === 0) {
              out[5] = 1;
              out[6] = 0;
              out[7] = 0;
            } else if (iLt === 1 && iGt === 0) {
              out[5] = 0;
              out[6] = 0;
              out[7] = 1;
            } else if (iLt === 1 && iGt === 1) {
              out[5] = 0;
              out[6] = 0;
              out[7] = 0;
            } else if (iLt === 0 && iGt === 0) {
              out[5] = 1;
              out[6] = 0;
              out[7] = 1;
            } else {
              out[5] = out[6] = out[7] = 'X';
            }
          } else {
            out[5] = out[6] = out[7] = 'X';
          }
        }
      } else {
        out[5] = out[6] = out[7] = 'X';
      }
      break;
    }

    case '74138': {
      // 3-Line to 8-Line Decoder / Demultiplexer (SN74LS138)
      // 1:A, 2:B, 3:C | 4:~G2A, 5:~G2B, 6:G1 | outputs ~Y0..~Y7 -> 15,14,13,12,11,10,9,7
      const outPins = [15, 14, 13, 12, 11, 10, 9, 7];
      const g1 = withDefault(p(6), 1);
      const g2a = withDefault(p(4), 0);
      const g2b = withDefault(p(5), 0);
      if (g1 === 0 || g2a === 1 || g2b === 1) {
        for (const op of outPins) out[op] = 1;
      } else if (g1 === 1 && g2a === 0 && g2b === 0) {
        const a = withDefault(p(1), 0);
        const b = withDefault(p(2), 0);
        const c = withDefault(p(3), 0);
        if (isBinary(a) && isBinary(b) && isBinary(c)) {
          const idx = a + (b << 1) + (c << 2);
          outPins.forEach((op, i) => {
            out[op] = i === idx ? 0 : 1;
          });
        } else {
          for (const op of outPins) out[op] = 'X';
        }
      } else {
        for (const op of outPins) out[op] = 'X';
      }
      break;
    }

    case '74139': {
      // Dual 2-Line to 4-Line Decoder / Demultiplexer (SN74LS139)
      // Decoder 1: ~1G(1), 1A(2), 1B(3), outputs 4,5,6,7
      // Decoder 2: ~2G(15), 2A(14), 2B(13), outputs 12,11,10,9
      const evalHalf = (enRaw: LogicLevel, aRaw: LogicLevel, bRaw: LogicLevel, pins: number[]) => {
        const en = withDefault(enRaw, 0);
        const a = withDefault(aRaw, 0);
        const b = withDefault(bRaw, 0);
        if (en === 1) {
          pins.forEach((op) => (out[op] = 1));
        } else if (en === 0) {
          if (isBinary(a) && isBinary(b)) {
            const idx = a + (b << 1);
            pins.forEach((op, i) => {
              out[op] = i === idx ? 0 : 1;
            });
          } else {
            pins.forEach((op) => (out[op] = 'X'));
          }
        } else {
          pins.forEach((op) => (out[op] = 'X'));
        }
      };
      evalHalf(p(1), p(2), p(3), [4, 5, 6, 7]);
      evalHalf(p(15), p(14), p(13), [12, 11, 10, 9]);
      break;
    }

    case '7446':
    case '7447': {
      // BCD-to-Seven-Segment Decoder/Driver (SN7446A / SN7447A)
      // 7:A, 1:B, 2:C, 6:D | 3:~LT, 4:~BI/~RBO, 5:~RBI | outputs a=13, b=12, c=11, d=10, e=9, f=15, g=14
      const segPins = [13, 12, 11, 10, 9, 15, 14]; // a, b, c, d, e, f, g
      // In real TTL 7446/7447, unconnected ~LT, ~BI/~RBO, ~RBI float HIGH (1)
      const lt = withDefault(p(3), 1);
      const bi = withDefault(p(4), 1);
      const rbi = withDefault(p(5), 1);
      const a = withDefault(p(7), 0);
      const b = withDefault(p(1), 0);
      const c = withDefault(p(2), 0);
      const d = withDefault(p(6), 0);

      // Blanking input active-low overrides all
      if (bi === 0) {
        segPins.forEach((sp) => (out[sp] = 1)); // all segments OFF
        break;
      }

      if (lt === 0) {
        // Lamp Test: all segments ON (active-low 0)
        segPins.forEach((sp) => (out[sp] = 0));
        break;
      }

      if (lt === 1) {
        if (isBinary(a) && isBinary(b) && isBinary(c) && isBinary(d)) {
          const val = a + (b << 1) + (c << 2) + (d << 3);
          if (val === 0 && rbi === 0) {
            // Ripple blanking: blank digit 0 and pull ~BI/~RBO low
            segPins.forEach((sp) => (out[sp] = 1));
            out[4] = 0;
          } else if (val === 0 && !isBinary(rbi)) {
            segPins.forEach((sp) => (out[sp] = 'X'));
          } else {
            const pattern = BCD_7SEG_ACTIVE_LOW[val];
            segPins.forEach((sp, idx) => {
              out[sp] = pattern[idx];
            });
          }
        } else {
          segPins.forEach((sp) => (out[sp] = 'X'));
        }
      } else {
        segPins.forEach((sp) => (out[sp] = 'X'));
      }
      break;
    }

    case '74148': {
      // 8-Line to 3-Line Octal Priority Encoder (SN74LS148)
      // ~EI=5; ~I0..~I7 = 10,11,12,13,1,2,3,4; ~A2=6, ~A1=7, ~A0=9, ~GS=14, ~EO=15
      // Unconnected TTL active-low inputs float HIGH (1 = inactive); ~EI defaults to 0 if left open
      const ei = withDefault(p(5), 0);
      if (ei === 1) {
        out[6] = out[7] = out[9] = out[14] = out[15] = 1;
      } else if (ei === 0) {
        const inputs = [
          withDefault(p(10), 1),
          withDefault(p(11), 1),
          withDefault(p(12), 1),
          withDefault(p(13), 1),
          withDefault(p(1), 1),
          withDefault(p(2), 1),
          withDefault(p(3), 1),
          withDefault(p(4), 1),
        ];
        let highestActive = -1;
        let hasUnknownBeforeMatch = false;
        for (let i = 7; i >= 0; i--) {
          if (inputs[i] === 0) {
            highestActive = i;
            break;
          }
          if (!isBinary(inputs[i])) {
            hasUnknownBeforeMatch = true;
            break;
          }
        }
        if (hasUnknownBeforeMatch) {
          out[6] = out[7] = out[9] = out[14] = out[15] = 'X';
        } else if (highestActive >= 0) {
          out[6] = ((highestActive >> 2) & 1) === 1 ? 0 : 1;
          out[7] = ((highestActive >> 1) & 1) === 1 ? 0 : 1;
          out[9] = ((highestActive >> 0) & 1) === 1 ? 0 : 1;
          out[14] = 0; // ~GS active low
          out[15] = 1; // ~EO high
        } else {
          out[6] = out[7] = out[9] = 1;
          out[14] = 1;
          out[15] = 0; // ~EO active low when all inputs are 1
        }
      } else {
        out[6] = out[7] = out[9] = out[14] = out[15] = 'X';
      }
      break;
    }

    case '74153': {
      // Dual 4-Line to 1-Line Data Selector / Multiplexer (SN74LS153)
      // Select B(2), A(14)
      // Mux 1: ~1G(1), inputs 6(C0),5(C1),4(C2),3(C3), out 7(1Y)
      // Mux 2: ~2G(15), inputs 10(C0),11(C1),12(C2),13(C3), out 9(2Y)
      const selA = withDefault(p(14), 0);
      const selB = withDefault(p(2), 0);
      const evalMux = (enRaw: LogicLevel, dataPins: number[]): LogicLevel => {
        const en = withDefault(enRaw, 0);
        if (en === 1) return 0;
        if (en === 0) {
          if (isBinary(selA) && isBinary(selB)) {
            const idx = selA + (selB << 1);
            const v = withDefault(p(dataPins[idx]), 0);
            return isBinary(v) ? v : 'X';
          }
          return 'X';
        }
        return 'X';
      };
      out[7] = evalMux(p(1), [6, 5, 4, 3]);
      out[9] = evalMux(p(15), [10, 11, 12, 13]);
      break;
    }

    case '74151': {
      // 8-Line to 1-Line Data Selector / Multiplexer (SN74LS151)
      // ~G(7); C(9),B(10),A(11); D0..D7 = 4,3,2,1,15,14,13,12; Y=5, ~W=6
      const g = withDefault(p(7), 0);
      if (g === 1) {
        out[5] = 0;
        out[6] = 1;
      } else if (g === 0) {
        const a = withDefault(p(11), 0);
        const b = withDefault(p(10), 0);
        const c = withDefault(p(9), 0);
        if (isBinary(a) && isBinary(b) && isBinary(c)) {
          const idx = a + (b << 1) + (c << 2);
          const dataPins = [4, 3, 2, 1, 15, 14, 13, 12];
          const val = withDefault(p(dataPins[idx]), 0);
          if (isBinary(val)) {
            out[5] = val;
            out[6] = val === 1 ? 0 : 1;
          } else {
            out[5] = out[6] = 'X';
          }
        } else {
          out[5] = out[6] = 'X';
        }
      } else {
        out[5] = out[6] = 'X';
      }
      break;
    }

    // ======================== GROUP C: SEQUENTIAL =============================
    case '7474': {
      // Dual Positive-Edge-Triggered D Flip-Flop with Preset & Clear (SN74LS74A)
      // FF1: ~CLR=1, D=2, CLK=3, ~PRE=4, Q=5, ~Q=6
      // FF2: ~CLR=13, D=12, CLK=11, ~PRE=10, Q=9, ~Q=8
      if (!runtime.flipFlopState) {
        runtime.flipFlopState = {};
      }
      if (runtime.flipFlopState.q1 === undefined) runtime.flipFlopState.q1 = 0;
      if (runtime.flipFlopState.q2 === undefined) runtime.flipFlopState.q2 = 0;
      if (!runtime.prevClockState) {
        runtime.prevClockState = {};
      }
      const c1 = withDefault(p(3), 0);
      const c2 = withDefault(p(11), 0);
      if (runtime.prevClockState.clk1 === undefined) runtime.prevClockState.clk1 = c1;
      if (runtime.prevClockState.clk2 === undefined) runtime.prevClockState.clk2 = c2;

      const evalD = (
        key: 'q1' | 'q2',
        clkKey: 'clk1' | 'clk2',
        clrRaw: LogicLevel,
        preRaw: LogicLevel,
        clkRaw: LogicLevel,
        dRaw: LogicLevel
      ): [LogicLevel, LogicLevel] => {
        // In real TTL 7474, unconnected ~PRE and ~CLR float HIGH (1 = inactive)
        const clr = withDefault(clrRaw, 1);
        const pre = withDefault(preRaw, 1);
        const clk = withDefault(clkRaw, 0);
        const d = withDefault(dRaw, 0);

        if (pre === 0 && clr === 0) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 1;
            runtime.prevClockState![clkKey] = clk;
          }
          return [1, 1]; // non-complementary state per 7474 datasheet
        }
        if (pre === 0 && clr === 1) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 1;
            runtime.prevClockState![clkKey] = clk;
          }
          return [1, 0];
        }
        if (pre === 1 && clr === 0) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 0;
            runtime.prevClockState![clkKey] = clk;
          }
          return [0, 1];
        }
        if (pre === 1 && clr === 1) {
          const prevClk = runtime.prevClockState![clkKey];
          let q = runtime.flipFlopState![key];
          if (commitSequential && prevClk === 0 && clk === 1) {
            if (isBinary(d)) {
              q = d;
              runtime.flipFlopState![key] = q;
            }
          }
          if (commitSequential) {
            runtime.prevClockState![clkKey] = clk;
          }
          return [q, q === 1 ? 0 : 1];
        }
        if (commitSequential) {
          runtime.prevClockState![clkKey] = clk;
        }
        return ['X', 'X'];
      };

      const [q1, q1n] = evalD('q1', 'clk1', p(1), p(4), p(3), p(2));
      out[5] = q1;
      out[6] = q1n;
      const [q2, q2n] = evalD('q2', 'clk2', p(13), p(10), p(11), p(12));
      out[9] = q2;
      out[8] = q2n;
      break;
    }

    case '7476': {
      // Dual Negative-Edge Master-Slave JK Flip-Flop with Preset & Clear (SN7476 / SN74LS76A)
      // FF1: 1CLK=1, ~1PRE=2, ~1CLR=3, 1J=4, 1K=16, 1Q=15, ~1Q=14
      // FF2: 2CLK=6, ~2PRE=7, ~2CLR=8, 2J=9, 2K=12, 2Q=11, ~2Q=10
      if (!runtime.flipFlopState) {
        runtime.flipFlopState = {};
      }
      if (runtime.flipFlopState.q1 === undefined) runtime.flipFlopState.q1 = 0;
      if (runtime.flipFlopState.q2 === undefined) runtime.flipFlopState.q2 = 0;
      if (!runtime.prevClockState) {
        runtime.prevClockState = {};
      }
      const c1 = withDefault(p(1), 0);
      const c2 = withDefault(p(6), 0);
      if (runtime.prevClockState.clk1 === undefined) runtime.prevClockState.clk1 = c1;
      if (runtime.prevClockState.clk2 === undefined) runtime.prevClockState.clk2 = c2;

      const evalJK = (
        key: 'q1' | 'q2',
        clkKey: 'clk1' | 'clk2',
        clrRaw: LogicLevel,
        preRaw: LogicLevel,
        clkRaw: LogicLevel,
        jRaw: LogicLevel,
        kRaw: LogicLevel
      ): [LogicLevel, LogicLevel] => {
        // In real TTL 7476, unconnected ~PRE, ~CLR, J, K float HIGH (1)
        const clr = withDefault(clrRaw, 1);
        const pre = withDefault(preRaw, 1);
        const clk = withDefault(clkRaw, 0);
        const j = withDefault(jRaw, 1);
        const k = withDefault(kRaw, 1);

        if (pre === 0 && clr === 0) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 1;
            runtime.prevClockState![clkKey] = clk;
          }
          return [1, 1];
        }
        if (pre === 0 && clr === 1) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 1;
            runtime.prevClockState![clkKey] = clk;
          }
          return [1, 0];
        }
        if (pre === 1 && clr === 0) {
          if (commitSequential) {
            runtime.flipFlopState![key] = 0;
            runtime.prevClockState![clkKey] = clk;
          }
          return [0, 1];
        }
        if (pre === 1 && clr === 1) {
          const prevClk = runtime.prevClockState![clkKey];
          let q = runtime.flipFlopState![key];
          // Negative-edge triggered (1 -> 0)
          if (commitSequential && prevClk === 1 && clk === 0) {
            if (isBinary(j) && isBinary(k)) {
              if (j === 0 && k === 1) q = 0;
              else if (j === 1 && k === 0) q = 1;
              else if (j === 1 && k === 1) q = q === 1 ? 0 : 1;
              runtime.flipFlopState![key] = q;
            }
          }
          if (commitSequential) {
            runtime.prevClockState![clkKey] = clk;
          }
          return [q, q === 1 ? 0 : 1];
        }
        if (commitSequential) {
          runtime.prevClockState![clkKey] = clk;
        }
        return ['X', 'X'];
      };

      const [q1, q1n] = evalJK('q1', 'clk1', p(3), p(2), p(1), p(4), p(16));
      out[15] = q1;
      out[14] = q1n;
      const [q2, q2n] = evalJK('q2', 'clk2', p(8), p(7), p(6), p(9), p(12));
      out[11] = q2;
      out[10] = q2n;
      break;
    }

    case '7490': {
      // Decade Counter (Divide-by-2 and Divide-by-5 sections, SN74LS90)
      // Div-2: CKA(14) -> QA(12) on falling edge
      // Div-5: CKB(1) -> QB(9), QC(8), QD(11) on falling edge (0..4)
      // R0(1)=2, R0(2)=3 (active high reset to 0000; if only one R0 pin is wired and driven 1 while the other is 'Z', treat 'Z' as 1 per TTL)
      // R9(1)=6, R9(2)=7 (active high set to 1001)
      if (!runtime.flipFlopState) {
        runtime.flipFlopState = {};
      }
      const ff = runtime.flipFlopState as Record<string, number>;
      if (ff.qa === undefined) ff.qa = 0;
      if (ff.mod5Val === undefined) ff.mod5Val = 0;
      if (!runtime.prevClockState) {
        runtime.prevClockState = {};
      }
      const cka = withDefault(p(14), 0);
      // If CKB (pin 1) is externally wired, use p(1); if left unconnected ('Z'), auto-cascade QA into CKB for convenient BCD counting
      const ckbExternallyWired = p(1) !== 'Z';
      const ckb: LogicLevel = ckbExternallyWired ? p(1) : ((ff.qa & 1) as 0 | 1);

      if (runtime.prevClockState.cka === undefined) runtime.prevClockState.cka = cka;
      if (runtime.prevClockState.ckb === undefined) runtime.prevClockState.ckb = ckb;

      const r0_1 = p(2);
      const r0_2 = p(3);
      const r9_1 = p(6);
      const r9_2 = p(7);
      const r0Active =
        (r0_1 === 1 && r0_2 === 1) ||
        (r0_1 === 1 && r0_2 === 'Z') ||
        (r0_1 === 'Z' && r0_2 === 1);
      const r9Active =
        (r9_1 === 1 && r9_2 === 1) ||
        (r9_1 === 1 && r9_2 === 'Z') ||
        (r9_1 === 'Z' && r9_2 === 1);

      if (r9Active) {
        if (commitSequential) {
          ff.qa = 1;
          ff.mod5Val = 4; // QD=1, QC=0, QB=0 -> 1001 = 9
        }
        out[12] = 1;
        out[9] = 0;
        out[8] = 0;
        out[11] = 1;
      } else if (r0Active) {
        if (commitSequential) {
          ff.qa = 0;
          ff.mod5Val = 0;
        }
        out[12] = 0;
        out[9] = 0;
        out[8] = 0;
        out[11] = 0;
      } else {
        const prevQa = ff.qa;
        if (commitSequential) {
          if (runtime.prevClockState.cka === 1 && cka === 0) {
            ff.qa = ff.qa === 1 ? 0 : 1;
          }
          if (ckbExternallyWired) {
            if (runtime.prevClockState.ckb === 1 && ckb === 0) {
              ff.mod5Val = (ff.mod5Val + 1) % 5;
            }
          } else {
            // Internal cascade when CKB pin 1 is left open: trigger Div-5 when QA falls 1 -> 0
            if (prevQa === 1 && ff.qa === 0) {
              ff.mod5Val = (ff.mod5Val + 1) % 5;
            }
          }
        }
        out[12] = (ff.qa & 1) as 0 | 1;
        out[9] = ((ff.mod5Val >> 0) & 1) as 0 | 1; // QB
        out[8] = ((ff.mod5Val >> 1) & 1) as 0 | 1; // QC
        out[11] = ((ff.mod5Val >> 2) & 1) as 0 | 1; // QD
      }

      if (commitSequential) {
        runtime.prevClockState.cka = cka;
        runtime.prevClockState.ckb = ckbExternallyWired ? ckb : ((ff.qa & 1) as 0 | 1);
      }
      break;
    }

    case '74192': {
      // Presettable Synchronous BCD Decade Up/Down Counter (SN74LS192)
      // A=15, B=1, C=10, D=9 | QA=3, QB=2, QC=6, QD=7
      // UP=5, DOWN=4 | ~LOAD=11, CLR=14 | ~CO=12, ~BO=13
      if (!runtime.flipFlopState) {
        runtime.flipFlopState = {};
      }
      const ff = runtime.flipFlopState as Record<string, number>;
      if (ff.bcd === undefined) ff.bcd = 0;
      if (!runtime.prevClockState) {
        runtime.prevClockState = {};
      }
      const clr = withDefault(p(14), 0);
      const load = withDefault(p(11), 1);
      const up = withDefault(p(5), 1);
      const down = withDefault(p(4), 1);

      if (runtime.prevClockState.up === undefined) runtime.prevClockState.up = up;
      if (runtime.prevClockState.down === undefined) runtime.prevClockState.down = down;

      if (clr === 1) {
        if (commitSequential) ff.bcd = 0;
      } else if (clr === 0 && load === 0) {
        const a = withDefault(p(15), 0);
        const b = withDefault(p(1), 0);
        const c = withDefault(p(10), 0);
        const d = withDefault(p(9), 0);
        if (isBinary(a) && isBinary(b) && isBinary(c) && isBinary(d)) {
          const val = a + (b << 1) + (c << 2) + (d << 3);
          if (commitSequential) ff.bcd = val % 16;
        }
      } else if (clr === 0 && load === 1 && commitSequential) {
        if (runtime.prevClockState.up === 0 && up === 1 && down === 1) {
          ff.bcd = (ff.bcd + 1) % 10;
        } else if (runtime.prevClockState.down === 0 && down === 1 && up === 1) {
          ff.bcd = (ff.bcd + 9) % 10;
        }
      }

      if (commitSequential) {
        runtime.prevClockState.up = up;
        runtime.prevClockState.down = down;
      }

      const cnt = ff.bcd;
      out[3] = ((cnt >> 0) & 1) as 0 | 1; // QA
      out[2] = ((cnt >> 1) & 1) as 0 | 1; // QB
      out[6] = ((cnt >> 2) & 1) as 0 | 1; // QC
      out[7] = ((cnt >> 3) & 1) as 0 | 1; // QD
      // ~CO active-low when count==9 and UP==0 (and CLR==0, ~LOAD==1)
      out[12] = cnt === 9 && up === 0 && clr === 0 ? 0 : 1;
      // ~BO active-low when count==0 and DOWN==0 (and CLR==0)
      out[13] = cnt === 0 && down === 0 && clr === 0 ? 0 : 1;
      break;
    }

    case '7495': {
      // 4-Bit Parallel-Access Shift Register (SN74LS95B)
      // SER=1, A=2, B=3, C=4, D=5, MODE=6, ~CLK2=8, ~CLK1=9, QD=10, QC=11, QB=12, QA=13
      if (!runtime.flipFlopState) {
        runtime.flipFlopState = {};
      }
      const ff = runtime.flipFlopState as Record<string, number>;
      if (ff.qa === undefined) {
        ff.qa = 0;
        ff.qb = 0;
        ff.qc = 0;
        ff.qd = 0;
      }
      if (!runtime.prevClockState) {
        runtime.prevClockState = {};
      }
      const clk1 = withDefault(p(9), 1);
      const clk2 = withDefault(p(8), 1);
      if (runtime.prevClockState.clk1 === undefined) runtime.prevClockState.clk1 = clk1;
      if (runtime.prevClockState.clk2 === undefined) runtime.prevClockState.clk2 = clk2;

      const mode = withDefault(p(6), 0);

      if (commitSequential) {
        if (mode === 0 && runtime.prevClockState.clk1 === 1 && clk1 === 0) {
          const ser = withDefault(p(1), 0);
          const nextQa = isBinary(ser) ? ser : 0;
          ff.qd = ff.qc;
          ff.qc = ff.qb;
          ff.qb = ff.qa;
          ff.qa = nextQa;
        } else if (mode === 1 && runtime.prevClockState.clk2 === 1 && clk2 === 0) {
          const a = withDefault(p(2), 0);
          const b = withDefault(p(3), 0);
          const c = withDefault(p(4), 0);
          const d = withDefault(p(5), 0);
          if (isBinary(a)) ff.qa = a;
          if (isBinary(b)) ff.qb = b;
          if (isBinary(c)) ff.qc = c;
          if (isBinary(d)) ff.qd = d;
        }
        runtime.prevClockState.clk1 = clk1;
        runtime.prevClockState.clk2 = clk2;
      }

      out[13] = (ff.qa & 1) as 0 | 1;
      out[12] = (ff.qb & 1) as 0 | 1;
      out[11] = (ff.qc & 1) as 0 | 1;
      out[10] = (ff.qd & 1) as 0 | 1;
      break;
    }

    // ======================== GROUP D: MEMORY (6116) ==========================
    case '6116': {
      // 2K x 8 High-Speed CMOS Static RAM (HM6116P-3)
      // Addr pins: A0=8, A1=7, A2=6, A3=5, A4=4, A5=3, A6=2, A7=1, A8=23, A9=22, A10=19
      // Data I/O: 0..7 = 9, 10, 11, 13, 14, 15, 16, 17
      // Control: ~CS=18 (Chip Select), ~RE=20 (Read Enable), ~WR=21 (Write Enable)
      if (!runtime.internalMemory) {
        runtime.internalMemory = new Uint8Array(2048);
      }
      const addrPins = [8, 7, 6, 5, 4, 3, 2, 1, 23, 22, 19];
      const ioPins = [9, 10, 11, 13, 14, 15, 16, 17];
      // Active-low control inputs default to 1 (inactive HIGH) when unconnected ('Z')
      const cs = withDefault(p(18), 1);
      const re = withDefault(p(20), 1);
      const wr = withDefault(p(21), 1);

      if (cs === 1 || !isBinary(cs)) {
        // Standby mode (~CS=1): all I/O pins are High-Impedance ('Z')
        break;
      }

      // Unconnected address pins default to 0 so students can wire any subset of A0..A10
      const addrBits = addrPins.map((pinNum) => withDefault(p(pinNum), 0));
      const addrValid = addrBits.every(isBinary);
      let addr = 0;
      if (addrValid) {
        addrBits.forEach((bit, idx) => {
          addr |= (bit as number) << idx;
        });
      }

      if (wr === 0) {
        // Write cycle (~CS=0, ~WR=0; overrides ~RE per HM6116 datasheet); RAM output buffers stay Hi-Z
        if (commitSequential && addrValid) {
          const dataBits = ioPins.map((pinNum) => withDefault(p(pinNum), 0));
          if (dataBits.every(isBinary)) {
            let byteVal = 0;
            dataBits.forEach((bit, idx) => {
              byteVal |= (bit as number) << idx;
            });
            runtime.internalMemory[addr] = byteVal;
          }
        }
      } else if (wr === 1 && re === 0) {
        // Read cycle (~CS=0, ~WR=1, ~RE=0): drive stored byte onto I/O0..I/O7
        if (addrValid) {
          const byteVal = runtime.internalMemory[addr];
          ioPins.forEach((pinNum, idx) => {
            out[pinNum] = ((byteVal >> idx) & 1) as 0 | 1;
          });
        } else {
          ioPins.forEach((pinNum) => {
            out[pinNum] = 'X';
          });
        }
      }
      // If wr === 1 && re === 1: outputs disabled (Hi-Z)
      break;
    }

    default:
      break;
  }

  return { drivenPins: out };
}
