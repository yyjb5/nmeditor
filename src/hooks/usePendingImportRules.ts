import { useCallback, useEffect, type MutableRefObject } from "react";
import type { RowOp } from "./useRowColumnOps";

type PendingImportRule = { skipRows: number; firstRowHeader: boolean };

export interface UsePendingImportRulesOptions {
  pendingImportRef: MutableRefObject<PendingImportRule | null>;
  fileMode: "none" | "csv" | "text";
  loading: boolean;
  rows: string[][];
  totalRows: number | null;
  setRowOps: (value: RowOp[]) => void;
  setClearedRows: (value: Set<number>) => void;
  setClearedCols: (value: Set<number>) => void;
  setTotalRows: (value: number | null) => void;
  setHeaders: (value: string[]) => void;
  setRows: (value: string[][]) => void;
  setWindowStart: (value: number) => void;
}

export default function usePendingImportRules({
  pendingImportRef,
  fileMode,
  loading,
  rows,
  totalRows,
  setRowOps,
  setClearedRows,
  setClearedCols,
  setTotalRows,
  setHeaders,
  setRows,
  setWindowStart,
}: UsePendingImportRulesOptions) {
  const applyPendingImportRules = useCallback(() => {
    const pending = pendingImportRef.current;
    if (!pending || fileMode !== "csv") return;
    const skipRows = Math.max(0, Math.floor(pending.skipRows));
    const removeCount = skipRows + (pending.firstRowHeader ? 1 : 0);
    if (!rows.length) return;

    if (removeCount > 0) {
      const nextOps: RowOp[] = new Array(removeCount)
        .fill(null)
        .map(() => ({ type: "delete", index: 0 }));
      setRowOps(nextOps);
      setClearedRows(new Set());
      setClearedCols(new Set());
      if (totalRows !== null) {
        setTotalRows(Math.max(0, totalRows - removeCount));
      }
    }

    if (pending.firstRowHeader && rows.length) {
      setHeaders(rows[0] ?? []);
      setRows(rows.slice(1));
    }

    setWindowStart(skipRows + (pending.firstRowHeader ? 1 : 0));
    pendingImportRef.current = null;
  }, [
    fileMode,
    pendingImportRef,
    rows,
    setClearedCols,
    setClearedRows,
    setHeaders,
    setRowOps,
    setRows,
    setTotalRows,
    setWindowStart,
    totalRows,
  ]);

  useEffect(() => {
    if (!pendingImportRef.current) return;
    if (fileMode !== "csv" || loading) return;
    if (!rows.length) return;
    applyPendingImportRules();
  }, [applyPendingImportRules, fileMode, loading, pendingImportRef, rows.length]);
}
