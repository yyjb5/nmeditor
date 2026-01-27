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

## Next milestones

- Editable grid with patch/undo store
- Macro and batch operations
- Robust delimiter switching with preview
