import useAppMenuIntegration from "./useAppMenuIntegration";
import useTabAndFileActions from "./useTabAndFileActions";
import buildAppMenuIntegrationOptions from "./buildAppMenuIntegrationOptions";
import buildTabAndFileActionOptions from "./buildTabAndFileActionOptions";

type UseAppCommandActionsContext = Record<string, any>;

export default function useAppCommandActions(ctx: UseAppCommandActionsContext) {
  const tabAndFileActionOptions = buildTabAndFileActionOptions({
    ...ctx.csvInputState,
    activeTabId: ctx.activeTabId,
    addRecentFile: ctx.addRecentFile,
    clearDraftForPath: ctx.clearDraftForPath,
    closeSession: ctx.closeSession,
    columnOps: ctx.columnOps,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    fileMode: ctx.fileMode,
    importFirstRowHeader: ctx.importFirstRowHeader,
    importSkipRows: ctx.importSkipRows,
    loadDraftForPath: ctx.loadDraftForPath,
    loadTabData: ctx.loadTabData,
    openCsvPath: ctx.openCsvPath,
    openText: ctx.openText,
    patches: ctx.patches,
    pendingImportRef: ctx.pendingImportRef,
    pendingInitialSaveRef: ctx.pendingInitialSaveRef,
    previewPath: ctx.preview?.path ?? null,
    refreshTotalRows: ctx.refreshTotalRows,
    requestWindow: ctx.requestWindow,
    resetFileOps: ctx.resetFileOps,
    resetOps: ctx.resetOps,
    resetSessionState: ctx.resetSessionState,
    resetTextSession: ctx.resetTextSession,
    rowOps: ctx.rowOps,
    saveCurrentTabData: ctx.saveCurrentTabData,
    saveTextAs: ctx.saveTextAs,
    saveTextTo: ctx.saveTextTo,
    saveToPath: ctx.saveToPath,
    setActiveTabId: ctx.setActiveTabId,
    setClearedCols: ctx.setClearedCols,
    setClearedRows: ctx.setClearedRows,
    setEditingCell: ctx.setEditingCell,
    setFileMode: ctx.setFileMode,
    setFileSizeBytes: ctx.setFileSizeBytes,
    setHeaders: ctx.setHeaders,
    setPatches: ctx.setPatches,
    setRedoStack: ctx.setRedoStack,
    setRowIndexMap: ctx.setRowIndexMap,
    setRows: ctx.setRows,
    setTabDataMap: ctx.setTabDataMap,
    setTabs: ctx.setTabs,
    setUndoStack: ctx.setUndoStack,
    shouldAutoBuildIndex: ctx.shouldAutoBuildIndex,
    t: ctx.t,
    tabDataMap: ctx.tabDataMap,
    tabs: ctx.tabs,
    textDirty: ctx.textDirty,
    textPath: ctx.textPath,
    windowStart: ctx.windowStart,
  });
  const { saveCurrent, handleTabClick, handleTabClose, openPath, handleOpen } =
    useTabAndFileActions(tabAndFileActionOptions);

  const appMenuIntegrationOptions = buildAppMenuIntegrationOptions({
    applyFindReplace: ctx.applyFindReplace,
    clearEdits: ctx.clearEdits,
    fileMode: ctx.fileMode,
    handleOpen,
    loadNextWindow: ctx.loadNextWindow,
    locale: ctx.locale,
    redo: ctx.redo,
    runFindReplaceOnFile: ctx.runFindReplaceOnFile,
    runFullStats: ctx.runFullStats,
    runMacro: ctx.runMacro,
    runMacroOnFile: ctx.runMacroOnFile,
    saveAsCurrent: ctx.saveAsCurrent,
    saveCurrent,
    setShowExportPanel: ctx.setShowExportPanel,
    setShowFindBar: ctx.setShowFindBar,
    setShowFindPanel: ctx.setShowFindPanel,
    setShowMacroPanel: ctx.setShowMacroPanel,
    setShowOpsPanel: ctx.setShowOpsPanel,
    setShowQuickbar: ctx.setShowQuickbar,
    setShowStatsPanel: ctx.setShowStatsPanel,
    t: ctx.t,
    undo: ctx.undo,
  });
  useAppMenuIntegration(appMenuIntegrationOptions);

  return {
    saveCurrent,
    handleTabClick,
    handleTabClose,
    openPath,
    handleOpen,
  };
}
