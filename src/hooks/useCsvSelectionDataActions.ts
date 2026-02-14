import { useCallback, type MutableRefObject } from "react";
import { createAutoFillValueGetter } from "../utils/autoFill";
import { invokeCmd } from "../tauriBridge";
import type { CellPoint, SelectionRange } from "./useSelection";

type BulkEntry = { key: string; prev: string | null; next: string | null };

export interface UseCsvSelectionDataActionsOptions {
  fileMode: "none" | "csv" | "text";
  rowsLength: number;
  selectionRowCount: number;
  selectionColumnCount: number;
  selectionAnchor: CellPoint | null;
  selectionRanges: SelectionRange[];
  windowStart: number;
  getActiveRange: () => SelectionRange | null;
  applyPatch: (row: number, col: number, value: string) => BulkEntry | undefined;
  pushUndo: (op: { kind: "bulk"; entries: BulkEntry[] }) => void;
  setError: (value: string | null) => void;
  t: (en: string, zh: string) => string;
  delimiter: string;
  delimiterApplied: string | null;
  previewDelimiter: string | null;
  previewPath: string | null;
  activePath: string | null;
  hasSortFilter: boolean;
  globalViewIdRef: MutableRefObject<number | null>;
  windowSize: number;
  patches: Record<string, string>;
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  queueGlobalViewPatchRefresh: (col: number) => void;
  setPatches: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  copySelection: () => Promise<void> | void;
  getCellValue: (row: number, col: number) => string;
}

const getSelectionRanges = (
  selectionRanges: SelectionRange[],
  selectionAnchor: CellPoint | null,
): SelectionRange[] => {
  if (selectionRanges.length) return selectionRanges;
  if (!selectionAnchor) return [];
  return [
    {
      startRow: selectionAnchor.row,
      endRow: selectionAnchor.row,
      startCol: selectionAnchor.col,
      endCol: selectionAnchor.col,
    },
  ];
};

