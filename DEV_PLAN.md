# DeskCSV Development Plan

## Goals
- Open and edit very large CSV files with minimal memory usage (only visible window and small buffers in memory).
- Spreadsheet-like editing experience with row/column navigation, inline edits, copy/paste, undo/redo.
- Flexible delimiter/quote/escape handling and switching, with preview before applying.
- Macro/batch operations for repetitive transforms and scripted edits.

## Architecture Overview
- **Frontend (React/Vite/Tauri)**: Virtualized grid for rows/columns; edit model tracks cell-level dirty patches; worker-based parsing to avoid blocking UI.
- **Backend (Tauri Rust commands)**: Streamed CSV read/write using the `csv` crate; chunked I/O with backpressure; temp swap files for save/export; exposes commands for delimiter changes and batch ops.
- **Data Flow**:
  - Load: backend streams rows -> framed chunks -> frontend parses into lightweight row slices; only viewport rows retained plus small lookahead cache.
  - Edit: frontend stores patches `{row, col, value}`; backend applies patches on export/save by replaying against streamed source.
  - Save: backend streams original file + patches to a temp file, then atomic replace.

## Key Components
- **Grid**: Row/column virtualization (e.g., `react-virtualized`-style custom grid); frozen header; column sizer; selection model.
- **Parser Layer**: Web Worker uses `PapaParse` or custom parser to tokenize chunks from backend; supports configurable delimiter/quote/escape/newline.
- **Delimiter Manager**: Presets (`,`, `;`, `\t`, `|`, custom), auto-detect heuristic on sample; preview modal showing first N rows before applying.
- **Patch Store**: Indexed by row and column; supports undo/redo stack; diff count for dirty indicator.
- **Macro/Batch**: Record UI actions (edit, fill, replace, find/replace, column insert/delete); store as JSON; playback on selection or whole file. Allow advanced mode: user JS macro executed in sandboxed worker with limited API.
- **Search/Filter**: Streaming search with backend assist for large files; optional sampling for preview.

## Performance & Memory Strategy
- Keep viewport cache (e.g., 2x screen height) and discard scrolled-off rows.
- Chunk size negotiated between backend and frontend (e.g., 64–256 KB); apply backpressure if grid is busy.
- Avoid full materialization: no full column stats unless requested; compute lazily via streamed passes.
- Use copy-on-write patches; do not rewrite base rows in memory.

## File Operations (Rust side)
- `open_csv(path, options)`: returns stream handle, schema preview (first N rows), detected delimiter.
- `read_chunk(handle, start_row, num_rows)`: reads slice without loading whole file; uses byte offsets index built lazily.
- `apply_patches_and_save(handle, patches, target_path?)`: stream original + patches into temp, then atomic rename.
- `change_delimiter(handle, options)`: reparse stream with new separator and update offsets.
- `run_macro(handle, macro_spec)`: executes predefined operations server-side when possible for speed.

## Frontend UI Slices
- **Shell**: toolbar (open/save/export), delimiter selector, status bar (rows loaded, dirty state, memory hint).
- **Grid Panel**: virtualized table, inline editor, context menu, drag-fill, column resize/reorder.
- **Sidebar**: macros list, batch ops presets, search/replace controls.
- **Preview Modal**: delimiter switch preview, sample rows, error diagnostics.

## Testing & Validation
- Unit tests for patch store, delimiter parsing, macro recorder/replayer.
- Integration tests for streaming load/save (Rust); snapshot tests for grid rendering basics.
- Large-file smoke tests (synthetic 10M+ rows) to verify memory ceiling and scroll performance.

## Next Steps
1. Wire basic React shell with virtualized grid scaffold and Tauri IPC plumbing.
2. Implement Rust CSV stream open/read with chunked offsets and simple preview.
3. Add delimiter manager UI + backend detection.
4. Build patch store with undo/redo and apply on save/export.
5. Implement macro record/playback MVP (UI actions -> JSON).
