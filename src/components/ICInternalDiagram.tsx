import React, { useState } from 'react';
import { ICDefinition, LogicLevel } from '../types/circuit';

interface ICInternalDiagramProps {
  ic: ICDefinition;
  pinStates?: Record<number, LogicLevel>;
  compact?: boolean;
}

interface GateUnitSpec {
  id: string;
  label: string;
  equation: string;
  type: 'NAND' | 'NOR' | 'NOT' | 'AND' | 'OR' | 'XOR' | 'XNOR';
  inputs: Array<{ pin: number; name: string }>;
  output: { pin: number; name: string };
}

interface StageBlock {
  heading: string;
  subline: string;
}

interface FunctionalBlockSpec {
  title: string;
  subtitle: string;
  stages: StageBlock[];
  leftPins: Array<{ pin: number; name: string; role?: string }>;
  rightPins: Array<{ pin: number; name: string; role?: string }>;
  powerLine: string;
  operationLine: string;
}

function getGateUnits(partNumber: string): GateUnitSpec[] | null {
  switch (partNumber) {
    case '7400':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A · 1B)', type: 'NAND', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }], output: { pin: 3, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A · 2B)', type: 'NAND', inputs: [{ pin: 4, name: '2A' }, { pin: 5, name: '2B' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = ~(3A · 3B)', type: 'NAND', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }], output: { pin: 8, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = ~(4A · 4B)', type: 'NAND', inputs: [{ pin: 12, name: '4A' }, { pin: 13, name: '4B' }], output: { pin: 11, name: '4Y' } },
      ];
    case '7402':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A + 1B)', type: 'NOR', inputs: [{ pin: 2, name: '1A' }, { pin: 3, name: '1B' }], output: { pin: 1, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A + 2B)', type: 'NOR', inputs: [{ pin: 5, name: '2A' }, { pin: 6, name: '2B' }], output: { pin: 4, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = ~(3A + 3B)', type: 'NOR', inputs: [{ pin: 8, name: '3A' }, { pin: 9, name: '3B' }], output: { pin: 10, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = ~(4A + 4B)', type: 'NOR', inputs: [{ pin: 11, name: '4A' }, { pin: 12, name: '4B' }], output: { pin: 13, name: '4Y' } },
      ];
    case '7404':
      return [
        { id: 'G1', label: 'Inv 1', equation: '1Y = ~1A', type: 'NOT', inputs: [{ pin: 1, name: '1A' }], output: { pin: 2, name: '1Y' } },
        { id: 'G2', label: 'Inv 2', equation: '2Y = ~2A', type: 'NOT', inputs: [{ pin: 3, name: '2A' }], output: { pin: 4, name: '2Y' } },
        { id: 'G3', label: 'Inv 3', equation: '3Y = ~3A', type: 'NOT', inputs: [{ pin: 5, name: '3A' }], output: { pin: 6, name: '3Y' } },
        { id: 'G4', label: 'Inv 4', equation: '4Y = ~4A', type: 'NOT', inputs: [{ pin: 9, name: '4A' }], output: { pin: 8, name: '4Y' } },
        { id: 'G5', label: 'Inv 5', equation: '5Y = ~5A', type: 'NOT', inputs: [{ pin: 11, name: '5A' }], output: { pin: 10, name: '5Y' } },
        { id: 'G6', label: 'Inv 6', equation: '6Y = ~6A', type: 'NOT', inputs: [{ pin: 13, name: '6A' }], output: { pin: 12, name: '6Y' } },
      ];
    case '7408':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = 1A · 1B', type: 'AND', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }], output: { pin: 3, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = 2A · 2B', type: 'AND', inputs: [{ pin: 4, name: '2A' }, { pin: 5, name: '2B' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = 3A · 3B', type: 'AND', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }], output: { pin: 8, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = 4A · 4B', type: 'AND', inputs: [{ pin: 12, name: '4A' }, { pin: 13, name: '4B' }], output: { pin: 11, name: '4Y' } },
      ];
    case '7410':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A·1B·1C)', type: 'NAND', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }, { pin: 13, name: '1C' }], output: { pin: 12, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A·2B·2C)', type: 'NAND', inputs: [{ pin: 3, name: '2A' }, { pin: 4, name: '2B' }, { pin: 5, name: '2C' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = ~(3A·3B·3C)', type: 'NAND', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }, { pin: 11, name: '3C' }], output: { pin: 8, name: '3Y' } },
      ];
    case '7420':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A·1B·1C·1D)', type: 'NAND', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }, { pin: 4, name: '1C' }, { pin: 5, name: '1D' }], output: { pin: 6, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A·2B·2C·2D)', type: 'NAND', inputs: [{ pin: 9, name: '2A' }, { pin: 10, name: '2B' }, { pin: 12, name: '2C' }, { pin: 13, name: '2D' }], output: { pin: 8, name: '2Y' } },
      ];
    case '7427':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A+1B+1C)', type: 'NOR', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }, { pin: 13, name: '1C' }], output: { pin: 12, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A+2B+2C)', type: 'NOR', inputs: [{ pin: 3, name: '2A' }, { pin: 4, name: '2B' }, { pin: 5, name: '2C' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = ~(3A+3B+3C)', type: 'NOR', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }, { pin: 11, name: '3C' }], output: { pin: 8, name: '3Y' } },
      ];
    case '7432':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = 1A + 1B', type: 'OR', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }], output: { pin: 3, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = 2A + 2B', type: 'OR', inputs: [{ pin: 4, name: '2A' }, { pin: 5, name: '2B' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = 3A + 3B', type: 'OR', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }], output: { pin: 8, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = 4A + 4B', type: 'OR', inputs: [{ pin: 12, name: '4A' }, { pin: 13, name: '4B' }], output: { pin: 11, name: '4Y' } },
      ];
    case '7486':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = 1A ⊕ 1B', type: 'XOR', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }], output: { pin: 3, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = 2A ⊕ 2B', type: 'XOR', inputs: [{ pin: 4, name: '2A' }, { pin: 5, name: '2B' }], output: { pin: 6, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = 3A ⊕ 3B', type: 'XOR', inputs: [{ pin: 9, name: '3A' }, { pin: 10, name: '3B' }], output: { pin: 8, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = 4A ⊕ 4B', type: 'XOR', inputs: [{ pin: 12, name: '4A' }, { pin: 13, name: '4B' }], output: { pin: 11, name: '4Y' } },
      ];
    case '4077':
      return [
        { id: 'G1', label: 'Gate 1', equation: '1Y = ~(1A ⊕ 1B)', type: 'XNOR', inputs: [{ pin: 1, name: '1A' }, { pin: 2, name: '1B' }], output: { pin: 3, name: '1Y' } },
        { id: 'G2', label: 'Gate 2', equation: '2Y = ~(2A ⊕ 2B)', type: 'XNOR', inputs: [{ pin: 5, name: '2A' }, { pin: 6, name: '2B' }], output: { pin: 4, name: '2Y' } },
        { id: 'G3', label: 'Gate 3', equation: '3Y = ~(3A ⊕ 3B)', type: 'XNOR', inputs: [{ pin: 8, name: '3A' }, { pin: 9, name: '3B' }], output: { pin: 10, name: '3Y' } },
        { id: 'G4', label: 'Gate 4', equation: '4Y = ~(4A ⊕ 4B)', type: 'XNOR', inputs: [{ pin: 12, name: '4A' }, { pin: 13, name: '4B' }], output: { pin: 11, name: '4Y' } },
      ];
    default:
      return null;
  }
}

