/**
 * Application Constants
 * 
 * Central location for all application-wide constants.
 */

import type { DelimiterPreset } from "../types";

/**
 * CSV delimiter presets
 */
export const DELIMITER_PRESETS: DelimiterPreset[] = [
    { label: "Comma (,)", value: "," },
    { label: "Semicolon (;)", value: ";" },
    { label: "Tab (\\t)", value: "\t" },
    { label: "Pipe (|)", value: "|" },
];

/**
 * Memory and performance constants
 */
export const MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const AUTO_INDEX_THRESHOLD_BYTES = 300 * 1024 * 1024; // 300MB
export const WINDOW_TARGET_BYTES = 64 * 1024 * 1024; // 64MB
export const WINDOW_MIN_ROWS = 200;
export const WINDOW_MAX_ROWS = 2000;

/**
 * UI constants
 */
export const MAX_UI_COLUMNS = 2000;
export const TAB_ROW_SNAPSHOT_LIMIT = 200;

/**
 * Debounce timing constants
 */
export const GLOBAL_VIEW_REBUILD_DEBOUNCE_MS = 650;
export const GLOBAL_VIEW_PATCH_DEBOUNCE_MS = 220;

/**
 * Prefetch configuration
 */
export const PREFETCH_ENABLED = true;
