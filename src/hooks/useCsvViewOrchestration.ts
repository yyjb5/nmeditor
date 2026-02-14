import useActiveTabDirtySync from "./useActiveTabDirtySync";
import useCsvAutoFit from "./useCsvAutoFit";
import useCsvColumnOrdering from "./useCsvColumnOrdering";
import useCsvColumnStats from "./useCsvColumnStats";
import useCsvGlobalViewRebuild from "./useCsvGlobalViewRebuild";
import useCsvGridKeyboard from "./useCsvGridKeyboard";
import useCsvGridVirtualization from "./useCsvGridVirtualization";
import useCsvHeaderFilterAndFrozenRow from "./useCsvHeaderFilterAndFrozenRow";
import useCsvSelectionDataActions from "./useCsvSelectionDataActions";
import useCsvSessionReset from "./useCsvSessionReset";
import buildActiveTabDirtySyncOptions from "./buildActiveTabDirtySyncOptions";
import buildCsvAutoFitOptions from "./buildCsvAutoFitOptions";
import buildCsvColumnOrderingOptions from "./buildCsvColumnOrderingOptions";
import buildCsvColumnStatsOptions from "./buildCsvColumnStatsOptions";
import buildCsvGlobalViewRebuildOptions from "./buildCsvGlobalViewRebuildOptions";
import buildCsvGridKeyboardOptions from "./buildCsvGridKeyboardOptions";
import buildCsvGridVirtualizationOptions from "./buildCsvGridVirtualizationOptions";
import buildCsvHeaderFilterAndFrozenRowOptions from "./buildCsvHeaderFilterAndFrozenRowOptions";
import buildCsvSelectionDataActionsOptions from "./buildCsvSelectionDataActionsOptions";
import buildCsvSessionResetOptions from "./buildCsvSessionResetOptions";

type UseCsvViewOrchestrationContext = Record<string, any>;