export default function useCsvSelectionDataActions({
  fileMode,
  rowsLength,
  selectionRowCount,
  selectionColumnCount,
  selectionAnchor,
  selectionRanges,
  windowStart,
  getActiveRange,
  applyPatch,
  pushUndo,
  setError,
  t,
  delimiter,
  delimiterApplied,
  previewDelimiter,
  previewPath,
  activePath,
  hasSortFilter,
  globalViewIdRef,
  windowSize,
  patches,
  clearedRows,
  clearedCols,
  queueGlobalViewPatchRefresh,
  setPatches,
  copySelection,
  getCellValue,
}: UseCsvSelectionDataActionsOptions) {
  const resolveSelectionFocusCell = useCallback(
    (direction?: "up" | "down" | "left" | "right") => {
      const range = getActiveRange();
      if (!selectionAnchor && !range) return null;
      if (!selectionAnchor && range) {
        return { row: range.startRow, col: range.startCol };
      }
      if (!selectionAnchor) return null;
      if (!direction || !range) {
        return { row: selectionAnchor.row, col: selectionAnchor.col };
      }

      const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

      if (direction === "up") {
        return {
          row: selectionAnchor.row <= range.startRow ? range.endRow : range.startRow,
          col: clamp(selectionAnchor.col, range.startCol, range.endCol),
        };
      }
      if (direction === "down") {
        return {
          row: selectionAnchor.row >= range.endRow ? range.startRow : range.endRow,
          col: clamp(selectionAnchor.col, range.startCol, range.endCol),
        };
      }
      if (direction === "left") {
        return {
          row: clamp(selectionAnchor.row, range.startRow, range.endRow),
          col: selectionAnchor.col <= range.startCol ? range.endCol : range.startCol,
        };
      }
      return {
        row: clamp(selectionAnchor.row, range.startRow, range.endRow),
        col: selectionAnchor.col >= range.endCol ? range.startCol : range.endCol,
      };
    },
    [getActiveRange, selectionAnchor],
  );

  const clearSelectedCellsInLoadedWindow = useCallback(() => {
    const ranges = getSelectionRanges(selectionRanges, selectionAnchor);
    if (!ranges.length || !rowsLength) return false;

    const loadedStart = windowStart;
    const loadedEnd = windowStart + rowsLength - 1;
    const maxCol = Math.max(selectionColumnCount - 1, 0);
    let hasUnloadedRows = false;
    const bulkEntries: BulkEntry[] = [];

    for (const range of ranges) {
      if (range.startRow < loadedStart || range.endRow > loadedEnd) {
        hasUnloadedRows = true;
      }
      const rowStart = Math.max(range.startRow, loadedStart);
      const rowEnd = Math.min(range.endRow, loadedEnd);
      const colStart = Math.max(range.startCol, 0);
      const colEnd = Math.min(range.endCol, maxCol);
      if (rowStart > rowEnd || colStart > colEnd) continue;
      for (let row = rowStart; row <= rowEnd; row += 1) {
        for (let col = colStart; col <= colEnd; col += 1) {
          const entry = applyPatch(row, col, "");
          if (entry) bulkEntries.push(entry);
        }
      }
    }

    if (hasUnloadedRows) {
      setError(
        t(
          "Selection includes unloaded rows. Load rows into view before delete or cut.",
          "Selection includes unloaded rows. Load rows into view before delete or cut.",
        ),
      );
      return false;
    }

    if (!bulkEntries.length) {
      return false;
    }

    pushUndo({ kind: "bulk", entries: bulkEntries });
    setError(null);
    return true;
  }, [
    applyPatch,
    pushUndo,
    rowsLength,
    selectionAnchor,
    selectionColumnCount,
    selectionRanges,
    t,
    windowStart,
    setError,
  ]);

  const selectionContainsUnloadedRows = useCallback(() => {
    const ranges = getSelectionRanges(selectionRanges, selectionAnchor);
    if (!ranges.length || !rowsLength) return false;
    const loadedStart = windowStart;
    const loadedEnd = windowStart + rowsLength - 1;
    return ranges.some((range) => range.startRow < loadedStart || range.endRow > loadedEnd);
  }, [rowsLength, selectionAnchor, selectionRanges, windowStart]);

  const copyActiveRangeFromFile = useCallback(async (): Promise<boolean> => {
    const range = getActiveRange();
    if (!range) {
      setError(t("Select cells to copy.", "Select cells to copy."));
      return false;
    }

    const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
    const delimiterChar = resolvedDelimiter || ",";
    const viewId = globalViewIdRef.current;
    const path = previewPath ?? activePath ?? null;

    if (hasSortFilter) {
      if (!viewId) {
        setError(
          t(
            "Global view is still preparing. Retry copy in a moment.",
            "Global view is still preparing. Retry copy in a moment.",
          ),
        );
        return false;
      }
    } else if (!path) {
      setError(t("No active file to copy from.", "No active file to copy from."));
      return false;
    }

    const CHUNK_ROWS = Math.max(200, Math.min(windowSize, 1200));
    const lines: string[] = [];
    let cursor = range.startRow;

    try {
      while (cursor <= range.endRow) {
        const limit = Math.min(CHUNK_ROWS, range.endRow - cursor + 1);
        const slice = hasSortFilter
          ? await invokeCmd<{
            rows: string[][];
            start: number;
            end: number;
            eof: boolean;
            row_indices?: number[];
          }>("read_global_view_rows", {
            viewId,
            start: cursor,
            limit,
          })
          : await invokeCmd<{
            rows: string[][];
            start: number;
            end: number;
            eof: boolean;
            row_indices?: number[];
          }>("read_csv_rows_window", {
            path,
            delimiter: resolvedDelimiter,
            start: cursor,
            limit,
          });

        if (!slice.rows.length) break;

        for (let i = 0; i < slice.rows.length; i += 1) {
          const viewRow = cursor + i;
          const baseRow = slice.row_indices?.[i] ?? viewRow;
          const source = slice.rows[i] ?? [];
          const values: string[] = [];
          for (let col = range.startCol; col <= range.endCol; col += 1) {
            let value = source[col] ?? "";
            if (clearedRows.has(baseRow) || clearedCols.has(col)) {
              value = "";
            }
            const patchKey = `${baseRow}:${col}`;
            if (Object.prototype.hasOwnProperty.call(patches, patchKey)) {
              value = patches[patchKey] ?? "";
            }
            values.push(value);
          }
          lines.push(values.join(delimiterChar));
        }

        cursor += slice.rows.length;
        if (slice.rows.length < limit || slice.eof) {
          break;
        }
      }

      await navigator.clipboard.writeText(lines.join("\n"));
      setError(null);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [
    activePath,
    clearedCols,
    clearedRows,
    delimiter,
    delimiterApplied,
    getActiveRange,
    hasSortFilter,
    patches,
    previewDelimiter,
    previewPath,
    t,
    windowSize,
    globalViewIdRef,
    setError,
  ]);

  const applyBulkPatchEntries = useCallback(
    (entries: Array<{ key: string; next: string | null }>) => {
      if (!entries.length) return;
      const touchedCols = new Set<number>();
      for (const entry of entries) {
        const sep = entry.key.lastIndexOf(":");
        if (sep >= 0) {
          const parsed = Number.parseInt(entry.key.slice(sep + 1), 10);
          if (!Number.isNaN(parsed)) touchedCols.add(parsed);
        }
      }
      touchedCols.forEach((col) => queueGlobalViewPatchRefresh(col));
      setPatches((current) => {
        const updated = { ...current };
        for (const entry of entries) {
          if (entry.next === null) {
            delete updated[entry.key];
          } else {
            updated[entry.key] = entry.next;
          }
        }
        return updated;
      });
    },
    [queueGlobalViewPatchRefresh, setPatches],
  );

  const clearActiveRangeFromFile = useCallback(async (): Promise<boolean> => {
    const range = getActiveRange();
    if (!range) {
      setError(t("Select cells to clear.", "Select cells to clear."));
      return false;
    }

    const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
    const viewId = globalViewIdRef.current;
    const path = previewPath ?? activePath ?? null;

    if (hasSortFilter) {
      if (!viewId) {
        setError(
          t(
            "Global view is still preparing. Retry cut in a moment.",
            "Global view is still preparing. Retry cut in a moment.",
          ),
        );
        return false;
      }
    } else if (!path) {
      setError(t("No active file to cut from.", "No active file to cut from."));
      return false;
    }

    const CHUNK_ROWS = Math.max(200, Math.min(windowSize, 1200));
    const undoEntries: BulkEntry[] = [];
    let cursor = range.startRow;

    try {
      while (cursor <= range.endRow) {
        const limit = Math.min(CHUNK_ROWS, range.endRow - cursor + 1);
        const slice = hasSortFilter
          ? await invokeCmd<{
            rows: string[][];
            start: number;
            end: number;
            eof: boolean;
            row_indices?: number[];
          }>("read_global_view_rows", {
            viewId,
            start: cursor,
            limit,
          })
          : await invokeCmd<{
            rows: string[][];
            start: number;
            end: number;
            eof: boolean;
            row_indices?: number[];
          }>("read_csv_rows_window", {
            path,
            delimiter: resolvedDelimiter,
            start: cursor,
            limit,
          });

        if (!slice.rows.length) break;

        const chunkUndoEntries: BulkEntry[] = [];
        const chunkPatchEntries: Array<{ key: string; next: string | null }> = [];

        for (let i = 0; i < slice.rows.length; i += 1) {
          const viewRow = cursor + i;
          const baseRow = slice.row_indices?.[i] ?? viewRow;
          const source = slice.rows[i] ?? [];
          for (let col = range.startCol; col <= range.endCol; col += 1) {
            const key = `${baseRow}:${col}`;
            const baseValue = source[col] ?? "";
            const hasPatch = Object.prototype.hasOwnProperty.call(patches, key);
            const patchedValue = hasPatch ? patches[key] ?? "" : baseValue;
            const currentValue =
              clearedRows.has(baseRow) || clearedCols.has(col) ? "" : patchedValue;
            if (currentValue === "") continue;

            const nextValue = baseValue === "" ? null : "";
            chunkUndoEntries.push({
              key,
              prev: hasPatch ? patches[key] ?? "" : baseValue,
              next: nextValue,
            });
            chunkPatchEntries.push({ key, next: nextValue });
          }
        }

        if (chunkUndoEntries.length) {
          undoEntries.push(...chunkUndoEntries);
          applyBulkPatchEntries(chunkPatchEntries);
        }

        cursor += slice.rows.length;
        if (slice.rows.length < limit || slice.eof) {
          break;
        }
      }

      if (!undoEntries.length) {
        setError(null);
        return false;
      }

      pushUndo({ kind: "bulk", entries: undoEntries });
      setError(null);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [
    activePath,
    applyBulkPatchEntries,
    clearedCols,
    clearedRows,
    delimiter,
    delimiterApplied,
    getActiveRange,
    hasSortFilter,
    patches,
    previewDelimiter,
    previewPath,
    pushUndo,
    t,
    windowSize,
    globalViewIdRef,
    setError,
  ]);

  const copySelectionSmart = useCallback(async (): Promise<boolean> => {
    const range = getActiveRange();
    if (!range) {
      setError(t("Select cells to copy.", "Select cells to copy."));
      return false;
    }
    if (selectionContainsUnloadedRows()) {
      return copyActiveRangeFromFile();
    }
    await copySelection();
    return true;
  }, [copyActiveRangeFromFile, copySelection, getActiveRange, selectionContainsUnloadedRows, t, setError]);

  const handleAutoFillSelection = useCallback(
    (
      source: { startRow: number; endRow: number; startCol: number; endCol: number },
      target: { row: number; col: number },
    ) => {
      if (fileMode !== "csv") return;
      if (!rowsLength) return;

      const maxCol = Math.max(selectionColumnCount - 1, 0);
      const maxRow = Math.max(selectionRowCount - 1, 0);
      const clampedTargetRow = Math.max(0, Math.min(maxRow, target.row));
      const clampedTargetCol = Math.max(0, Math.min(maxCol, target.col));
      const fillStartRow = Math.min(source.startRow, clampedTargetRow);
      const fillEndRow = Math.max(source.endRow, clampedTargetRow);
      const fillStartCol = Math.min(source.startCol, clampedTargetCol);
      const fillEndCol = Math.max(source.endCol, clampedTargetCol);
      const expanded =
        fillStartRow !== source.startRow ||
        fillEndRow !== source.endRow ||
        fillStartCol !== source.startCol ||
        fillEndCol !== source.endCol;
      if (!expanded) {
        setError(null);
        return;
      }

      const sourceRowCount = Math.max(source.endRow - source.startRow + 1, 1);
      const sourceColCount = Math.max(source.endCol - source.startCol + 1, 1);
      const sourceValues = Array.from({ length: sourceRowCount }, (_, rowOffset) =>
        Array.from({ length: sourceColCount }, (_, colOffset) =>
          getCellValue(source.startRow + rowOffset, source.startCol + colOffset),
        ),
      );
      const getFillValue = createAutoFillValueGetter(sourceValues);
      const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
      const viewId = globalViewIdRef.current;
      const path = previewPath ?? activePath ?? null;
      if (hasSortFilter) {
        if (!viewId) {
          setError(
            t(
              "Global view is still preparing. Retry autofill in a moment.",
              "Global view is still preparing. Retry autofill in a moment.",
            ),
          );
          return;
        }
      } else if (!path) {
        setError(t("No active file for autofill.", "No active file for autofill."));
        return;
      }

      const CHUNK_ROWS = Math.max(200, Math.min(windowSize, 1200));
      void (async () => {
        const undoEntries: BulkEntry[] = [];
        let cursor = fillStartRow;
        try {
          while (cursor <= fillEndRow) {
            const limit = Math.min(CHUNK_ROWS, fillEndRow - cursor + 1);
            const slice = hasSortFilter
              ? await invokeCmd<{
                rows: string[][];
                start: number;
                end: number;
                eof: boolean;
                row_indices?: number[];
              }>("read_global_view_rows", {
                viewId,
                start: cursor,
                limit,
              })
              : await invokeCmd<{
                rows: string[][];
                start: number;
                end: number;
                eof: boolean;
                row_indices?: number[];
              }>("read_csv_rows_window", {
                path,
                delimiter: resolvedDelimiter,
                start: cursor,
                limit,
              });

            if (!slice.rows.length) break;

            const chunkPatchEntries: Array<{ key: string; next: string | null }> = [];
            const chunkUndoEntries: BulkEntry[] = [];
            for (let i = 0; i < slice.rows.length; i += 1) {
              const viewRow = cursor + i;
              if (viewRow > fillEndRow) break;
              const baseRow = slice.row_indices?.[i] ?? viewRow;
              const sourceRow = slice.rows[i] ?? [];
              for (let col = fillStartCol; col <= fillEndCol; col += 1) {
                const insideSource =
                  viewRow >= source.startRow &&
                  viewRow <= source.endRow &&
                  col >= source.startCol &&
                  col <= source.endCol;
                if (insideSource) continue;

                const value = getFillValue(viewRow - source.startRow, col - source.startCol);
                const key = `${baseRow}:${col}`;
                const baseValue = sourceRow[col] ?? "";
                const hasPatch = Object.prototype.hasOwnProperty.call(patches, key);
                const patchedValue = hasPatch ? patches[key] ?? "" : baseValue;
                const cellCleared = clearedRows.has(baseRow) || clearedCols.has(col);
                const currentValue = cellCleared ? "" : patchedValue;
                if (value === currentValue) continue;

                const nextValue = cellCleared ? value : value === baseValue ? null : value;
                chunkUndoEntries.push({
                  key,
                  prev: hasPatch ? patches[key] ?? "" : baseValue,
                  next: nextValue,
                });
                chunkPatchEntries.push({ key, next: nextValue });
              }
            }

            if (chunkUndoEntries.length) {
              applyBulkPatchEntries(chunkPatchEntries);
              undoEntries.push(...chunkUndoEntries);
            }

            cursor += slice.rows.length;
            if (slice.rows.length < limit || slice.eof) break;
          }

          if (undoEntries.length) {
            pushUndo({ kind: "bulk", entries: undoEntries });
          }
          setError(null);
        } catch (err) {
          setError(String(err));
        }
      })();
    },
    [
      activePath,
      applyBulkPatchEntries,
      clearedCols,
      clearedRows,
      delimiter,
      delimiterApplied,
      fileMode,
      getCellValue,
      hasSortFilter,
      patches,
      previewDelimiter,
      previewPath,
      pushUndo,
      rowsLength,
      selectionColumnCount,
      selectionRowCount,
      t,
      windowSize,
      globalViewIdRef,
      setError,
    ],
  );

  return {
    resolveSelectionFocusCell,
    clearSelectedCellsInLoadedWindow,
    selectionContainsUnloadedRows,
    copySelectionSmart,
    clearActiveRangeFromFile,
    handleAutoFillSelection,
  };
}
