# LogicBench Windows Desktop Packaging (Tauri 2)

The Windows desktop build reuses the exact same React, TypeScript, simulation engine (`src/simulation/`), IC library (`src/ic-library/`), and portable project schema (`logicbench-project/v1`) built into `../dist`.

## Prerequisites (Windows Build Machine)

1. Rust toolchain (`rustup` with `stable-x86_64-pc-windows-msvc`)
2. Microsoft Edge WebView2 Runtime
3. Tauri CLI v2 (`npm install -D @tauri-apps/cli`)

## Build Steps

```bash
# From workspace root
npm run build

# Initialize Rust Tauri shell referencing desktop/tauri.conf.json
npx tauri build --config desktop/tauri.conf.json
```

Because `DigitalSimulationEngine`, `netlist.ts`, `icEvaluators.ts`, and `projectStorage.ts` (`logicbench-project/v1` JSON schema) are 100% platform-agnostic TypeScript modules, projects exported from the web app open identically in the Windows desktop executable.
