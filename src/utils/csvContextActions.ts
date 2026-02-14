import type { Dispatch, SetStateAction } from "react";
import type { CsvContextMenuState } from "../components/CsvContextMenu/types";

type PatchEntry = { key: string; value: string };

type ActiveRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type ContextUndoOp =
  | { kind: "row_duplicate"; index: number; values: string[] }
  | { kind: "col_duplicate"; index: number }
  | { kind: "clear_rows"; rows: number[]; patches: PatchEntry[] }
  | { kind: "clear_cols"; cols: number[]; patches: PatchEntry[] };

export type RunCsvContextActionParams = {
  action: string;
  contextMenu: CsvContextMenuState | null;
  hasSortFilter: boolean;
  t: (en: string, zh: string) => string;
  setError: (value: string | null) => void;
  setContextMenu: Dispatch<SetStateAction<CsvContextMenuState | null>>;
  insertRowWithUndo: (index: number) => void;
  insertRowAtIndex: (index: number, values: string[]) => void;
  deleteRowWithUndo: (index: number) => void;
  insertColumnWithUndo: (index: number) => void;
  deleteColumnWithUndo: (index: number) => void;
  duplicateColumnAtIndex: (index: number) => void;
  startHeaderEditing: (index: number) => void;
  shiftClearedRowsOnInsert: (index: number) => void;
  shiftClearedColsOnInsert: (index: number) => void;
  dataColumnCount: number;
  getCellValue: (row: number, col: number) => string;
  getActiveRange: () => ActiveRange | null;
  setClearedRows: Dispatch<SetStateAction<Set<number>>>;
  setClearedCols: Dispatch<SetStateAction<Set<number>>>;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  appendUndo: (op: ContextUndoOp) => void;
  resetRedo: () => void;
  headers: string[];
};

export const runCsvContextAction = async ({
  action,
  contextMenu,
  hasSortFilter,
  t,
  setError,
  setContextMenu,
  insertRowWithUndo,
  insertRowAtIndex,
  deleteRowWithUndo,
  insertColumnWithUndo,
  deleteColumnWithUndo,
  duplicateColumnAtIndex,
  startHeaderEditing,
  shiftClearedRowsOnInsert,
  shiftClearedColsOnInsert,
  dataColumnCount,
  getCellValue,
  getActiveRange,
  setClearedRows,
  setClearedCols,
  setPatches,
  appendUndo,
  resetRedo,
  headers,
}: RunCsvContextActionParams): Promise<void> => {
  if (!contextMenu) return;
  if (hasSortFilter) {
    setError(
      t(
        "Disable sort/filter before editing rows/columns.",
        "Disable sort/filter before editing rows/columns.",
      ),
    );
    setContextMenu(null);
    return;
  }
  if (contextMenu.type === "row") {
    const index = contextMenu.index;
    if (action === "insert_above") {
      insertRowWithUndo(index);
    }
    if (action === "insert_below") {
      insertRowWithUndo(index + 1);
    }
    if (action === "duplicate") {
      const values = new Array(dataColumnCount).fill("").map((_, col) => getCellValue(index, col));
      shiftClearedRowsOnInsert(index + 1);
      insertRowAtIndex(index + 1, values);
      appendUndo({ kind: "row_duplicate", index: index + 1, values });
      resetRedo();
    }
    if (action === "clear") {
      const range = getActiveRange();
      const start = range ? Math.min(range.startRow, range.endRow) : index;
      const end = range ? Math.max(range.startRow, range.endRow) : index;
      const rowsToAdd: number[] = [];
      const removedPatches: PatchEntry[] = [];
      setClearedRows((current) => {
        const next = new Set(current);
        for (let row = start; row <= end; row += 1) {
          if (!next.has(row)) rowsToAdd.push(row);
          next.add(row);
        }
        return next;
      });
      setPatches((current) => {
        const next: Record<string, string> = {};
        Object.entries(current).forEach(([key, value]) => {
          const [row] = key.split(":").map(Number);
          if (row < start || row > end) {
            next[key] = value;
          } else {
            removedPatches.push({ key, value });
          }
        });
        return next;
      });
      if (rowsToAdd.length || removedPatches.length) {
        appendUndo({ kind: "clear_rows", rows: rowsToAdd, patches: removedPatches });
        resetRedo();
      }
    }
    if (action === "delete") {
      deleteRowWithUndo(index);
    }
  }
  if (contextMenu.type === "col") {
    const index = contextMenu.index;
    if (action === "insert_left") {
      insertColumnWithUndo(index);
    }
    if (action === "insert_right") {
      insertColumnWithUndo(index + 1);
    }
    if (action === "duplicate") {
      shiftClearedColsOnInsert(index + 1);
      duplicateColumnAtIndex(index);
      appendUndo({ kind: "col_duplicate", index });
      resetRedo();
    }
    if (action === "copy_name") {
      try {
        await navigator.clipboard.writeText(headers[index] ?? "");
      } catch (err) {
        setError(String(err));
      }
    }
    if (action === "clear") {
      const range = getActiveRange();
      const start = range ? Math.min(range.startCol, range.endCol) : index;
      const end = range ? Math.max(range.startCol, range.endCol) : index;
      const colsToAdd: number[] = [];
      const removedPatches: PatchEntry[] = [];
      setClearedCols((current) => {
        const next = new Set(current);
        for (let col = start; col <= end; col += 1) {
          if (!next.has(col)) colsToAdd.push(col);
          next.add(col);
        }
        return next;
      });
      setPatches((current) => {
        const next: Record<string, string> = {};
        Object.entries(current).forEach(([key, value]) => {
          const [, col] = key.split(":").map(Number);
          if (col < start || col > end) {
            next[key] = value;
          } else {
            removedPatches.push({ key, value });
          }
        });
        return next;
      });
      if (colsToAdd.length || removedPatches.length) {
        appendUndo({ kind: "clear_cols", cols: colsToAdd, patches: removedPatches });
        resetRedo();
      }
    }
    if (action === "delete") {
      deleteColumnWithUndo(index);
    }
    if (action === "rename") startHeaderEditing(index);
  }
  setContextMenu(null);
};
