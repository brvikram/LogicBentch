# LogicBench Architecture

## Module Separation

1. **IC Library (`src/ic-library/`)**: Independent datasheet catalog of all 25 ICs (`definitions.ts`, `index.ts`). Zero UI dependencies.
2. **Digital Simulation Engine (`src/simulation/`)**:
   - `netlist.ts`: Disjoint-set Union-Find resolver merging trainer rails, breadboard 5-hole vertical strips, ZIF pins, breadboard DIP footprints, patch cords, and jumpers.
   - `icEvaluators.ts`: Pure 4-state (`0 | 1 | X | Z`) behavioral evaluators for all 25 ICs.
   - `engine.ts`: Stateful iterative delta-cycle solver supporting combinational propagation, cascaded ripple clocks, power validation, floating-input checks, and driver conflict detection.
   - `worker.ts` & `runner.ts`: Dedicated Web Worker execution with transparent synchronous fallback.
3. **Trainer Hardware Model (`src/trainer/boardLayout.ts`)**: Unified coordinate and terminal registry for DT-1004 panel elements and Bezier cable routing.
4. **Storage (`src/storage/projectStorage.ts`)**: IndexedDB persistence (`LogicBenchDB`) and `logicbench-project/v1` portable JSON schema.
5. **UI (`src/components/`)**: Pure React + SVG instrument views reading/writing via Zustand (`src/store/useLabStore.ts`).
