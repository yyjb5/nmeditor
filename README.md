# DeskCSV

DeskCSV is a Tauri + React + TypeScript desktop app for editing very large CSV files
with low memory usage. The current build supports streaming row loads from disk and
a virtualized grid preview.

## Quick start

```pwsh
npm install
npm run tauri dev
```

## Features (current)

- Open CSV files via native dialog
- Auto-detect delimiter (comma/semicolon/tab/pipe) with manual override
- Stream rows in pages (default 200 per fetch)
- Virtualized grid rendering for smooth scrolling

## Regression & Perf

```pwsh
# Backend large-CSV regression tests
npm run test:regression:backend

# Generate dataset + run baseline capture
npm run perf:baseline

# Compare current run with baseline file (perf/baseline.large_csv.json)
npm run perf:check

# Browser e2e regression (large-csv scroll/drag white-screen guard)
npm run test:e2e

# Optional: write/update baseline
node scripts/perf/run_large_csv_baseline.mjs --update-baseline
```

Notes:
- Perf script writes the latest run to `perf/latest.large_csv.json`.
- Default dataset is generated at `perf/generated/large_200000x12.csv`.
- Tune parameters with flags like `--rows 300000 --cols 16 --window 3000 --tolerance 0.4`.
- `perf:check` ignores very small baseline metrics (`<20ms`) and also requires at least `10ms` absolute slowdown to reduce jitter false alarms.
- E2E uses `window.__NMEDITOR_BRIDGE__` mock + `window` custom event channel (`nmeditor:menu-event`) to run browser-mode regression without native Tauri runtime.

## Next milestones

- Editable grid with patch/undo store
- Macro and batch operations
- Robust delimiter switching with preview
