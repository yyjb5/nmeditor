import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import { invokeCmd } from "../tauriBridge";
import type { ColumnOp, RowOp } from "./useRowColumnOps";

export interface UseCsvHeaderFilterAndFrozenRowOptions {
  patches: Record<string, string>;
  delimiter: string;
  delimiterApplied: string | null;
  previewDelimiter: string | null;
  previewPath: string | null;
  activePath: string | null;
  hasSortFilter: boolean;
  globalViewIdRef: MutableRefObject<number | null>;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  fileMode: "none" | "csv" | "text";
  freezeFirstRow: boolean;
  windowStart: number;
  rowsLength: number;
  applyColumnOpsToRows: (rows: string[][]) => string[][];
  setFrozenFirstRowValues: (value: string[] | null) => void;
  setFrozenFirstRowBaseIndex: (value: number | null) => void;
  frozenFirstRowValues: string[] | null;
  frozenFirstRowBaseIndex: number | null;
  selectionColumnCount: number;
}

export default function useCsvHeaderFilterAndFrozenRow({
  patches,
  delimiter,
  delimiterApplied,
  previewDelimiter,
  previewPath,
  activePath,
  hasSortFilter,
  globalViewIdRef,
  rowOps,
  columnOps,
  clearedRows,
  clearedCols,
  fileMode,
  freezeFirstRow,
  windowStart,
  rowsLength,
  applyColumnOpsToRows,
  setFrozenFirstRowValues,
  setFrozenFirstRowBaseIndex,
  frozenFirstRowValues,
  frozenFirstRowBaseIndex,
  selectionColumnCount,
}: UseCsvHeaderFilterAndFrozenRowOptions) {
  const listHeaderFilterValues = useCallback(
    async (column: number, query: string, limit: number, offset: number) => {
      const safeLimit = Math.max(1, Math.min(limit, 500));
      const safeOffset = Math.max(0, offset);
      const patchList = Object.entries(patches).map(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        return { row, col, value };
      });
      const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
      const path = previewPath ?? activePath ?? null;
      const viewId = globalViewIdRef.current;
      if (hasSortFilter) {
        if (!viewId) {
          return { values: [], hasMore: false, truncated: false, scannedRows: 0 };
        }
        return invokeCmd<{
          values: Array<{ value: string; count: number }>;
          has_more: boolean;
          truncated: boolean;
          scanned_rows: number;
        }>("list_column_value_counts", {
          viewId,
          column,
          query,
          limit: safeLimit,
          offset: safeOffset,
        }).then((result) => ({
          values: result.values,
          hasMore: result.has_more,
          truncated: result.truncated,
          scannedRows: result.scanned_rows,
        }));
      }
      if (!path) {
        return { values: [], hasMore: false, truncated: false, scannedRows: 0 };
      }
      return invokeCmd<{
        values: Array<{ value: string; count: number }>;
        has_more: boolean;
        truncated: boolean;
        scanned_rows: number;
      }>("list_column_value_counts", {
        path,
        delimiter: resolvedDelimiter,
        column,
        query,
        limit: safeLimit,
        offset: safeOffset,
        patches: patchList,
        rowOps,
        columnOps,
        clearRows: Array.from(clearedRows),
        clearCols: Array.from(clearedCols),
      }).then((result) => ({
        values: result.values,
        hasMore: result.has_more,
        truncated: result.truncated,
        scannedRows: result.scanned_rows,
      }));
    },
    [
      activePath,
      clearedCols,
      clearedRows,
      columnOps,
      delimiter,
      delimiterApplied,
      hasSortFilter,
      patches,
      previewDelimiter,
      previewPath,
      rowOps,
      globalViewIdRef,
    ],
  );

  const refreshFrozenFirstRowSnapshot = useCallback(async () => {
    if (fileMode !== "csv" || !freezeFirstRow) return;
    const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
    const path = previewPath ?? activePath ?? null;
    const viewId = globalViewIdRef.current;
    if (hasSortFilter) {
      if (!viewId) {
        setFrozenFirstRowValues(null);
        setFrozenFirstRowBaseIndex(null);
        return;
      }
    } else if (!path) {
      setFrozenFirstRowValues(null);
      setFrozenFirstRowBaseIndex(null);
      return;
    }
    const slice = hasSortFilter
      ? await invokeCmd<{
        rows: string[][];
        start: number;
        end: number;
        eof: boolean;
        row_indices?: number[];
      }>("read_global_view_rows", {
        viewId,
        start: 0,
        limit: 1,
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
        start: 0,
        limit: 1,
      });
    const normalizedRows = applyColumnOpsToRows(slice.rows);
    setFrozenFirstRowValues(normalizedRows[0] ?? null);
    setFrozenFirstRowBaseIndex(normalizedRows.length ? (slice.row_indices?.[0] ?? 0) : null);
  }, [
    activePath,
    applyColumnOpsToRows,
    delimiter,
    delimiterApplied,
    fileMode,
    freezeFirstRow,
    hasSortFilter,
    previewDelimiter,
    previewPath,
    setFrozenFirstRowBaseIndex,
    setFrozenFirstRowValues,
    globalViewIdRef,
  ]);

  useEffect(() => {
    if (!freezeFirstRow || fileMode !== "csv") return;
    if (windowStart === 0 && rowsLength > 0) return;
    void refreshFrozenFirstRowSnapshot();
  }, [
    fileMode,
    freezeFirstRow,
    refreshFrozenFirstRowSnapshot,
    rowsLength,
    windowStart,
  ]);

  const frozenFirstRowDisplayValues = useMemo(() => {
    if (!frozenFirstRowValues) return null;
    const baseRow = frozenFirstRowBaseIndex ?? 0;
    if (clearedRows.has(baseRow)) {
      return new Array(Math.max(frozenFirstRowValues.length, selectionColumnCount)).fill("");
    }
    const next = [...frozenFirstRowValues];
    if (clearedCols.size) {
      clearedCols.forEach((col) => {
        if (col < 0) return;
        while (next.length <= col) next.push("");
        next[col] = "";
      });
    }
    const rowPrefix = `${baseRow}:`;
    Object.entries(patches).forEach(([key, value]) => {
      if (!key.startsWith(rowPrefix)) return;
      const parsed = Number.parseInt(key.slice(rowPrefix.length), 10);
      if (Number.isNaN(parsed) || parsed < 0) return;
      while (next.length <= parsed) next.push("");
      next[parsed] = value;
    });
    return next;
  }, [
    clearedCols,
    clearedRows,
    frozenFirstRowBaseIndex,
    frozenFirstRowValues,
    patches,
    selectionColumnCount,
  ]);

  return {
    listHeaderFilterValues,
    frozenFirstRowDisplayValues,
  };
}