export default function useCsvViewOrchestration(ctx: UseCsvViewOrchestrationContext) {
  const effectiveTotalRows = ctx.hasSortFilter ? ctx.globalViewTotal : ctx.totalRows;

  const { computeAutoFit } = useCsvAutoFit(buildCsvAutoFitOptions({
    autoFitColumns: ctx.autoFitColumns,
    selectionColumnCount: ctx.selectionColumnCount,
    headers: ctx.headers,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
    getCellValue: ctx.getCellValue,
    setColumnWidths: ctx.setColumnWidths,
  }));

  const {
    parentRef,
    rowVirtualizer,
    getRowIndex,
    isRowLoaded,
    getRowHeight,
    handleBodyScroll,
    loadNextWindow,
  } = useCsvGridVirtualization(buildCsvGridVirtualizationOptions({
    fileMode: ctx.fileMode,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    rowsLength: ctx.rows.length,
    windowStart: ctx.windowStart,
    rowHeight: ctx.rowHeight,
    rowHeightOverrides: ctx.rowHeightOverrides,
    effectiveTotalRows,
    eof: ctx.eof,
    windowLoading: ctx.windowLoading,
    requestWindow: ctx.requestWindow,
    bumpDiagnostics: ctx.bumpDiagnostics,
  }));

  useActiveTabDirtySync(buildActiveTabDirtySyncOptions({
    activeTabId: ctx.activeTabId,
    tabs: ctx.tabs,
    patches: ctx.patches,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    textDirty: ctx.textDirty,
    setTabs: ctx.setTabs,
  }));

  const { columnStats } = useCsvColumnStats(buildCsvColumnStatsOptions({
    showStatsPanel: ctx.showStatsPanel,
    rows: ctx.rows,
    dataColumnCount: ctx.dataColumnCount,
    headers: ctx.headers,
    windowStart: ctx.windowStart,
    getCellValue: ctx.getCellValue,
    t: ctx.t,
  }));

  const { columnSelectOptions, moveColumnInOrder } = useCsvColumnOrdering(
    buildCsvColumnOrderingOptions({
      displayColumnCount: ctx.displayColumnCount,
      headers: ctx.headers,
      columnOrder: ctx.columnOrder,
      t: ctx.t,
      setColumnOrder: ctx.setColumnOrder,
    }),
  );

  const { listHeaderFilterValues, frozenFirstRowDisplayValues } =
    useCsvHeaderFilterAndFrozenRow(buildCsvHeaderFilterAndFrozenRowOptions({
      patches: ctx.patches,
      delimiter: ctx.delimiter,
      delimiterApplied: ctx.delimiterApplied,
      previewDelimiter: ctx.previewDelimiter,
      previewPath: ctx.previewPath,
      activePath: ctx.activePath,
      hasSortFilter: ctx.hasSortFilter,
      globalViewIdRef: ctx.globalViewIdRef,
      rowOps: ctx.rowOps,
      columnOps: ctx.columnOps,
      clearedRows: ctx.clearedRows,
      clearedCols: ctx.clearedCols,
      fileMode: ctx.fileMode,
      freezeFirstRow: ctx.freezeFirstRow,
      windowStart: ctx.windowStart,
      rowsLength: ctx.rows.length,
      applyColumnOpsToRows: ctx.applyColumnOpsToRows,
      setFrozenFirstRowValues: ctx.setFrozenFirstRowValues,
      setFrozenFirstRowBaseIndex: ctx.setFrozenFirstRowBaseIndex,
      frozenFirstRowValues: ctx.frozenFirstRowValues,
      frozenFirstRowBaseIndex: ctx.frozenFirstRowBaseIndex,
      selectionColumnCount: ctx.selectionColumnCount,
    }));

  const { releaseGlobalView, resetSessionState } = useCsvSessionReset(buildCsvSessionResetOptions({
    globalViewIdRef: ctx.globalViewIdRef,
    setGlobalViewTotal: ctx.setGlobalViewTotal,
    setPatches: ctx.setPatches,
    clearUndoStack: () => ctx.setUndoStack([]),
    clearRedoStack: () => ctx.setRedoStack([]),
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
    clearEditingCell: () => ctx.setEditingCell(null),
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
  }));

  const {
    resolveSelectionFocusCell,
    clearSelectedCellsInLoadedWindow,
    selectionContainsUnloadedRows,
    copySelectionSmart,
    clearActiveRangeFromFile,
    handleAutoFillSelection,
  } = useCsvSelectionDataActions(buildCsvSelectionDataActionsOptions({
    fileMode: ctx.fileMode,
    rowsLength: ctx.rows.length,
    selectionRowCount: ctx.selectionRowCount,
    selectionColumnCount: ctx.selectionColumnCount,
    selectionAnchor: ctx.selectionAnchor,
    selectionRanges: ctx.selectionRanges,
    windowStart: ctx.windowStart,
    getActiveRange: ctx.getActiveRange,
    applyPatch: ctx.applyPatch,
    pushUndo: ctx.pushUndo,
    setError: ctx.setError,
    t: ctx.t,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    previewDelimiter: ctx.previewDelimiter,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    hasSortFilter: ctx.hasSortFilter,
    globalViewIdRef: ctx.globalViewIdRef,
    windowSize: ctx.windowSize,
    patches: ctx.patches,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    queueGlobalViewPatchRefresh: ctx.queueGlobalViewPatchRefresh,
    setPatches: ctx.setPatches,
    copySelection: ctx.copySelection,
    getCellValue: ctx.getCellValue,
  }));

  const { handleGridKeyDown } = useCsvGridKeyboard(buildCsvGridKeyboardOptions({
    fileMode: ctx.fileMode,
    editingCell: ctx.editingCell,
    selectionRowCount: ctx.selectionRowCount,
    selectionColumnCount: ctx.selectionColumnCount,
    rowsLength: ctx.rows.length,
    windowStart: ctx.windowStart,
    windowSize: ctx.windowSize,
    rowHeight: ctx.rowHeight,
    parentRef,
    rowVirtualizer,
    requestWindow: ctx.requestWindow,
    selectAll: ctx.selectAll,
    copySelectionSmart,
    pasteSelection: ctx.pasteSelection,
    clearActiveRangeFromFile,
    clearSelectedCellsInLoadedWindow,
    selectionContainsUnloadedRows,
    resolveSelectionFocusCell,
    updateSelection: ctx.updateSelection,
    startEditing: ctx.startEditing,
  }));

  useCsvGlobalViewRebuild(buildCsvGlobalViewRebuildOptions({
    fileMode: ctx.fileMode,
    hasSortFilter: ctx.hasSortFilter,
    sortRules: ctx.sortRules,
    filterRules: ctx.filterRules,
    globalViewPatchTick: ctx.globalViewPatchTick,
    patches: ctx.patches,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    previewPath: ctx.previewPath,
    delimiterApplied: ctx.delimiterApplied,
    delimiter: ctx.delimiter,
    sortFilterMemoryLimitMb: ctx.sortFilterMemoryLimitMb,
    forceExternalSort: ctx.forceExternalSort,
    globalViewIdRef: ctx.globalViewIdRef,
    globalViewBuildRef: ctx.globalViewBuildRef,
    globalViewRebuildTimerRef: ctx.globalViewRebuildTimerRef,
    globalViewBuildRunningRef: ctx.globalViewBuildRunningRef,
    globalViewBuildPendingRef: ctx.globalViewBuildPendingRef,
    requestWindow: ctx.requestWindow,
    resetWindowCaches: ctx.resetWindowCaches,
    releaseGlobalView,
    setGlobalViewTotal: ctx.setGlobalViewTotal,
    setGlobalViewLoading: ctx.setGlobalViewLoading,
    setRowIndexMap: ctx.setRowIndexMap,
    setError: ctx.setError,
    t: ctx.t,
  }));

  return {
    effectiveTotalRows,
    computeAutoFit,
    parentRef,
    rowVirtualizer,
    getRowIndex,
    isRowLoaded,
    getRowHeight,
    handleBodyScroll,
    loadNextWindow,
    columnStats,
    columnSelectOptions,
    moveColumnInOrder,
    listHeaderFilterValues,
    frozenFirstRowDisplayValues,
    resetSessionState,
    copySelectionSmart,
    handleAutoFillSelection,
    handleGridKeyDown,
  };
}