function getFunctionalBlockSpec(partNumber: string): FunctionalBlockSpec {
  switch (partNumber) {
    case '7483':
      return {
        title: 'SN74LS83A 4-BIT BINARY FULL ADDER',
        subtitle: '4 Full-Adder Stages + Lookahead Carry Generator',
        stages: [
          { heading: 'STAGE 1 & 2 ADDERS', subline: 'FA1(A1,B1,C0) · FA2(A2,B2,C1)' },
          { heading: 'LOOKAHEAD CARRY GEN', subline: 'Fast Internal C1, C2, C3, C4' },
          { heading: 'STAGE 3 & 4 ADDERS', subline: 'FA3(A3,B3,C2) · FA4(A4,B4,C3)' },
        ],
        leftPins: [
          { pin: 13, name: 'C0', role: 'IN' },
          { pin: 10, name: 'A1', role: 'IN' },
          { pin: 8, name: 'A2', role: 'IN' },
          { pin: 3, name: 'A3', role: 'IN' },
          { pin: 1, name: 'A4', role: 'IN' },
          { pin: 11, name: 'B1', role: 'IN' },
          { pin: 7, name: 'B2', role: 'IN' },
          { pin: 4, name: 'B3', role: 'IN' },
          { pin: 16, name: 'B4', role: 'IN' },
        ],
        rightPins: [
          { pin: 9, name: 'Σ1', role: 'OUT' },
          { pin: 6, name: 'Σ2', role: 'OUT' },
          { pin: 2, name: 'Σ3', role: 'OUT' },
          { pin: 15, name: 'Σ4', role: 'OUT' },
          { pin: 14, name: 'C4', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 5 (+5V) · GND = Pin 12 (0V)',
        operationLine: 'Function: Σ4..Σ1 + C4 = (A4..A1) + (B4..B1) + C0',
      };
    case '7485':
      return {
        title: 'SN74LS85 4-BIT MAGNITUDE COMPARATOR',
        subtitle: 'Bitwise XNOR Equality + Priority Magnitude Tree',
        stages: [
          { heading: 'BITWISE XNOR ARRAY', subline: 'Compares A3..A0 vs B3..B0' },
          { heading: 'PRIORITY MAGNITUDE', subline: 'MSB-First A>B / A<B Resolve' },
          { heading: 'CASCADE EXPANDER', subline: 'IA>B(4), IA=B(3), IA<B(2)' },
        ],
        leftPins: [
          { pin: 10, name: 'A0', role: 'IN' },
          { pin: 12, name: 'A1', role: 'IN' },
          { pin: 13, name: 'A2', role: 'IN' },
          { pin: 15, name: 'A3', role: 'IN' },
          { pin: 9, name: 'B0', role: 'IN' },
          { pin: 11, name: 'B1', role: 'IN' },
          { pin: 14, name: 'B2', role: 'IN' },
          { pin: 1, name: 'B3', role: 'IN' },
          { pin: 2, name: 'IA<B', role: 'IN' },
          { pin: 3, name: 'IA=B', role: 'IN' },
          { pin: 4, name: 'IA>B', role: 'IN' },
        ],
        rightPins: [
          { pin: 5, name: 'OA>B', role: 'OUT' },
          { pin: 6, name: 'OA=B', role: 'OUT' },
          { pin: 7, name: 'OA<B', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Cascade: Tie IA=B (Pin 3)=1, IA<B=0, IA>B=0 for single IC',
      };
    case '74138':
      return {
        title: 'SN74LS138 3-TO-8 LINE DECODER / DEMUX',
        subtitle: '3-Input Enable Gate + 8 Active-Low NAND Decoders',
        stages: [
          { heading: 'ENABLE GATING', subline: 'EN = G1 · ~G2A · ~G2B' },
          { heading: 'SELECT INVERTERS', subline: '3-Bit Binary Address C, B, A' },
          { heading: '8× NAND DECODERS', subline: 'Active-Low Outputs ~Y0..~Y7' },
        ],
        leftPins: [
          { pin: 1, name: 'A', role: 'IN' },
          { pin: 2, name: 'B', role: 'IN' },
          { pin: 3, name: 'C', role: 'IN' },
          { pin: 6, name: 'G1', role: 'EN' },
          { pin: 4, name: '~G2A', role: 'EN' },
          { pin: 5, name: '~G2B', role: 'EN' },
        ],
        rightPins: [
          { pin: 15, name: '~Y0', role: 'OUT' },
          { pin: 14, name: '~Y1', role: 'OUT' },
          { pin: 13, name: '~Y2', role: 'OUT' },
          { pin: 12, name: '~Y3', role: 'OUT' },
          { pin: 11, name: '~Y4', role: 'OUT' },
          { pin: 10, name: '~Y5', role: 'OUT' },
          { pin: 9, name: '~Y6', role: 'OUT' },
          { pin: 7, name: '~Y7', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Enable: G1=1, ~G2A=0, ~G2B=0 -> Selected ~Y[CBA] = 0',
      };
    case '74139':
      return {
        title: 'SN74LS139 DUAL 2-TO-4 DECODER / DEMUX',
        subtitle: 'Two Independent 2-to-4 Active-Low NAND Decoders',
        stages: [
          { heading: 'DECODER 1 (PINS 1..7)', subline: '~1G=0: (1B,1A) -> ~1Y0..~1Y3' },
          { heading: 'DECODER 2 (PINS 9..15)', subline: '~2G=0: (2B,2A) -> ~2Y0..~2Y3' },
        ],
        leftPins: [
          { pin: 1, name: '~1G', role: 'EN' },
          { pin: 2, name: '1A', role: 'IN' },
          { pin: 3, name: '1B', role: 'IN' },
          { pin: 15, name: '~2G', role: 'EN' },
          { pin: 14, name: '2A', role: 'IN' },
          { pin: 13, name: '2B', role: 'IN' },
        ],
        rightPins: [
          { pin: 4, name: '~1Y0', role: 'OUT' },
          { pin: 5, name: '~1Y1', role: 'OUT' },
          { pin: 6, name: '~1Y2', role: 'OUT' },
          { pin: 7, name: '~1Y3', role: 'OUT' },
          { pin: 12, name: '~2Y0', role: 'OUT' },
          { pin: 11, name: '~2Y1', role: 'OUT' },
          { pin: 10, name: '~2Y2', role: 'OUT' },
          { pin: 9, name: '~2Y3', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Active-Low Enable (~1G, ~2G) & Active-Low Outputs (~Y = 0)',
      };
    case '7446':
    case '7447':
      return {
        title: `SN${partNumber}A BCD TO 7-SEGMENT DECODER`,
        subtitle: 'BCD Matrix + Blanking/Lamp-Test + 7 Sink Drivers',
        stages: [
          { heading: 'BCD INPUT BUFFERS', subline: 'D (MSB,6), C (2), B (1), A (LSB,7)' },
          { heading: 'BLANKING / LAMP TEST', subline: '~LT(3), ~BI/~RBO(4), ~RBI(5)' },
          { heading: '7× CATHODE DRIVERS', subline: 'Active-Low Open-Collector ~a..~g' },
        ],
        leftPins: [
          { pin: 7, name: 'A', role: 'IN' },
          { pin: 1, name: 'B', role: 'IN' },
          { pin: 2, name: 'C', role: 'IN' },
          { pin: 6, name: 'D', role: 'IN' },
          { pin: 3, name: '~LT', role: 'CTL' },
          { pin: 5, name: '~RBI', role: 'CTL' },
          { pin: 4, name: '~BI', role: 'I/O' },
        ],
        rightPins: [
          { pin: 13, name: '~a', role: 'OUT' },
          { pin: 12, name: '~b', role: 'OUT' },
          { pin: 11, name: '~c', role: 'OUT' },
          { pin: 10, name: '~d', role: 'OUT' },
          { pin: 9, name: '~e', role: 'OUT' },
          { pin: 15, name: '~f', role: 'OUT' },
          { pin: 14, name: '~g', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Drives Common-Anode Display (Output 0 = Segment ON)',
      };
    case '74148':
      return {
        title: 'SN74LS148 8-TO-3 PRIORITY ENCODER',
        subtitle: 'Octal Priority Gating (~I7 Highest down to ~I0)',
        stages: [
          { heading: 'ENABLE STROBE', subline: '~EI (Pin 5) Active-Low Enable' },
          { heading: 'PRIORITY INHIBITION', subline: 'Highest Active-Low ~I7..~I0 Wins' },
          { heading: 'OCTAL CODE OUTPUTS', subline: '~A2(6), ~A1(7), ~A0(9), ~GS, ~EO' },
        ],
        leftPins: [
          { pin: 5, name: '~EI', role: 'EN' },
          { pin: 10, name: '~I0', role: 'IN' },
          { pin: 11, name: '~I1', role: 'IN' },
          { pin: 12, name: '~I2', role: 'IN' },
          { pin: 13, name: '~I3', role: 'IN' },
          { pin: 1, name: '~I4', role: 'IN' },
          { pin: 2, name: '~I5', role: 'IN' },
          { pin: 3, name: '~I6', role: 'IN' },
          { pin: 4, name: '~I7', role: 'IN' },
        ],
        rightPins: [
          { pin: 9, name: '~A0', role: 'OUT' },
          { pin: 7, name: '~A1', role: 'OUT' },
          { pin: 6, name: '~A2', role: 'OUT' },
          { pin: 14, name: '~GS', role: 'OUT' },
          { pin: 15, name: '~EO', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'All Inputs & Outputs Active-Low (~I7 has highest priority)',
      };
    case '74151':
      return {
        title: 'SN74LS151 8-TO-1 DATA MULTIPLEXER',
        subtitle: '3-Bit Select Decoder + 8-Channel AND-OR Tree',
        stages: [
          { heading: 'SELECT & STROBE', subline: 'Address C(9), B(10), A(11) · ~G(7)' },
          { heading: '8× AND STEERING', subline: 'Selects 1 of 8 Inputs D0..D7' },
          { heading: 'COMPLEMENTARY OUT', subline: 'True Y (Pin 5) & Inverted ~W (Pin 6)' },
        ],
        leftPins: [
          { pin: 7, name: '~G', role: 'EN' },
          { pin: 11, name: 'A', role: 'SEL' },
          { pin: 10, name: 'B', role: 'SEL' },
          { pin: 9, name: 'C', role: 'SEL' },
          { pin: 4, name: 'D0', role: 'IN' },
          { pin: 3, name: 'D1', role: 'IN' },
          { pin: 2, name: 'D2', role: 'IN' },
          { pin: 1, name: 'D3', role: 'IN' },
          { pin: 15, name: 'D4', role: 'IN' },
          { pin: 14, name: 'D5', role: 'IN' },
          { pin: 13, name: 'D6', role: 'IN' },
          { pin: 12, name: 'D7', role: 'IN' },
        ],
        rightPins: [
          { pin: 5, name: 'Y', role: 'OUT' },
          { pin: 6, name: '~W', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'When ~G=0: Y = D[CBA], ~W = ~Y · When ~G=1: Y=0, ~W=1',
      };
    case '74153':
      return {
        title: 'SN74LS153 DUAL 4-TO-1 MULTIPLEXER',
        subtitle: 'Common Select Lines (B, A) + Dual 4-to-1 MUX',
        stages: [
          { heading: 'COMMON SELECT', subline: 'Select B (Pin 2), Select A (Pin 14)' },
          { heading: 'MUX 1 (1C0..1C3)', subline: 'Strobe ~1G (Pin 1) -> Output 1Y (7)' },
          { heading: 'MUX 2 (2C0..2C3)', subline: 'Strobe ~2G (Pin 15) -> Output 2Y (9)' },
        ],
        leftPins: [
          { pin: 14, name: 'A', role: 'SEL' },
          { pin: 2, name: 'B', role: 'SEL' },
          { pin: 1, name: '~1G', role: 'EN' },
          { pin: 6, name: '1C0', role: 'IN' },
          { pin: 5, name: '1C1', role: 'IN' },
          { pin: 4, name: '1C2', role: 'IN' },
          { pin: 3, name: '1C3', role: 'IN' },
          { pin: 15, name: '~2G', role: 'EN' },
          { pin: 10, name: '2C0', role: 'IN' },
          { pin: 11, name: '2C1', role: 'IN' },
          { pin: 12, name: '2C2', role: 'IN' },
          { pin: 13, name: '2C3', role: 'IN' },
        ],
        rightPins: [
          { pin: 7, name: '1Y', role: 'OUT' },
          { pin: 9, name: '2Y', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Non-Inverting Outputs: 1Y = 1C[BA], 2Y = 2C[BA]',
      };
    case '7474':
      return {
        title: 'SN74LS74A DUAL D-TYPE FLIP-FLOP',
        subtitle: 'Positive-Edge-Triggered with Async ~PRE & ~CLR',
        stages: [
          { heading: 'FLIP-FLOP 1 (PINS 1..6)', subline: '~1CLR(1), 1D(2), 1CLK↑(3), ~1PRE(4)' },
          { heading: 'FLIP-FLOP 2 (PINS 8..13)', subline: '~2CLR(13), 2D(12), 2CLK↑(11), ~2PRE(10)' },
        ],
        leftPins: [
          { pin: 1, name: '~1CLR', role: 'CTL' },
          { pin: 2, name: '1D', role: 'IN' },
          { pin: 3, name: '1CLK↑', role: 'CLK' },
          { pin: 4, name: '~1PRE', role: 'CTL' },
          { pin: 13, name: '~2CLR', role: 'CTL' },
          { pin: 12, name: '2D', role: 'IN' },
          { pin: 11, name: '2CLK↑', role: 'CLK' },
          { pin: 10, name: '~2PRE', role: 'CTL' },
        ],
        rightPins: [
          { pin: 5, name: '1Q', role: 'OUT' },
          { pin: 6, name: '~1Q', role: 'OUT' },
          { pin: 9, name: '2Q', role: 'OUT' },
          { pin: 8, name: '~2Q', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 14 (+5V) · GND = Pin 7 (0V)',
        operationLine: 'Rising Clock Edge (0->1) latches D -> Q when ~PRE=~CLR=1',
      };
    case '7476':
      return {
        title: 'SN7476 DUAL MASTER-SLAVE JK FLIP-FLOP',
        subtitle: 'Negative-Edge-Triggered with Async ~PRE & ~CLR',
        stages: [
          { heading: 'JK FLIP-FLOP 1', subline: '1CLK↓(1), ~1PRE(2), ~1CLR(3), 1J(4), 1K(16)' },
          { heading: 'JK FLIP-FLOP 2', subline: '2CLK↓(6), ~2PRE(7), ~2CLR(8), 2J(9), 2K(12)' },
        ],
        leftPins: [
          { pin: 1, name: '1CLK↓', role: 'CLK' },
          { pin: 2, name: '~1PRE', role: 'CTL' },
          { pin: 3, name: '~1CLR', role: 'CTL' },
          { pin: 4, name: '1J', role: 'IN' },
          { pin: 16, name: '1K', role: 'IN' },
          { pin: 6, name: '2CLK↓', role: 'CLK' },
          { pin: 7, name: '~2PRE', role: 'CTL' },
          { pin: 8, name: '~2CLR', role: 'CTL' },
          { pin: 9, name: '2J', role: 'IN' },
          { pin: 12, name: '2K', role: 'IN' },
        ],
        rightPins: [
          { pin: 15, name: '1Q', role: 'OUT' },
          { pin: 14, name: '~1Q', role: 'OUT' },
          { pin: 11, name: '2Q', role: 'OUT' },
          { pin: 10, name: '~2Q', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 5 (+5V) · GND = Pin 13 (0V)',
        operationLine: 'Falling Clock Edge (1->0): J=K=1 Toggles, J=1/K=0 Sets',
      };
    case '7490':
      return {
        title: 'SN74LS90 BCD DECADE COUNTER',
        subtitle: 'Divide-by-2 + Divide-by-5 Ripple Counter Chain',
        stages: [
          { heading: 'DIVIDE-BY-2 STAGE', subline: 'CKA↓ (Pin 14) toggles QA (Pin 12)' },
          { heading: 'DIVIDE-BY-5 STAGE', subline: 'CKB↓ (Pin 1) steps QD, QC, QB (0..4)' },
          { heading: 'MASTER RESET GATES', subline: 'R0(2,3)->0000 · R9(6,7)->1001 (9)' },
        ],
        leftPins: [
          { pin: 14, name: 'CKA↓', role: 'CLK' },
          { pin: 1, name: 'CKB↓', role: 'CLK' },
          { pin: 2, name: 'R0(1)', role: 'RST' },
          { pin: 3, name: 'R0(2)', role: 'RST' },
          { pin: 6, name: 'R9(1)', role: 'SET' },
          { pin: 7, name: 'R9(2)', role: 'SET' },
        ],
        rightPins: [
          { pin: 12, name: 'QA', role: 'OUT' },
          { pin: 9, name: 'QB', role: 'OUT' },
          { pin: 8, name: 'QC', role: 'OUT' },
          { pin: 11, name: 'QD', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 5 (+5V) · GND = Pin 10 (0V)',
        operationLine: 'BCD Mode: Connect QA (Pin 12) -> CKB (Pin 1), Clock CKA',
      };
    case '74192':
      return {
        title: 'SN74LS192 SYNCHRONOUS UP/DOWN COUNTER',
        subtitle: 'Presettable BCD Decade Counter with Dual Clocks',
        stages: [
          { heading: 'ASYNC PRESET / CLEAR', subline: 'CLR (Pin 14)=1 resets · ~LOAD (Pin 11)=0' },
          { heading: 'BCD UP/DOWN ENGINE', subline: 'UP↑ (Pin 5) counts +1 · DOWN↑ (Pin 4) -1' },
          { heading: 'CARRY / BORROW OUT', subline: '~CO (Pin 12) at 9 · ~BO (Pin 13) at 0' },
        ],
        leftPins: [
          { pin: 5, name: 'UP↑', role: 'CLK' },
          { pin: 4, name: 'DOWN↑', role: 'CLK' },
          { pin: 14, name: 'CLR', role: 'RST' },
          { pin: 11, name: '~LOAD', role: 'CTL' },
          { pin: 15, name: 'A', role: 'IN' },
          { pin: 1, name: 'B', role: 'IN' },
          { pin: 10, name: 'C', role: 'IN' },
          { pin: 9, name: 'D', role: 'IN' },
        ],
        rightPins: [
          { pin: 3, name: 'QA', role: 'OUT' },
          { pin: 2, name: 'QB', role: 'OUT' },
          { pin: 6, name: 'QC', role: 'OUT' },
          { pin: 7, name: 'QD', role: 'OUT' },
          { pin: 12, name: '~CO', role: 'OUT' },
          { pin: 13, name: '~BO', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 16 (+5V) · GND = Pin 8 (0V)',
        operationLine: 'Keep inactive clock HIGH (1) while pulsing UP↑ or DOWN↑',
      };
    case '7495':
      return {
        title: 'SN74LS95B 4-BIT SHIFT REGISTER',
        subtitle: 'Serial Shift-Right & Synchronous Parallel Load',
        stages: [
          { heading: 'MODE & CLOCK SELECT', subline: 'MODE=0: ~CLK1↓(9) · MODE=1: ~CLK2↓(8)' },
          { heading: '4× RS FLIP-FLOP CHAIN', subline: 'SER(1)->QA->QB->QC->QD or Parallel A..D' },
        ],
        leftPins: [
          { pin: 6, name: 'MODE', role: 'CTL' },
          { pin: 9, name: '~CLK1↓', role: 'CLK' },
          { pin: 8, name: '~CLK2↓', role: 'CLK' },
          { pin: 1, name: 'SER', role: 'IN' },
          { pin: 2, name: 'A', role: 'IN' },
          { pin: 3, name: 'B', role: 'IN' },
          { pin: 4, name: 'C', role: 'IN' },
          { pin: 5, name: 'D', role: 'IN' },
        ],
        rightPins: [
          { pin: 13, name: 'QA', role: 'OUT' },
          { pin: 12, name: 'QB', role: 'OUT' },
          { pin: 11, name: 'QC', role: 'OUT' },
          { pin: 10, name: 'QD', role: 'OUT' },
        ],
        powerLine: 'Supply: VCC = Pin 14 (+5V) · GND = Pin 7 (0V)',
        operationLine: 'Negative-Edge Triggered (1->0) on ~CLK1 (Shift) or ~CLK2 (Load)',
      };
    default:
      // 6116 2K x 8 Static RAM
      return {
        title: 'HM6116P-3 2K × 8 CMOS STATIC RAM',
        subtitle: '11-Bit Address Bus + 2048×8 Matrix + Tri-State I/O',
        stages: [
          { heading: 'ROW / COL DECODERS', subline: 'Address A0..A10 selects 1 of 2048 Bytes' },
          { heading: '16K-BIT CMOS MATRIX', subline: '128 × 128 Static Storage Cells (2K × 8)' },
          { heading: 'BUS CONTROL LOGIC', subline: '~CS (Pin 18), ~RE (Pin 20), ~WR (Pin 21)' },
        ],
        leftPins: [
          { pin: 18, name: '~CS', role: 'CTL' },
          { pin: 20, name: '~RE', role: 'CTL' },
          { pin: 21, name: '~WR', role: 'CTL' },
          { pin: 8, name: 'A0', role: 'ADR' },
          { pin: 7, name: 'A1', role: 'ADR' },
          { pin: 6, name: 'A2', role: 'ADR' },
          { pin: 5, name: 'A3', role: 'ADR' },
          { pin: 4, name: 'A4..10', role: 'ADR' },
        ],
        rightPins: [
          { pin: 9, name: 'I/O0', role: 'I/O' },
          { pin: 10, name: 'I/O1', role: 'I/O' },
          { pin: 11, name: 'I/O2', role: 'I/O' },
          { pin: 13, name: 'I/O3', role: 'I/O' },
          { pin: 14, name: 'I/O4', role: 'I/O' },
          { pin: 15, name: 'I/O5', role: 'I/O' },
          { pin: 16, name: 'I/O6', role: 'I/O' },
          { pin: 17, name: 'I/O7', role: 'I/O' },
        ],
        powerLine: 'Supply: VCC = Pin 24 (+5V) · VSS = Pin 12 (GND)',
        operationLine: 'Write: ~CS=0, ~WR=0 · Read: ~CS=0, ~RE=0, ~WR=1 · Standby: ~CS=1',
      };
  }
}

function renderGateSymbol(type: GateUnitSpec['type'], x: number, y: number) {
  const stroke = '#20252B';
  const fill = '#E5E5E1';

  switch (type) {
    case 'NOT':
      return (
        <g>
          <polygon points={`${x},${y + 3} ${x + 36},${y + 16} ${x},${y + 29}`} fill={fill} stroke={stroke} strokeWidth={1.6} />
          <circle cx={x + 41} cy={y + 16} r={4.2} fill={fill} stroke={stroke} strokeWidth={1.6} />
        </g>
      );
    case 'AND':
    case 'NAND':
      return (
        <g>
          <path
            d={`M ${x} ${y + 3} L ${x + 22} ${y + 3} A 13 13 0 0 1 ${x + 22} ${y + 29} L ${x} ${y + 29} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.6}
          />
          {type === 'NAND' && (
            <circle cx={x + 40} cy={y + 16} r={4.2} fill={fill} stroke={stroke} strokeWidth={1.6} />
          )}
        </g>
      );
    case 'OR':
    case 'NOR':
      return (
        <g>
          <path
            d={`M ${x} ${y + 3} Q ${x + 10} ${y + 16} ${x} ${y + 29} Q ${x + 24} ${y + 29} ${x + 36} ${y + 16} Q ${x + 24} ${y + 3} ${x} ${y + 3} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.6}
          />
          {type === 'NOR' && (
            <circle cx={x + 41} cy={y + 16} r={4.2} fill={fill} stroke={stroke} strokeWidth={1.6} />
          )}
        </g>
      );
    case 'XOR':
    case 'XNOR':
      return (
        <g>
          <path
            d={`M ${x - 5} ${y + 3} Q ${x + 5} ${y + 16} ${x - 5} ${y + 29}`}
            fill="none"
            stroke={stroke}
            strokeWidth={1.6}
          />
          <path
            d={`M ${x + 1} ${y + 3} Q ${x + 11} ${y + 16} ${x + 1} ${y + 29} Q ${x + 24} ${y + 29} ${x + 36} ${y + 16} Q ${x + 24} ${y + 3} ${x + 1} ${y + 3} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.6}
          />
          {type === 'XNOR' && (
            <circle cx={x + 41} cy={y + 16} r={4.2} fill={fill} stroke={stroke} strokeWidth={1.6} />
          )}
        </g>
      );
  }
}

function pinStateBadgeText(pinStates: Record<number, LogicLevel> | undefined, pin: number): string {
  if (!pinStates) return '';
  const v = pinStates[pin];
  if (v === undefined) return '';
  return ` [${v}]`;
}

function pinStrokeColor(pinStates: Record<number, LogicLevel> | undefined, pin: number): string {
  if (!pinStates) return '#456A83';
  const v = pinStates[pin];
  if (v === 1) return '#3B5746';
  if (v === 0) return '#20252B';
  return '#747C82';
}

function renderDipPinoutDiagram(ic: ICDefinition, pinStates?: Record<number, LogicLevel>) {
  const half = ic.pinCount / 2;
  const rowH = 22;
  const bodyTop = 36;
  const bodyH = half * rowH + 10;
  const svgH = bodyTop + bodyH + 18;

  return (
    <svg viewBox={`0 0 460 ${svgH}`} className="w-full h-auto block">
      <rect
        x={4}
        y={4}
        width={452}
        height={svgH - 8}
        rx={5}
        fill="#F7F6F2"
        stroke="#C9C9C3"
        strokeWidth={1.2}
      />
      <text
        x={14}
        y={22}
        fill="#20252B"
        fontSize={10}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        {ic.partNumber} PHYSICAL {ic.packageType} PINOUT DIAGRAM (PINS 1–{ic.pinCount})
      </text>

      {/* Central DIP Body */}
      <rect
        x={160}
        y={bodyTop}
        width={140}
        height={bodyH}
        rx={4}
        fill="#252B32"
        stroke="#181C20"
        strokeWidth={1.5}
      />
      {/* Pin 1 Notch */}
      <path
        d={`M 212 ${bodyTop} A 18 14 0 0 0 248 ${bodyTop}`}
        fill="#F7F6F2"
        stroke="#181C20"
        strokeWidth={1.2}
      />
      <circle cx={174} cy={bodyTop + 14} r={3} fill="#D6D5CE" />

      {/* Center Vertical IC Marking */}
      <text
        x={230}
        y={bodyTop + bodyH / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#F1F0EB"
        fontSize={12}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        IC {ic.partNumber}
      </text>

      {Array.from({ length: half }).map((_, idx) => {
        const leftPinNum = idx + 1;
        const rightPinNum = ic.pinCount - idx;
        const leftPin = ic.pins.find((p) => p.pin === leftPinNum);
        const rightPin = ic.pins.find((p) => p.pin === rightPinNum);
        const py = bodyTop + 14 + idx * rowH;

        const leftDir =
          leftPin?.direction === 'power-vcc'
            ? 'VCC'
            : leftPin?.direction === 'power-gnd'
            ? 'GND'
            : leftPin?.direction === 'output' || leftPin?.direction === 'open-collector'
            ? 'OUT'
            : leftPin?.direction === 'bidirectional'
            ? 'I/O'
            : 'IN';
        const rightDir =
          rightPin?.direction === 'power-vcc'
            ? 'VCC'
            : rightPin?.direction === 'power-gnd'
            ? 'GND'
            : rightPin?.direction === 'output' || rightPin?.direction === 'open-collector'
            ? 'OUT'
            : rightPin?.direction === 'bidirectional'
            ? 'I/O'
            : 'IN';

        return (
          <g key={idx}>
            {/* Left Lead Box */}
            <rect
              x={136}
              y={py - 7}
              width={24}
              height={14}
              fill="#E5E5E1"
              stroke="#303840"
              strokeWidth={1}
            />
            <text
              x={148}
              y={py + 3}
              textAnchor="middle"
              fill="#20252B"
              fontSize={8.8}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {leftPinNum}
            </text>
            <text
              x={130}
              y={py + 3}
              textAnchor="end"
              fill={leftDir === 'OUT' ? '#3B5746' : leftDir === 'VCC' ? '#B83A32' : '#20252B'}
              fontSize={9}
              fontWeight={600}
              fontFamily="IBM Plex Mono, monospace"
            >
              {leftPin?.name} ({leftDir}){pinStateBadgeText(pinStates, leftPinNum)}
            </text>

            {/* Right Lead Box */}
            <rect
              x={300}
              y={py - 7}
              width={24}
              height={14}
              fill="#E5E5E1"
              stroke="#303840"
              strokeWidth={1}
            />
            <text
              x={312}
              y={py + 3}
              textAnchor="middle"
              fill="#20252B"
              fontSize={8.8}
              fontWeight={700}
              fontFamily="IBM Plex Mono, monospace"
            >
              {rightPinNum}
            </text>
            <text
              x={330}
              y={py + 3}
              textAnchor="start"
              fill={rightDir === 'OUT' ? '#3B5746' : rightDir === 'VCC' ? '#B83A32' : '#20252B'}
              fontSize={9}
              fontWeight={600}
              fontFamily="IBM Plex Mono, monospace"
            >
              {rightPin?.name} ({rightDir}){pinStateBadgeText(pinStates, rightPinNum)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const ICInternalDiagram: React.FC<ICInternalDiagramProps> = ({
  ic,
  pinStates,
  compact = false,
}) => {
  const [diagramMode, setDiagramMode] = useState<'internal' | 'pinout'>('internal');
  const gateUnits = getGateUnits(ic.partNumber);
  const vccPin = ic.pins.find((p) => p.direction === 'power-vcc');
  const gndPin = ic.pins.find((p) => p.direction === 'power-gnd');

  return (
    <div className="w-full space-y-1.5" data-testid={`internal-diagram-${ic.partNumber}`}>
      {/* Mode Switcher Bar: Internal Structure vs Physical DIP Pinout */}
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[10px] font-mono text-[#555C62]">
          VCC: Pin {vccPin?.pin ?? '—'} · GND: Pin {gndPin?.pin ?? '—'}
        </span>
        <div className="inline-flex rounded border border-[#B8B8B1] bg-[#E5E5E1] p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => setDiagramMode('internal')}
            className={`px-2 py-0.5 rounded cursor-pointer ${
              diagramMode === 'internal'
                ? 'bg-[#303840] text-[#F1F0EB] font-semibold'
                : 'text-[#303840] hover:bg-[#DAD9D3]'
            }`}
          >
            Internal Logic
          </button>
          <button
            type="button"
            onClick={() => setDiagramMode('pinout')}
            className={`px-2 py-0.5 rounded cursor-pointer ${
              diagramMode === 'pinout'
                ? 'bg-[#303840] text-[#F1F0EB] font-semibold'
                : 'text-[#303840] hover:bg-[#DAD9D3]'
            }`}
          >
            DIP Pinout
          </button>
        </div>
      </div>

      {diagramMode === 'pinout' ? (
        renderDipPinoutDiagram(ic, pinStates)
      ) : gateUnits ? (
        (() => {
          const rowH = compact ? 54 : 58;
          const svgH = gateUnits.length * rowH + 46;
          return (
            <svg viewBox={`0 0 460 ${svgH}`} className="w-full h-auto block">
              <rect
                x={4}
                y={4}
                width={452}
                height={svgH - 8}
                rx={5}
                fill="#F7F6F2"
                stroke="#C9C9C3"
                strokeWidth={1.2}
              />
              <text
                x={14}
                y={22}
                fill="#20252B"
                fontSize={10}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
              >
                {ic.partNumber} INTERNAL GATE SCHEMATIC ({gateUnits.length} GATES)
              </text>
              <text
                x={446}
                y={22}
                textAnchor="end"
                fill="#587965"
                fontSize={9}
                fontWeight={600}
                fontFamily="IBM Plex Mono, monospace"
              >
                VCC:Pin {vccPin?.pin} · GND:Pin {gndPin?.pin}
              </text>

              {gateUnits.map((g, idx) => {
                const topY = 34 + idx * rowH;
                const gateX = 196;
                const gateY = topY + 6;
                const outEndX =
                  g.type === 'AND' || g.type === 'OR' || g.type === 'XOR'
                    ? gateX + 36
                    : gateX + 45;

                return (
                  <g key={g.id}>
                    <rect
                      x={12}
                      y={topY}
                      width={436}
                      height={rowH - 6}
                      rx={3.5}
                      fill="#FFFFFF"
                      stroke="#E0DFD9"
                      strokeWidth={1}
                    />

                    {/* Input wires & labels */}
                    {g.inputs.map((inp, iIdx) => {
                      const count = g.inputs.length;
                      const offset =
                        count === 1
                          ? 16
                          : count === 2
                          ? iIdx === 0
                            ? 10
                            : 22
                          : count === 3
                          ? 7 + iIdx * 9
                          : 5 + iIdx * 7.2;
                      const wy = gateY + offset;
                      const stateStr = pinStateBadgeText(pinStates, inp.pin);

                      return (
                        <g key={inp.pin}>
                          <line
                            x1={142}
                            y1={wy}
                            x2={gateX}
                            y2={wy}
                            stroke={pinStrokeColor(pinStates, inp.pin)}
                            strokeWidth={1.5}
                          />
                          <circle cx={142} cy={wy} r={2.5} fill={pinStrokeColor(pinStates, inp.pin)} />
                          <text
                            x={135}
                            y={wy + 3}
                            textAnchor="end"
                            fill="#20252B"
                            fontSize={9.2}
                            fontWeight={600}
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            Pin {inp.pin} ({inp.name} IN){stateStr}
                          </text>
                        </g>
                      );
                    })}

                    {/* IEEE Gate Symbol */}
                    {renderGateSymbol(g.type, gateX, gateY)}

                    {/* Output wire & label */}
                    <line
                      x1={outEndX}
                      y1={gateY + 16}
                      x2={290}
                      y2={gateY + 16}
                      stroke={pinStrokeColor(pinStates, g.output.pin)}
                      strokeWidth={1.7}
                    />
                    <circle cx={290} cy={gateY + 16} r={2.8} fill="#587965" />
                    <text
                      x={298}
                      y={gateY + 14}
                      textAnchor="start"
                      fill="#3B5746"
                      fontSize={9.2}
                      fontWeight={700}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      Pin {g.output.pin} ({g.output.name} OUT){pinStateBadgeText(pinStates, g.output.pin)}
                    </text>
                    <text
                      x={298}
                      y={gateY + 25}
                      textAnchor="start"
                      fill="#747C82"
                      fontSize={8}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {g.equation}
                    </text>
                  </g>
                );
              })}
            </svg>
          );
        })()
      ) : (
        (() => {
          const spec = getFunctionalBlockSpec(ic.partNumber);
          const maxSideRows = Math.max(spec.leftPins.length, spec.rightPins.length);
          const bodyH = Math.max(158, maxSideRows * 20 + 26);
          const svgH = bodyH + 84;

          return (
            <svg viewBox={`0 0 460 ${svgH}`} className="w-full h-auto block">
              <rect
                x={4}
                y={4}
                width={452}
                height={svgH - 8}
                rx={5}
                fill="#F7F6F2"
                stroke="#C9C9C3"
                strokeWidth={1.2}
              />
              <text
                x={14}
                y={21}
                fill="#20252B"
                fontSize={10}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
              >
                {spec.title}
              </text>
              <text
                x={14}
                y={34}
                fill="#555C62"
                fontSize={8.5}
                fontFamily="IBM Plex Sans, sans-serif"
              >
                {spec.subtitle}
              </text>

              {/* Central Core Architecture Block (strictly bounded x=132..328, width=196) */}
              <rect
                x={132}
                y={44}
                width={196}
                height={bodyH - 8}
                rx={4}
                fill="#FFFFFF"
                stroke="#303840"
                strokeWidth={1.6}
              />

              {/* Internal Stage Sub-Blocks (strictly contained inside x=140..320, width=180) */}
              {spec.stages.map((st, idx) => {
                const stH = (bodyH - 26) / spec.stages.length;
                const sy = 51 + idx * stH;
                const boxH = stH - 6;
                const midY = sy + boxH / 2;
                return (
                  <g key={idx}>
                    <rect
                      x={140}
                      y={sy}
                      width={180}
                      height={boxH}
                      rx={3}
                      fill="#E5E5E1"
                      stroke="#B8B8B1"
                      strokeWidth={1}
                    />
                    <text
                      x={230}
                      y={midY - 3}
                      textAnchor="middle"
                      fill="#20252B"
                      fontSize={8.2}
                      fontWeight={700}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {st.heading}
                    </text>
                    <text
                      x={230}
                      y={midY + 8}
                      textAnchor="middle"
                      fill="#456A83"
                      fontSize={7.3}
                      fontWeight={600}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {st.subline}
                    </text>
                  </g>
                );
              })}

              {/* Left Input / Control Pins (x=10..132) */}
              {spec.leftPins.map((lp, idx) => {
                const py =
                  56 + idx * ((bodyH - 28) / Math.max(1, spec.leftPins.length - 1 || 1));
                const stateStr = pinStateBadgeText(pinStates, lp.pin);
                return (
                  <g key={lp.pin}>
                    <line
                      x1={108}
                      y1={py}
                      x2={132}
                      y2={py}
                      stroke={pinStrokeColor(pinStates, lp.pin)}
                      strokeWidth={1.4}
                    />
                    <circle cx={108} cy={py} r={2.3} fill="#456A83" />
                    <text
                      x={103}
                      y={py + 3}
                      textAnchor="end"
                      fill="#20252B"
                      fontSize={8.4}
                      fontWeight={600}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {lp.pin}:{lp.name}
                      {stateStr}
                    </text>
                  </g>
                );
              })}

              {/* Right Output / Bidirectional I/O Pins (x=328..450) */}
              {spec.rightPins.map((rp, idx) => {
                const py =
                  56 + idx * ((bodyH - 28) / Math.max(1, spec.rightPins.length - 1 || 1));
                const stateStr = pinStateBadgeText(pinStates, rp.pin);
                return (
                  <g key={rp.pin}>
                    <line
                      x1={328}
                      y1={py}
                      x2={352}
                      y2={py}
                      stroke={pinStrokeColor(pinStates, rp.pin)}
                      strokeWidth={1.5}
                    />
                    <circle cx={352} cy={py} r={2.4} fill="#587965" />
                    <text
                      x={357}
                      y={py + 3}
                      textAnchor="start"
                      fill="#3B5746"
                      fontSize={8.5}
                      fontWeight={700}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {rp.pin}:{rp.name}
                      {stateStr}
                    </text>
                  </g>
                );
              })}

              {/* Bottom Two-Line Datasheet Reference Box (never overflows 460px viewBox) */}
              <rect
                x={12}
                y={svgH - 38}
                width={436}
                height={28}
                rx={3}
                fill="#EAE9E4"
                stroke="#D0CFC9"
                strokeWidth={0.9}
              />
              <text
                x={230}
                y={svgH - 26}
                textAnchor="middle"
                fill="#303840"
                fontSize={8}
                fontWeight={700}
                fontFamily="IBM Plex Mono, monospace"
              >
                {spec.powerLine}
              </text>
              <text
                x={230}
                y={svgH - 14}
                textAnchor="middle"
                fill="#456A83"
                fontSize={7.8}
                fontWeight={600}
                fontFamily="IBM Plex Mono, monospace"
              >
                {spec.operationLine}
              </text>
            </svg>
          );
        })()
      )}
    </div>
  );
};
