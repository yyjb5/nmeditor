import useCsvContextMenuController from "./useCsvContextMenuController";
import useCsvFileActionHandlers from "./useCsvFileActionHandlers";
import useCsvFindLifecycleEffects from "./useCsvFindLifecycleEffects";
import useCsvFindMatches from "./useCsvFindMatches";
import useCsvFindNavigationFocus from "./useCsvFindNavigationFocus";
import useCsvSaveActions from "./useCsvSaveActions";
import useCsvStructureActions from "./useCsvStructureActions";
import usePendingInitialTabSave from "./usePendingInitialTabSave";
import buildCsvContextMenuControllerOptions from "./buildCsvContextMenuControllerOptions";
import buildCsvFileActionHandlersOptions from "./buildCsvFileActionHandlersOptions";
import buildCsvFindLifecycleEffectsOptions from "./buildCsvFindLifecycleEffectsOptions";
import buildCsvFindMatchesOptions from "./buildCsvFindMatchesOptions";
import buildCsvFindNavigationFocusOptions from "./buildCsvFindNavigationFocusOptions";
import buildCsvSaveActionsOptions from "./buildCsvSaveActionsOptions";
import buildCsvStructureActionsOptions from "./buildCsvStructureActionsOptions";
import buildPendingInitialTabSaveOptions from "./buildPendingInitialTabSaveOptions";

type UseCsvWorkflowActionsContext = Record<string, any>;

