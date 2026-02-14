import { useCallback, useState } from "react";
import type { UndoOp } from "../types";
import useRowColumnOps from "./useRowColumnOps";
import useEditingState from "./useEditingState";
import type { SelectionRange } from "./useSelection";

export interface UseCsvDataModelOptions {
    rows: string[][];
    headers: string[];
    setRows: (updater: (current: string[][]) => string[][]) => void;
    setHeaders: (updater: (current: string[]) => string[]) => void;
    windowStart: number;
    dataColumnCount: number;
    rowIndexMap: number[] | null;
    rowIndexInput: string;
    columnIndexInput: string;
    columnNameInput: string;
    pasteMode: "auto" | "strict" | "delimiter";
    getCurrentDelimiter: () => string;
    getActiveRange: () => SelectionRange | null;
    clearSelection: () => void;
    setError: (value: string | null) => void;
    onGlobalViewPatchRefresh?: (col: number) => void;
    t: (en: string, zh: string) => string;
}

export default function useCsvDataModel({
    rows,
    headers,
    setRows,
    setHeaders,
    windowStart,
    dataColumnCount,
    rowIndexMap,
    rowIndexInput,
    columnIndexInput,
    columnNameInput,
    pasteMode,
    getCurrentDelimiter,
    getActiveRange,
    clearSelection,
    setError,
    onGlobalViewPatchRefresh,
    t,
}: UseCsvDataModelOptions) {
    // --- State ---
    const [patches, setPatches] = useState<Record<string, string>>({});
    const [undoStack, setUndoStack] = useState<UndoOp[]>([]);
    const [redoStack, setRedoStack] = useState<UndoOp[]>([]);
    const [clearedRows, setClearedRows] = useState<Set<number>>(new Set());
    const [clearedCols, setClearedCols] = useState<Set<number>>(new Set());

    // --- Helpers: Map View Row ---
    const mapViewRowToBase = useCallback(
        (viewRow: number) => {
            if (!rowIndexMap) return viewRow;
            const offset = viewRow - windowStart;
            if (offset < 0 || offset >= rowIndexMap.length) return viewRow;
            return rowIndexMap[offset];
        },
        [rowIndexMap, windowStart],
    );

    // --- Helpers: Data Access ---
    const getCellValue = useCallback(
        (row: number, col: number) => {
            const baseRow = mapViewRowToBase(row);
            const key = `${baseRow}:${col}`;
            if (Object.prototype.hasOwnProperty.call(patches, key)) {
                return patches[key];
            }
            if (clearedRows.has(baseRow) || clearedCols.has(col)) {
                return "";
            }
            const localRow = row - windowStart;
            if (localRow < 0 || localRow >= rows.length) return "";
            return rows[localRow]?.[col] ?? "";
        },
        [clearedCols, clearedRows, mapViewRowToBase, patches, rows, windowStart],
    );

    const captureRowValues = (rowIndex: number) =>
        new Array(dataColumnCount).fill("").map((_, col) => getCellValue(rowIndex, col));

    const captureColumnValues = (colIndex: number) => {
        const values: Array<{ row: number; value: string }> = [];
        for (let offset = 0; offset < rows.length; offset += 1) {
            const rowIndex = windowStart + offset;
            const value = getCellValue(rowIndex, colIndex);
            if (value !== "") {
                values.push({ row: rowIndex, value });
            }
        }
        return values;
    };

    // --- Helpers: Patching ---
    const applyPatchValue = useCallback(
        (key: string, value: string | null) => {
            const sep = key.lastIndexOf(":");
            if (sep >= 0) {
                const col = Number.parseInt(key.slice(sep + 1), 10);
                if (!Number.isNaN(col) && onGlobalViewPatchRefresh) {
                    onGlobalViewPatchRefresh(col);
                }
            }
            setPatches((current) => {
                const updated = { ...current };
                if (value === null) {
                    delete updated[key];
                } else {
                    updated[key] = value;
                }
                return updated;
            });
        },
        [onGlobalViewPatchRefresh],
    );

    const applyPatch = useCallback(
        (row: number, col: number, value: string) => {
            const localRow = row - windowStart;
            if (localRow < 0 || localRow >= rows.length) return;
            const baseRow = mapViewRowToBase(row);
            const key = `${baseRow}:${col}`;
            const baseValue = rows[localRow]?.[col] ?? "";
            const hasPatch = Object.prototype.hasOwnProperty.call(patches, key);
            const currentValue = hasPatch ? patches[key] : baseValue;
            if (value === currentValue) return;

            const nextValue = value === baseValue ? null : value;
            applyPatchValue(key, nextValue);
            return { key, prev: hasPatch ? patches[key] : baseValue, next: nextValue };
        },
        [applyPatchValue, mapViewRowToBase, patches, rows, windowStart],
    );

    const applyPatchWithUndo = useCallback(
        (row: number, col: number, value: string) => {
            const entry = applyPatch(row, col, value);
            if (!entry) return;
            setUndoStack((current) => [...current, { kind: "cell", ...entry }]);
            setRedoStack([]);
        },
        [applyPatch],
    );

    // --- Helpers: Cleared Rows/Cols Shifting ---
    const shiftClearedRowsOnInsert = (index: number) => {
        setClearedRows((current) => {
            const next = new Set<number>();
            current.forEach((value) => {
                next.add(value >= index ? value + 1 : value);
            });
            return next;
        });
    };

    const shiftClearedRowsOnDelete = (index: number) => {
        setClearedRows((current) => {
            const next = new Set<number>();
            current.forEach((value) => {
                if (value === index) return;
                next.add(value > index ? value - 1 : value);
            });
            return next;
        });
    };

    const shiftClearedColsOnInsert = (index: number) => {
        setClearedCols((current) => {
            const next = new Set<number>();
            current.forEach((value) => {
                next.add(value >= index ? value + 1 : value);
            });
            return next;
        });
    };

    const shiftClearedColsOnDelete = (index: number) => {
        setClearedCols((current) => {
            const next = new Set<number>();
            current.forEach((value) => {
                if (value === index) return;
                next.add(value > index ? value - 1 : value);
            });
            return next;
        });
    };

    // --- Editing State (Wrapped) ---
    const {
        editingCell,
        editingHeader,
        setEditingCell,
        setEditingHeader,
        startEditing,
        commitEditing,
        cancelEditing,
        startHeaderEditing,
        commitHeaderEditing,
        cancelHeaderEditing,
    } = useEditingState({
        getCellValue,
        applyPatchWithUndo,
        renameColumnAtIndex: (index, name) => renameColumnWithUndo(index, name),
    });

    const resetTransientEdits = () => {
        setUndoStack([]);
        setRedoStack([]);
        setEditingCell(null);
    };

    const pushUndo = (op: UndoOp) => {
        setUndoStack((current) => [...current, op]);
        setRedoStack([]);
    };

    // --- Row/Column Ops ---
    const {
        rowOps,
        columnOps,
        setRowOps,
        setColumnOps,
        resetOps,
        insertRow,
        insertRowAtIndex,
        deleteRow,
        deleteRowAtIndex,
        insertColumn,
        insertColumnAtIndex,
        duplicateColumnAtIndex,
        deleteColumn,
        deleteColumnAtIndex,
        renameColumn,
        renameColumnAtIndex: renameColumnAtIndexInternal,
        copySelection,
        pasteSelection,
    } = useRowColumnOps({
        headers,
        rows,
        rowIndexInput,
        columnIndexInput,
        columnNameInput,
        getColumnCount: () => dataColumnCount,
        getCellValue,
        applyPatch,
        pushUndo,
        pasteMode,
        getCurrentDelimiter,
        getActiveRange,
        clearSelection,
        setHeaders,
        setRows,
        setPatches,
        setError,
        resetTransientEdits,
        t,
    });

    // --- Wrappers with Undo ---
    const insertRowWithUndo = (index: number, values?: string[]) => {
        const resolvedValues = values ?? new Array(dataColumnCount).fill("");
        shiftClearedRowsOnInsert(index);
        insertRowAtIndex(index, resolvedValues);
        pushUndo({ kind: "row_insert", index, values: resolvedValues });
    };

    const deleteRowWithUndo = (index: number) => {
        const values = captureRowValues(index);
        const wasCleared = clearedRows.has(index);
        shiftClearedRowsOnDelete(index);
        deleteRowAtIndex(index);
        pushUndo({ kind: "row_delete", index, values, wasCleared });
    };

    const insertColumnWithUndo = (index: number, name?: string) => {
        const resolvedName =
            name?.trim() || t(`Column ${headers.length + 1}`, `列 ${headers.length + 1}`);
        shiftClearedColsOnInsert(index);
        insertColumnAtIndex(index, resolvedName);
        pushUndo({ kind: "col_insert", index, name: resolvedName });
    };

    const deleteColumnWithUndo = (index: number) => {
        const name = headers[index] ?? "";
        const values = captureColumnValues(index);
        const wasCleared = clearedCols.has(index);
        shiftClearedColsOnDelete(index);
        deleteColumnAtIndex(index);
        pushUndo({ kind: "col_delete", index, name, values, wasCleared });
    };

    const renameColumnWithUndo = (index: number, name: string) => {
        if (index < 0 || index >= headers.length) {
            setError(t("Column index is invalid for rename.", "Column index is invalid for rename."));
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) {
            setError(t("Column name is required for rename.", "Column name is required for rename."));
            return;
        }
        const prev = headers[index] ?? "";
        if (prev === trimmed) return;
        renameColumnAtIndexInternal(index, trimmed);
        pushUndo({ kind: "col_rename", index, prev, next: trimmed });
    };

    // --- Undo / Redo ---
    const undo = () => {
        setUndoStack((current) => {
            if (!current.length) return current;
            const last = current[current.length - 1];
            if (last.kind === "cell") {
                applyPatchValue(last.key, last.prev);
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "bulk") {
                last.entries.forEach((entry) => applyPatchValue(entry.key, entry.prev));
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "clear_rows") {
                setClearedRows((prev) => {
                    const next = new Set(prev);
                    last.rows.forEach((row) => next.delete(row));
                    return next;
                });
                setPatches((prev) => {
                    const next = { ...prev };
                    last.patches.forEach((entry) => {
                        next[entry.key] = entry.value;
                    });
                    return next;
                });
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "clear_cols") {
                setClearedCols((prev) => {
                    const next = new Set(prev);
                    last.cols.forEach((col) => next.delete(col));
                    return next;
                });
                setPatches((prev) => {
                    const next = { ...prev };
                    last.patches.forEach((entry) => {
                        next[entry.key] = entry.value;
                    });
                    return next;
                });
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "row_insert") {
                shiftClearedRowsOnDelete(last.index);
                deleteRowAtIndex(last.index);
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "row_delete") {
                shiftClearedRowsOnInsert(last.index);
                insertRowAtIndex(last.index, last.values);
                if (last.wasCleared) {
                    setClearedRows((prev) => {
                        const next = new Set(prev);
                        next.add(last.index);
                        return next;
                    });
                }
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "col_insert") {
                shiftClearedColsOnDelete(last.index);
                deleteColumnAtIndex(last.index);
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "col_delete") {
                shiftClearedColsOnInsert(last.index);
                insertColumnAtIndex(last.index, last.name);
                if (last.values.length) {
                    setPatches((prev) => {
                        const next = { ...prev };
                        last.values.forEach(({ row, value }) => {
                            if (value !== "") {
                                next[`${row}:${last.index}`] = value;
                            }
                        });
                        return next;
                    });
                }
                if (last.wasCleared) {
                    setClearedCols((prev) => {
                        const next = new Set(prev);
                        next.add(last.index);
                        return next;
                    });
                }
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "col_rename") {
                renameColumnAtIndexInternal(last.index, last.prev);
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "row_duplicate") {
                shiftClearedRowsOnDelete(last.index);
                deleteRowAtIndex(last.index);
                setRedoStack((redo) => [...redo, last]);
            }
            if (last.kind === "col_duplicate") {
                shiftClearedColsOnDelete(last.index + 1);
                deleteColumnAtIndex(last.index + 1);
                setRedoStack((redo) => [...redo, last]);
            }
            return current.slice(0, -1);
        });
    };

    const redo = () => {
        setRedoStack((current) => {
            if (!current.length) return current;
            const last = current[current.length - 1];
            if (last.kind === "cell") {
                applyPatchValue(last.key, last.next);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "bulk") {
                last.entries.forEach((entry) => applyPatchValue(entry.key, entry.next));
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "clear_rows") {
                setClearedRows((prev) => {
                    const next = new Set(prev);
                    last.rows.forEach((row) => next.add(row));
                    return next;
                });
                setPatches((prev) => {
                    const next = { ...prev };
                    last.patches.forEach((entry) => {
                        delete next[entry.key];
                    });
                    return next;
                });
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "clear_cols") {
                setClearedCols((prev) => {
                    const next = new Set(prev);
                    last.cols.forEach((col) => next.add(col));
                    return next;
                });
                setPatches((prev) => {
                    const next = { ...prev };
                    last.patches.forEach((entry) => {
                        delete next[entry.key];
                    });
                    return next;
                });
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "row_insert") {
                shiftClearedRowsOnInsert(last.index);
                insertRowAtIndex(last.index, last.values);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "row_delete") {
                shiftClearedRowsOnDelete(last.index);
                deleteRowAtIndex(last.index);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "col_insert") {
                shiftClearedColsOnInsert(last.index);
                insertColumnAtIndex(last.index, last.name);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "col_delete") {
                shiftClearedColsOnDelete(last.index);
                deleteColumnAtIndex(last.index);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "col_rename") {
                renameColumnAtIndexInternal(last.index, last.next);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "row_duplicate") {
                shiftClearedRowsOnInsert(last.index);
                insertRowAtIndex(last.index, last.values);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            if (last.kind === "col_duplicate") {
                shiftClearedColsOnInsert(last.index + 1);
                duplicateColumnAtIndex(last.index);
                setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
            }
            return current.slice(0, -1);
        });
    };

    const clearEdits = () => {
        setPatches({});
        setUndoStack([]);
        setRedoStack([]);
        resetOps();
        setClearedRows(new Set());
        setClearedCols(new Set());
        setEditingCell(null);
        setError(null);
        if (onGlobalViewPatchRefresh) {
            // Force refresh? Unclear if needed. 
        }
    };

    const applyColumnOpsToRows = useCallback(
        (sliceRows: string[][]) => {
            if (!columnOps.length) return sliceRows;
            const applyToRow = (row: string[]) => {
                let next = [...row];
                columnOps.forEach((op) => {
                    if (op.type === "insert") {
                        const idx = Math.min(Math.max(op.index, 0), next.length);
                        next.splice(idx, 0, "");
                    }
                    if (op.type === "delete") {
                        if (op.index >= 0 && op.index < next.length) {
                            next.splice(op.index, 1);
                        }
                    }
                    if (op.type === "duplicate") {
                        const idx = Math.min(Math.max(op.index, 0), next.length);
                        const from = op.from;
                        const value = from >= 0 && from < next.length ? next[from] ?? "" : "";
                        next.splice(idx, 0, value);
                    }
                });
                return next;
            };
            return sliceRows.map(applyToRow);
        },
        [columnOps],
    );

    return {
        applyColumnOpsToRows,
        patches,
        undoStack,
        redoStack,
        clearedRows,
        clearedCols,
        editingCell,
        editingHeader,
        setEditingCell,
        setEditingHeader,
        rowOps,
        columnOps,
        setPatches,
        setUndoStack,
        setRedoStack,
        setClearedRows,
        setClearedCols,
        setRowOps,
        setColumnOps,
        getCellValue,
        applyPatch,
        applyPatchWithUndo,
        startEditing,
        commitEditing,
        cancelEditing,
        startHeaderEditing,
        commitHeaderEditing,
        cancelHeaderEditing,
        insertRow,
        deleteRow,
        insertColumn,
        deleteColumn,
        renameColumn,
        copySelection,
        pasteSelection,
        undo,
        redo,
        resetOps,
        resetTransientEdits,
        clearEdits,
        insertRowWithUndo,
        deleteRowWithUndo,
        insertColumnWithUndo,
        deleteColumnWithUndo,
        renameColumnWithUndo,
        insertRowAtIndex,
        insertColumnAtIndex,
        deleteRowAtIndex,
        deleteColumnAtIndex,
        captureRowValues,
        captureColumnValues,
        pushUndo,
        duplicateColumnAtIndex,
        shiftClearedRowsOnInsert,
        shiftClearedRowsOnDelete,
        shiftClearedColsOnInsert,
        shiftClearedColsOnDelete,
    };
}
