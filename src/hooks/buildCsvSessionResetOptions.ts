import type useCsvSessionReset from "./useCsvSessionReset";

type BuildCsvSessionResetOptionsContext = Record<string, any>;

export default function buildCsvSessionResetOptions(
  ctx: BuildCsvSessionResetOptionsContext,
): Parameters<typeof useCsvSessionReset>[0] {
  return {
    globalViewIdRef: ctx.globalViewIdRef,
    setGlobalViewTotal: ctx.setGlobalViewTotal,
    setPatches: ctx.setPatches,
    clearUndoStack: ctx.clearUndoStack,
    clearRedoStack: ctx.clearRedoStack,
    setSortRules: ctx.setSortRules,
    setFilterRules: ctx.setFilterRules,
    setClearedRows: ctx.setClearedRows,
    setClearedCols: ctx.setClearedCols,
    setHiddenCols: ctx.setHiddenCols,
    setColumnSearch: ctx.setColumnSearch,
    setColumnOrder: ctx.setColumnOrder,
    setFrozenFirstRowValues: ctx.setFrozenFirstRowValues,
    setFrozenFirstRowBaseIndex: ctx.setFrozenFirstRowBaseIndex,
    resetOps: ctx.resetOps,
    resetFileOps: ctx.resetFileOps,
    clearSelection: ctx.clearSelection,
    clearEditingCell: ctx.clearEditingCell,
    setTotalRows: ctx.setTotalRows,
    setFileSizeBytes: ctx.setFileSizeBytes,
    setWindowStart: ctx.setWindowStart,
    setWindowSize: ctx.setWindowSize,
    setRowHeight: ctx.setRowHeight,
    setRowHeightOverrides: ctx.setRowHeightOverrides,
    setRowIndexMap: ctx.setRowIndexMap,
    setIndexJobId: ctx.setIndexJobId,
    setIndexRunning: ctx.setIndexRunning,
    setIndexProgress: ctx.setIndexProgress,
    setIndexCanceled: ctx.setIndexCanceled,
    resetWindowCaches: ctx.resetWindowCaches,
  };
}