export default function useCsvWorkflowActions(ctx: UseCsvWorkflowActionsContext) {
  const { hasSortFilter } = ctx.csvSortFilterModel;
  const {
    findMatches,
    findMatchesSource,
    setFindMatches,
    setFindMatchesSource,
    setFindMatchesHasMore,
    findJobId,
    setFindJobId,
    findProgress,
    setFindProgress,
    findRunning,
    setFindRunning,
    findCanceled,
    setFindCanceled,
    findMatchedCount,
    setFindMatchedCount,
    findScannedRows,
    setFindScannedRows,
    findElapsedMs,
    setFindElapsedMs,
    activeFindMatchIndex,
    setActiveFindMatchIndex,
  } = ctx.csvFindState;
  const {
    macroScope,
    findText,
    findScope,
    useRegex,
    matchCase,
    findColumnInput,
    findStartRow,
    findEndRow,
    dialectDelimiter,
    resetFileOps,
    runMacro,
    runMacroOnFile,
    applyFindReplace,
    runFindReplaceOnFile,
    saveAs,
  } = ctx.fileOpsState;
  const { rowIndexInput, columnIndexInput, columnNameInput } = ctx.csvInputState;

  const { saveAsCurrent, handleApplyDelimiter } = useCsvSaveActions(buildCsvSaveActionsOptions({
    fileMode: ctx.fileMode,
    saveTextAs: ctx.saveTextAs,
    saveAs,
    clearDraftForPath: ctx.clearDraftForPath,
    previewPath: ctx.preview?.path ?? null,
    updateActiveTabPath: ctx.updateActiveTabPath,
    resetSessionState: ctx.resetSessionState,
    closeSession: ctx.closeSession,
    openCsvPath: ctx.openCsvPath,
    setFileMode: ctx.setFileMode,
    requestWindow: ctx.requestWindow,
    setFileSizeBytes: ctx.setFileSizeBytes,
    shouldAutoBuildIndex: ctx.shouldAutoBuildIndex,
    refreshTotalRows: ctx.refreshTotalRows,
    activeTabId: ctx.activeTabId,
    saveCurrentTabData: ctx.saveCurrentTabData,
    applyDelimiter: ctx.applyDelimiter,
    fileSizeBytes: ctx.fileSizeBytes,
  }));

  usePendingInitialTabSave(buildPendingInitialTabSaveOptions({
    pendingInitialSaveRef: ctx.pendingInitialSaveRef,
    activeTabId: ctx.activeTabId,
    fileMode: ctx.fileMode,
    loading: ctx.loading,
    textLoading: ctx.textLoading,
    saveCurrentTabData: ctx.saveCurrentTabData,
  }));

  const { handleRunMacro, handleApplyFindReplace, clearEdits } = useCsvFileActionHandlers(
    buildCsvFileActionHandlersOptions({
      macroScope,
      runMacroOnFile,
      runMacro,
      findScope,
      runFindReplaceOnFile,
      applyFindReplace,
      clearModelEdits: ctx.clearModelEdits,
      resetFileOps,
      setError: ctx.setError,
      previewPath: ctx.preview?.path ?? null,
      clearDraftForPath: ctx.clearDraftForPath,
      hasSortFilter,
      setGlobalViewPatchTick: ctx.setGlobalViewPatchTick,
    }),
  );

  const { focusFindMatch, jumpToFindMatch, jumpFindNext, jumpFindPrev } = useCsvFindNavigationFocus(
    buildCsvFindNavigationFocusOptions({
      findMatches,
      findMatchesSource,
      activeFindMatchIndex,
      setActiveFindMatchIndex,
      setIsDraggingSelection: ctx.setIsDraggingSelection,
      updateSelection: ctx.updateSelection,
      windowStart: ctx.windowStart,
      rowsLength: ctx.rows.length,
      rowVirtualizer: ctx.rowVirtualizer,
      hasSortFilter,
      setError: ctx.setError,
      t: ctx.t,
      globalViewIdRef: ctx.globalViewIdRef,
      previewPath: ctx.preview?.path ?? null,
      previewDelimiter: ctx.preview?.delimiter ?? null,
      dialectDelimiter,
      effectiveTotalRows: ctx.effectiveTotalRows,
      windowSize: ctx.windowSize,
      requestIdRef: ctx.requestIdRef,
      loadWindow: ctx.loadWindow,
    }),
  );

  const { clearFindMatches, cancelFindMatchJob, runFindMatches } = useCsvFindMatches(
    buildCsvFindMatchesOptions({
      findScope,
      findText,
      findColumnInput,
      findStartRow,
      findEndRow,
      useRegex,
      matchCase,
      findRunning,
      findJobId,
      hasSortFilter,
      getGlobalViewId: () => ctx.globalViewIdRef.current,
      preview: ctx.preview,
      dialectDelimiter,
      rows: ctx.rows,
      windowStart: ctx.windowStart,
      selectionColumnCount: ctx.selectionColumnCount,
      getCellValue: ctx.getCellValue,
      focusFindMatch,
      setFindJobId,
      setFindRunning,
      setFindProgress,
      setFindCanceled,
      setFindMatchedCount,
      setFindScannedRows,
      setFindElapsedMs,
      setFindMatches,
      setFindMatchesSource,
      setFindMatchesHasMore,
      setActiveFindMatchIndex,
      setError: ctx.setError,
      t: ctx.t,
    }),
  );

  useCsvFindLifecycleEffects(buildCsvFindLifecycleEffectsOptions({
    clearFindMatches,
    findScope,
    findText,
    findColumnInput,
    findStartRow,
    findEndRow,
    useRegex,
    matchCase,
    findMatchesSource,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
  }));

  const {
    handleInsertRow,
    handleDeleteRow,
    handleInsertColumn,
    handleDeleteColumn,
    handleRenameColumn,
  } = useCsvStructureActions(buildCsvStructureActionsOptions({
    rowIndexInput,
    columnIndexInput,
    columnNameInput,
    rowsLength: ctx.rows.length,
    headersLength: ctx.headers.length,
    getActiveRange: ctx.getActiveRange,
    insertRow: ctx.insertRow,
    insertRowWithUndo: ctx.insertRowWithUndo,
    deleteRow: ctx.deleteRow,
    deleteRowWithUndo: ctx.deleteRowWithUndo,
    insertColumn: ctx.insertColumn,
    insertColumnWithUndo: ctx.insertColumnWithUndo,
    deleteColumn: ctx.deleteColumn,
    deleteColumnWithUndo: ctx.deleteColumnWithUndo,
    renameColumn: ctx.renameColumn,
    renameColumnWithUndo: ctx.renameColumnWithUndo,
  }));

  const {
    contextMenu,
    handleRowHeaderContextMenu,
    handleColumnHeaderContextMenu,
    runContextAction,
  } = useCsvContextMenuController(buildCsvContextMenuControllerOptions({
    loading: ctx.loading,
    globalViewLoading: ctx.globalViewLoading,
    hasSortFilter,
    t: ctx.t,
    setError: ctx.setError,
    insertRowWithUndo: ctx.insertRowWithUndo,
    insertRowAtIndex: ctx.insertRowAtIndex,
    deleteRowWithUndo: ctx.deleteRowWithUndo,
    insertColumnWithUndo: ctx.insertColumnWithUndo,
    deleteColumnWithUndo: ctx.deleteColumnWithUndo,
    duplicateColumnAtIndex: ctx.duplicateColumnAtIndex,
    startHeaderEditing: ctx.startHeaderEditing,
    shiftClearedRowsOnInsert: ctx.shiftClearedRowsOnInsert,
    shiftClearedColsOnInsert: ctx.shiftClearedColsOnInsert,
    dataColumnCount: ctx.dataColumnCount,
    getCellValue: ctx.getCellValue,
    getActiveRange: ctx.getActiveRange,
    setClearedRows: ctx.setClearedRows,
    setClearedCols: ctx.setClearedCols,
    setPatches: ctx.setPatches,
    appendContextUndo: ctx.appendContextUndo,
    resetRedoStack: ctx.resetRedoStack,
    headers: ctx.headers,
  }));

  return {
    saveAsCurrent,
    handleApplyDelimiter,
    handleRunMacro,
    handleApplyFindReplace,
    clearEdits,
    jumpToFindMatch,
    jumpFindNext,
    jumpFindPrev,
    clearFindMatches,
    cancelFindMatchJob,
    runFindMatches,
    handleInsertRow,
    handleDeleteRow,
    handleInsertColumn,
    handleDeleteColumn,
    handleRenameColumn,
    contextMenu,
    handleRowHeaderContextMenu,
    handleColumnHeaderContextMenu,
    runContextAction,
    findProgress,
    findRunning,
    findCanceled,
    findMatchedCount,
    findScannedRows,
    findElapsedMs,
  };
}
