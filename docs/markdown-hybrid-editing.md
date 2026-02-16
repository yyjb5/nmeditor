# Markdown Hybrid Editing (T-MD-011)

## Goal

Reduce mismatch between editing caret and rendered Markdown while keeping editing latency low on large files.

## Options Evaluated

1. Full WYSIWYG editor
- Pros: closest visual model.
- Cons: high integration cost with existing plain-text workflows (multi-cursor, bookmarks, line/offset navigation), and higher regression risk.

2. Split pane (source + preview)
- Pros: clear separation, simple to reason about.
- Cons: doubles viewport usage and breaks "single surface" editing flow.

3. Single-surface hybrid overlay (chosen)
- Pros: keeps one editing surface, supports realtime render, preserves existing text editing behaviors.
- Cons: still not true WYSIWYG; complex markdown layouts can have visual/caret divergence.

## Landed Design

- One panel only: textarea remains the editing source of truth.
- Realtime Markdown render overlay in the same editor area.
- Optional one-click `Source mode` to disable render overlay and edit pure text.
- Deferred render path for large content to reduce input blocking.
- Render pipeline upgraded to `remark-gfm + rehype-sanitize` for safer and more accurate output.

## Follow-ups

- Add optional block-level "focus highlight" around caret-neighbor Markdown block.
- Add optional typography presets (compact vs. reading).
- Add lightweight render perf telemetry for large Markdown files.
