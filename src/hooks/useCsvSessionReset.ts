import { useCallback, type MutableRefObject } from "react";
import { invokeCmd } from "../tauriBridge";

export interface UseCsvSessionResetOptions {
  globalViewIdRef: MutableRefObject<number | null>;
  setGlobalViewTotal: (value: number | null) => void;
  setPatches: (value: Record<string, string>) => void;
  clearUndoStack: () => void;
  clearRedoStack: () => void;
  setSortRules: (value: Array<{ column: string; direction: "asc" | "desc" }>) => void;
  setFilterRules: (value: Array<{ column: string; value: string }>) => void;
  setClearedRows: (value: Set<number>) => void;
  setClearedCols: (value: Set<number>) => void;
  setHiddenCols: (value: Set<number>) => void;
  setColumnSearch: (value: string) => void;
  setColumnOrder: (value: number[]) => void;
  setFrozenFirstRowValues: (value: string[] | null) => void;
  setFrozenFirstRowBaseIndex: (value: number | null) => void;
  resetOps: () => void;
  resetFileOps: () => void;
  clearSelection: () => void;
  clearEditingCell: () => void;
  setTotalRows: (value: number | null) => void;
  setFileSizeBytes: (value: number | null) => void;
  setWindowStart: (value: number) => void;
  setWindowSize: (value: number) => void;
  setRowHeight: (value: number) => void;
  setRowHeightOverrides: (value: Record<number, number>) => void;
  setRowIndexMap: (value: number[] | null) => void;
  setIndexJobId: (value: number | null) => void;
  setIndexRunning: (value: boolean) => void;
  setIndexProgress: (value: number) => void;
  setIndexCanceled: (value: boolean) => void;
  resetWindowCaches: () => void;
}

export default function useCsvSessionReset({
  globalViewIdRef,
  setGlobalViewTotal,
  setPatches,
  clearUndoStack,
  clearRedoStack,
  setSortRules,
  setFilterRules,
  setClearedRows,
  setClearedCols,
  setHiddenCols,
  setColumnSearch,
  setColumnOrder,
  setFrozenFirstRowValues,
  setFrozenFirstRowBaseIndex,
  resetOps,
  resetFileOps,
  clearSelection,
  clearEditingCell,
  setTotalRows,
  setFileSizeBytes,
  setWindowStart,
  setWindowSize,
  setRowHeight,
  setRowHeightOverrides,
  setRowIndexMap,
  setIndexJobId,
  setIndexRunning,
  setIndexProgress,
  setIndexCanceled,
  resetWindowCaches,
}: UseCsvSessionResetOptions) {
  const releaseGlobalView = useCallback(async (viewId: number | null) => {
    if (!viewId) return;
    try {
      await invokeCmd("release_global_view", { viewId });
    } catch {
      // ignore cleanup errors
    }
  }, []);

  const resetSessionState = useCallback(() => {
    if (globalViewIdRef.current) {
      void releaseGlobalView(globalViewIdRef.current);
    }
    globalViewIdRef.current = null;
    setGlobalViewTotal(null);
    setPatches({});
    clearUndoStack();
    clearRedoStack();
    setSortRules([]);
    setFilterRules([]);
    setClearedRows(new Set());
    setClearedCols(new Set());
    setHiddenCols(new Set());
    setColumnSearch("");
    setColumnOrder([]);
    setFrozenFirstRowValues(null);
    setFrozenFirstRowBaseIndex(null);
    resetOps();
    resetFileOps();
    clearSelection();
    clearEditingCell();
    setTotalRows(null);
    setFileSizeBytes(null);
    setWindowStart(0);
    setWindowSize(400);
    setRowHeight(28);
    setRowHeightOverrides({});
    setRowIndexMap(null);
    setIndexJobId(null);
    setIndexRunning(false);
    setIndexProgress(0);
    setIndexCanceled(false);
    resetWindowCaches();
  }, [
    clearSelection,
    globalViewIdRef,
    releaseGlobalView,
    resetFileOps,
    resetOps,
    resetWindowCaches,
    setClearedCols,
    setClearedRows,
    setColumnOrder,
    setColumnSearch,
    clearEditingCell,
    setFileSizeBytes,
    setFilterRules,
    setFrozenFirstRowBaseIndex,
    setFrozenFirstRowValues,
    setGlobalViewTotal,
    setHiddenCols,
    setIndexCanceled,
    setIndexJobId,
    setIndexProgress,
    setIndexRunning,
    setPatches,
    setRowHeight,
    setRowHeightOverrides,
    setRowIndexMap,
    setSortRules,
    setTotalRows,
    setWindowSize,
    setWindowStart,
    clearRedoStack,
    clearUndoStack,
  ]);

  return {
    releaseGlobalView,
    resetSessionState,
  };
}
