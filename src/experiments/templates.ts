import { ExperimentTemplate } from '../types/circuit';

/**
 * Extensible College Experiment Framework.
 * Note: These are clearly labeled Reference Test Examples demonstrating how
 * DDHDL laboratory manual procedures map onto the DT-1004 virtual trainer.
 * Students still build and wire every circuit manually on the trainer.
 */
export const EXPERIMENT_TEMPLATES: ExperimentTemplate[] = [
  {
    id: 'exp-example-7400-nand',
    title: 'Test Example 01: Verification of 7400 Quad 2-Input NAND Gate',
    category: 'Basic Logic Gates (Reference Test Example)',
    isExample: true,
    aim: 'To verify the truth table and electrical operation of a 2-input NAND gate using IC 7400 on the DT-1004 trainer.',
    requiredICs: ['7400'],
    constructionNotes: [
      'Insert IC 7400 into ZIF-1 (14-pin top-aligned: IC pins 1–7 map to ZIF1:1–7, IC pins 8–14 map to ZIF1:10–16).',
      'Always wire Pin 14 (VCC -> ZIF1:16) to +5V and Pin 7 (GND -> ZIF1:7) to GND before testing signals.',
      'Connect Digital Input Switches SW0 and SW1 to Gate 1 inputs (Pin 1 = 1A, Pin 2 = 1B).',
      'Connect Gate 1 output (Pin 3 = 1Y) to Output Indicator LED0.',
    ],
    pinConnections: [
      { from: 'PWR:+5V:0', to: 'ZIF1:16 (IC Pin 14: VCC)', signal: '+5V Supply' },
      { from: 'PWR:GND:0', to: 'ZIF1:7 (IC Pin 7: GND)', signal: 'Ground (0V)' },
      { from: 'SW:0', to: 'ZIF1:1 (IC Pin 1: 1A)', signal: 'Input A' },
      { from: 'SW:1', to: 'ZIF1:2 (IC Pin 2: 1B)', signal: 'Input B' },
      { from: 'ZIF1:3 (IC Pin 3: 1Y)', to: 'LED:0', signal: 'NAND Output Y' },
    ],
    procedure: [
      'Place 7400 into ZIF-1 using the Insert IC control.',
      'Make the five patch-cord connections listed in the pin table manually.',
      'Switch ON the main Trainer POWER.',
      'Toggle SW0 and SW1 across all four binary combinations (00, 01, 10, 11) and record LED0.',
    ],
    truthTable: [
      { id: 'r0', label: 'A=0, B=0', inputs: { SW0: 0, SW1: 0 }, expected: { LED0: 1 } },
      { id: 'r1', label: 'A=0, B=1', inputs: { SW0: 0, SW1: 1 }, expected: { LED0: 1 } },
      { id: 'r2', label: 'A=1, B=0', inputs: { SW0: 1, SW1: 0 }, expected: { LED0: 1 } },
      { id: 'r3', label: 'A=1, B=1', inputs: { SW0: 1, SW1: 1 }, expected: { LED0: 0 } },
    ],
    expectedResult: 'LED0 remains HIGH (1) for inputs 00, 01, 10 and goes LOW (0) only when both SW0 and SW1 are HIGH (11).',
  },
  {
    id: 'exp-example-7476-jk',
    title: 'Test Example 02: Negative-Edge JK Flip-Flop (IC 7476)',
    category: 'Sequential Logic (Reference Test Example)',
    isExample: true,
    aim: 'To study Set, Reset, Hold, Toggle, and asynchronous Preset/Clear operations of the 7476 Dual JK Flip-Flop.',
    requiredICs: ['7476'],
    constructionNotes: [
      '7476 is a 16-pin DIP with non-standard power pins: VCC is Pin 5 and GND is Pin 13.',
      'Flip-flop 1 uses Pin 1 (1CLK, negative-edge), Pin 2 (~1PRE), Pin 3 (~1CLR), Pin 4 (1J), Pin 16 (1K), Pin 15 (1Q), Pin 14 (~1Q).',
      'Keep ~1PRE and ~1CLR at HIGH (+5V or switches set to 1) during clocked operation.',
    ],
    pinConnections: [
      { from: 'PWR:+5V:0', to: 'ZIF1:5 (Pin 5: VCC)', signal: '+5V Supply' },
      { from: 'PWR:GND:0', to: 'ZIF1:13 (Pin 13: GND)', signal: 'Ground (0V)' },
      { from: 'CLK:OUT', to: 'ZIF1:1 (Pin 1: 1CLK)', signal: 'Manual/Step Clock' },
      { from: 'SW:0', to: 'ZIF1:2 (Pin 2: ~1PRE)', signal: 'Async Preset (Active-Low)' },
      { from: 'SW:1', to: 'ZIF1:3 (Pin 3: ~1CLR)', signal: 'Async Clear (Active-Low)' },
      { from: 'SW:2', to: 'ZIF1:4 (Pin 4: 1J)', signal: 'J Input' },
      { from: 'SW:3', to: 'ZIF1:16 (Pin 16: 1K)', signal: 'K Input' },
      { from: 'ZIF1:15 (Pin 15: 1Q)', to: 'LED:0', signal: 'Output Q' },
      { from: 'ZIF1:14 (Pin 14: ~1Q)', to: 'LED:1', signal: 'Output ~Q' },
    ],
    procedure: [
      'Insert 7476 into ZIF-1 and wire power (Pin 5=+5V, Pin 13=GND) and signals.',
      'Test ~1CLR=0 (SW1=0) to confirm asynchronous clear sets Q=0, ~Q=1.',
      'Set SW0=1 (~PRE=1) and SW1=1 (~CLR=1).',
      'Test J=1, K=0 then pulse the Manual/Single-Step Clock through HIGH -> LOW to observe negative-edge Set.',
      'Set J=1, K=1 and pulse clock repeatedly to observe Q toggling strictly on falling edges.',
    ],
    truthTable: [
      { id: 'jk1', label: 'Async Clear (~PRE=1, ~CLR=0)', inputs: { SW0: 1, SW1: 0, SW2: 0, SW3: 0 }, expected: { LED0: 0, LED1: 1 } },
      { id: 'jk2', label: 'Async Preset (~PRE=0, ~CLR=1)', inputs: { SW0: 0, SW1: 1, SW2: 0, SW3: 0 }, expected: { LED0: 1, LED1: 0 } },
    ],
    expectedResult: 'Q updates strictly on negative clock transitions (1 -> 0) when ~PRE and ~CLR are HIGH.',
  },
  {
    id: 'exp-example-7490-decade',
    title: 'Test Example 03: BCD Decade Counter (IC 7490)',
    category: 'Counters (Reference Test Example)',
    isExample: true,
    aim: 'To configure IC 7490 as a modulo-10 BCD counter by cascading its internal divide-by-2 and divide-by-5 sections.',
    requiredICs: ['7490'],
    constructionNotes: [
      '7490 is a 14-pin DIP with non-corner power: VCC is Pin 5 (ZIF1:5) and GND is Pin 10 (ZIF1:12).',
      'Externally jumper QA (IC Pin 12 -> ZIF1:14) to CKB (IC Pin 1 -> ZIF1:1) to form a BCD 0–9 counter.',
      'Tie R0(1), R0(2) (Pins 2, 3) and R9(1), R9(2) (Pins 6, 7) to GND (or switches) during normal counting.',
    ],
    pinConnections: [
      { from: 'PWR:+5V:0', to: 'ZIF1:5 (IC Pin 5: VCC)', signal: '+5V Supply' },
      { from: 'PWR:GND:0', to: 'ZIF1:12 (IC Pin 10: GND)', signal: 'Ground (0V)' },
      { from: 'CLK:OUT', to: 'ZIF1:16 (IC Pin 14: CKA)', signal: 'Clock Input A' },
      { from: 'ZIF1:14 (IC Pin 12: QA)', to: 'ZIF1:1 (IC Pin 1: CKB)', signal: 'Div-2 to Div-5 Cascade' },
      { from: 'SW:0', to: 'ZIF1:2 (IC Pin 2: R0(1))', signal: 'Reset-to-0 (1)' },
      { from: 'SW:0', to: 'ZIF1:3 (IC Pin 3: R0(2))', signal: 'Reset-to-0 (2)' },
      { from: 'PWR:GND:1', to: 'ZIF1:6 (IC Pin 6: R9(1))', signal: 'Reset-to-9 (1) = 0' },
      { from: 'PWR:GND:2', to: 'ZIF1:7 (IC Pin 7: R9(2))', signal: 'Reset-to-9 (2) = 0' },
      { from: 'ZIF1:14 (QA)', to: 'LED:0', signal: 'BCD Bit 0 (LSB)' },
      { from: 'ZIF1:11 (QB)', to: 'LED:1', signal: 'BCD Bit 1' },
      { from: 'ZIF1:10 (QC)', to: 'LED:2', signal: 'BCD Bit 2' },
      { from: 'ZIF1:13 (QD)', to: 'LED:3', signal: 'BCD Bit 3 (MSB)' },
    ],
    procedure: [
      'Insert 7490 into ZIF-1 and complete power, cascade, reset, and LED connections.',
      'Ensure SW0=0 so reset R0 is inactive.',
      'Pulse the clock and observe LED3..LED0 counting from 0000 (0) through 1001 (9) and wrapping to 0000.',
      'Set SW0=1 to verify asynchronous reset to 0000.',
    ],
    truthTable: [
      { id: 'cnt0', label: 'Master Reset (R0=1)', inputs: { SW0: 1 }, expected: { LED0: 0, LED1: 0, LED2: 0, LED3: 0 } },
    ],
    expectedResult: 'LED3..LED0 increment through BCD states 0–9 on falling clock edges and roll over from 9 (1001) to 0 (0000).',
  },
  {
    id: 'exp-example-7447-7seg',
    title: 'Test Example 04: BCD-to-Seven-Segment Display Driver (IC 7447 + Onboard LTS542)',
    category: 'Display & Decoders (Reference Test Example)',
    isExample: true,
    aim: 'To decode 4-bit BCD switch inputs via IC 7447 and drive the onboard LTS542 common-anode seven-segment display.',
    requiredICs: ['7447'],
    constructionNotes: [
      'Insert 7447 into ZIF-1 (16-pin: VCC=16, GND=8).',
      'Tie ~LT (Pin 3), ~BI/~RBO (Pin 4), and ~RBI (Pin 5) to +5V for normal decoding.',
      'Connect DISP1:CA to +5V (common anode) and 7447 pins a..g (13, 12, 11, 10, 9, 15, 14) to DISP1:a..g.',
    ],
    pinConnections: [
      { from: 'PWR:+5V:0', to: 'ZIF1:16 (Pin 16: VCC)', signal: '+5V Supply' },
      { from: 'PWR:GND:0', to: 'ZIF1:8 (Pin 8: GND)', signal: 'Ground (0V)' },
      { from: 'PWR:+5V:1', to: 'ZIF1:3, ZIF1:4, ZIF1:5', signal: '~LT, ~BI/~RBO, ~RBI = HIGH' },
      { from: 'SW:0..SW:3', to: 'ZIF1:7(A), 1(B), 2(C), 6(D)', signal: 'BCD Inputs (A=LSB..D=MSB)' },
      { from: 'ZIF1:13,12,11,10,9,15,14', to: 'DISP1:a..g', signal: 'Active-Low Segment Cathodes' },
      { from: 'PWR:+5V:2', to: 'DISP1:CA', signal: 'Display Common Anode (+5V)' },
    ],
    procedure: [
      'Insert 7447 into ZIF-1 and wire power, control inputs, BCD switches, and DISP1 segments.',
      'Set BCD switches SW3..SW0 from 0000 (0) to 1001 (9) and verify digits on onboard DISP1.',
      'Temporarily move ~LT (Pin 3) to GND to verify Lamp Test illuminates all 7 segments (digit 8).',
    ],
    truthTable: [
      { id: 'd0', label: 'BCD 0 (0000)', inputs: { SW3: 0, SW2: 0, SW1: 0, SW0: 0 }, expected: {} },
      { id: 'd5', label: 'BCD 5 (0101)', inputs: { SW3: 0, SW2: 1, SW1: 0, SW0: 1 }, expected: {} },
      { id: 'd9', label: 'BCD 9 (1001)', inputs: { SW3: 1, SW2: 0, SW1: 0, SW0: 1 }, expected: {} },
    ],
    expectedResult: 'Onboard DISP1 accurately renders decimal digits 0–9 corresponding to BCD switches SW3..SW0.',
  },
  {
    id: 'exp-example-6116-sram',
    title: 'Test Example 05: 2K × 8 Static RAM Read/Write Operation (IC 6116)',
    category: 'Memory (Reference Test Example)',
    isExample: true,
    aim: 'To insert the 24-pin 6116 SRAM into the dedicated 24-pin ZIF-5 socket and verify write (~WR=0), standby Hi-Z, and read (~RE=0, ~WR=1) cycles.',
    requiredICs: ['6116'],
    constructionNotes: [
      'Insert the 24-pin 6116 SRAM into ZIF-5 (24-Pin RAM socket, internal +5V/GND integrated).',
      'Connect A0..A2 (Pins 8, 7, 6) to address switches SW0..SW2.',
      'Connect ~CS (Pin 18), ~RE (Pin 20, Read Enable), and ~WR (Pin 21, Write Enable) to control switches SW3, SW4, SW5.',
      'Use ~CS=0, ~WR=0 to write data from data switches onto I/O0..I/O3; set ~CS=0, ~WR=1, ~RE=0 to read stored memory onto LED0..LED3.',
    ],
    pinConnections: [
      { from: 'SW:0..SW:2', to: 'ZIF5:8,7,6 (A0..A2)', signal: 'Low Address Bits' },
      { from: 'SW:3..SW:5', to: 'ZIF5:18(~CS), 20(~RE), 21(~WR)', signal: 'Control Signals (~CS, ~RE, ~WR)' },
      { from: 'SW:6..SW:9', to: 'ZIF5:9..11,13 (I/O0..I/O3)', signal: 'Data Input Switches (Write Mode)' },
      { from: 'ZIF5:9..11,13 (I/O0..I/O3)', to: 'LED:0..LED:3', signal: 'Data Bus Output Indicators' },
    ],
    procedure: [
      'Insert 6116 into ZIF-5 (24-Pin RAM socket).',
      'Wire A0..A2 (Pins 8, 7, 6), control pins ~CS (18), ~RE (20), ~WR (21), and I/O0..I/O3 (Pins 9, 10, 11, 13) to switches and LEDs.',
      'Set ~CS=0, ~WR=0 (~RE=1) to write a 4-bit word into the selected address, then set ~CS=0, ~WR=1, ~RE=0 to read back from memory.',
    ],
    truthTable: [
      { id: 'm1', label: 'Standby (~CS=1)', inputs: { SW3: 1 }, expected: { LED0: 'Z', LED1: 'Z', LED2: 'Z', LED3: 'Z' } },
    ],
    expectedResult: 'Data written during ~CS=0, ~WR=0 is retained in the 2048-byte memory array and read back strictly when ~CS=0, ~RE=0, ~WR=1.',
  },
];

