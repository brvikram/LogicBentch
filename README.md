# LogicBench — Virtual Digital Electronics Trainer Laboratory

LogicBench is a virtual digital electronics laboratory replicating a universal **DT-1004 Digital Circuit Trainer**. Students manually insert TTL, CMOS, and static RAM DIP packages into ZIF sockets or across the solderless breadboard, wire physical patch cords and jumpers, operate switches and clocks, and verify real IC-level circuit behavior.

## Key Capabilities

- **DT-1004 Trainer Hardware**:
  - Main Power supply switch with +5V and GND terminals and power-rail validation.
  - 16 independent digital input toggle switches (`SW0`–`SW15`).
  - 16 digital output LEDs (`L0`–`L15`) showing `1`, `0`, `X` (unknown/conflict), and `Z` (high impedance).
  - Manual push-button clock, Single-Step edge transition clock, and adjustable Automatic Clock + Auxiliary Pulse Generator.
  - Two onboard **LTS542** common-anode red seven-segment LED displays (`DISP1`, `DISP2`) with exposed `a–g, dp, CA` terminals.
  - Dual 16-pin ZIF IC sockets (`ZIF-1`, `ZIF-2`) with package compatibility enforcement.
  - 40-column interactive solderless breadboard with `+`/`-` rails, `A–E` and `F–J` 5-hole vertical strips, center DIP isolation channel, and DIP-24 support for `6116` SRAM.
- **25 Datasheet-Verified IC Models**:
  - Basic Gates: `7400`, `7402`, `7404`, `7408`, `7410`, `7420`, `7427`, `7432`, `7486`, `4077` (CMOS)
  - Combinational: `7483`, `7485`, `74138`, `7446`, `7447`, `74148`, `74153`, `74139`, `74151`
  - Sequential: `7474`, `7476`, `7490`, `74192`, `7495`
  - Memory: `6116` (2K × 8 Static RAM)
- **Event-Driven 4-State Simulation Engine**: Runs in a dedicated Web Worker with power validation, floating-input checks, driver-conflict detection, edge-triggered sequential evaluation, and zero hardcoded results.
- **Portable Persistence**: Local IndexedDB auto-save plus `.logicbench.json` (`logicbench-project/v1`) export/import shared with the Windows desktop Tauri 2 target.

## Development & Testing

```bash
npm install
npm run test       # Run IC library, simulation engine, and storage unit tests
npm run lint       # TypeScript typecheck
npm run build      # Production Vite bundle
npm run dev        # Start Express + Vite dev server on http://localhost:3000
```
