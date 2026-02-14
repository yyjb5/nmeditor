/**
 * CSV Editor Type Definitions
 * 
 * This file contains all type definitions related to CSV editing functionality.
 */

/**
 * Patch entry for tracking cell modifications
 */
export type PatchEntry = {
    key: string;
    value: string
};

/**
 * Find match result in CSV
 */
export type FindMatch = {
    row: number;
    col: number;
    value: string
};

/**
 * Source of find matches
 */
export type FindMatchSource = "loaded" | "file" | "view";

/**
 * Undo/Redo operation types for CSV editing
 */
export type UndoOp =
    | { kind: "cell"; key: string; prev: string | null; next: string | null }
    | { kind: "bulk"; entries: Array<{ key: string; prev: string | null; next: string | null }> }
    | { kind: "clear_rows"; rows: number[]; patches: PatchEntry[] }
    | { kind: "clear_cols"; cols: number[]; patches: PatchEntry[] }
    | { kind: "row_insert"; index: number; values: string[] }
    | { kind: "row_delete"; index: number; values: string[]; wasCleared?: boolean }
    | { kind: "col_insert"; index: number; name: string }
    | {
        kind: "col_delete";
        index: number;
        name: string;
        values: Array<{ row: number; value: string }>;
        wasCleared?: boolean;
    }
    | { kind: "col_rename"; index: number; prev: string; next: string }
    | { kind: "row_duplicate"; index: number; values: string[] }
    | { kind: "col_duplicate"; index: number };

/**
 * CSV data state for a tab
 */
export type CsvTabData = {
    rows: string[][];
    headers: string[];
    delimiter: string;
    delimiterApplied: string | null;
    windowStart: number;
    windowSize: number;
    eof: boolean;
    patches: Record<string, string>;
    undoStack: UndoOp[];
    redoStack: UndoOp[];
    columnWidths: number[];
    rowHeaderWidth: number;
    rowHeight: number;
    headerHeightOverride: number | null;
    rowHeightOverrides: Record<number, number>;
    autoFitColumns: boolean;
    hiddenCols: number[];
    totalRows: number | null;
    preview: { path: string; delimiter: string } | null;
    activePath: string | null;
    rowOps: any; // TODO: type this properly from useRowColumnOps
    columnOps: any; // TODO: type this properly from useRowColumnOps
    clearedRows: number[];
    clearedCols: number[];
    columnOrder: number[];
};

/**
 * Delimiter preset configuration
 */
export type DelimiterPreset = {
    label: string;
    value: string;
};

/**
 * Column resize state
 */
export type ResizeState =
    | { type: "col"; index: number; startX: number; startWidth: number }
    | { type: "colAll"; startX: number; startWidths: number[]; startRowHeaderWidth: number }
    | { type: "row"; startX: number; startWidth: number }
    | { type: "headerRow"; startY: number; startHeight: number }
    | { type: "rowHeightAll"; startY: number; startHeight: number }
    | { type: "rowHeightRow"; rowIndex: number; startY: number; startHeight: number }
    | null;

/**
 * Sort rule configuration
 */
export type SortRule = {
    column: string;
    direction: "asc" | "desc";
};

/**
 * Filter rule configuration
 */
export type FilterRule = {
    column: string;
    value: string;
};

/**
 * Header editing state
 */
export type HeaderEditingState = {
    index: number;
    value: string;
} | null;

/**
 * Cell editing state
 */
export type CellEditingState = {
    row: number;
    col: number;
    value: string;
} | null;

/**
 * Auto-index mode configuration
 */
export type AutoIndexMode = "all" | "auto" | "manual";

/**
 * Paste mode configuration
 */
export type PasteMode = "auto" | "strict" | "delimiter";
