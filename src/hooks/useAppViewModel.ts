import {
  useState,
} from "react";
import buildAppViewPageProps from "./buildAppViewPageProps";

import useCsvSession from "./useCsvSession";
import useCsvDraftPersistence from "./useCsvDraftPersistence";
import useCsvSortFilterModel from "./useCsvSortFilterModel";
import useDiagnostics from "./useDiagnostics";
import useCsvWorkflowActionsBridge from "./useCsvWorkflowActionsBridge";
import useFileOps from "./useFileOps";
import usePanelDrawer from "./usePanelDrawer";
import useRecentFiles from "./useRecentFiles";
import useSelection from "./useSelection";
import useSortFilterPreferences from "./useSortFilterPreferences";
import useTextFindResultsModel from "./useTextFindResultsModel";
import useTextSearchActionsBridge from "./useTextSearchActionsBridge";
import useTextSession from "./useTextSession";
import useGridLayout from "./useGridLayout";
import useGridResize from "./useGridResize";
import useFreezePane from "./useFreezePane";
import usePendingImportRules from "./usePendingImportRules";
import useTabPathActions from "./useTabPathActions";
import useCsvInitialWindowLoad from "./useCsvInitialWindowLoad";
import useCsvGlobalViewPatchQueue from "./useCsvGlobalViewPatchQueue";
import useTextFindResultPanelPagination from "./useTextFindResultPanelPagination";
import useCsvHeaderEditingActions from "./useCsvHeaderEditingActions";
import useCsvGridDerivedState from "./useCsvGridDerivedState";
import useTextFindReplaceState from "./useTextFindReplaceState";
import useAutoIndexPolicy from "./useAutoIndexPolicy";
import useCsvGridFocusState from "./useCsvGridFocusState";
import useLocaleTranslator from "./useLocaleTranslator";
import useGridTemplateColumns from "./useGridTemplateColumns";
import useCsvLayoutBasics from "./useCsvLayoutBasics";
import useCsvFindState from "./useCsvFindState";
import useCsvPanelVisibilityState from "./useCsvPanelVisibilityState";
import useLocaleState from "./useLocaleState";
import useTabState from "./useTabState";
import useGlobalViewState from "./useGlobalViewState";
import useCsvInputState from "./useCsvInputState";
import usePendingWorkflowRefs from "./usePendingWorkflowRefs";
import useCsvViewOrchestration from "./useCsvViewOrchestration";
import useAppCommandActionsBridge from "./useAppCommandActionsBridge";
import useAppTabPersistenceBridge from "./useAppTabPersistenceBridge";
import buildAutoIndexPolicyOptions from "./buildAutoIndexPolicyOptions";
import buildColumnManagementOptions from "./buildColumnManagementOptions";
import buildCsvDataLoaderOptions from "./buildCsvDataLoaderOptions";
import buildCsvDataModelOptions from "./buildCsvDataModelOptions";
import buildCsvDraftPersistenceOptions from "./buildCsvDraftPersistenceOptions";
import buildCsvGlobalViewPatchQueueOptions from "./buildCsvGlobalViewPatchQueueOptions";
import buildCsvGridDerivedStateOptions from "./buildCsvGridDerivedStateOptions";
import buildCsvGridFocusStateOptions from "./buildCsvGridFocusStateOptions";
import buildCsvHeaderEditingActionsOptions from "./buildCsvHeaderEditingActionsOptions";
import buildCsvInitialWindowLoadOptions from "./buildCsvInitialWindowLoadOptions";
import buildCsvLayoutBasicsOptions from "./buildCsvLayoutBasicsOptions";
import buildCsvSessionOptions from "./buildCsvSessionOptions";
import buildFileOpsOptions from "./buildFileOpsOptions";
import buildGridLayoutOptions from "./buildGridLayoutOptions";
import buildGridResizeOptions from "./buildGridResizeOptions";
import buildGridTemplateColumnsOptions from "./buildGridTemplateColumnsOptions";
import buildLocaleTranslatorOptions from "./buildLocaleTranslatorOptions";
import buildPanelDrawerOptions from "./buildPanelDrawerOptions";
import buildPendingImportRulesOptions from "./buildPendingImportRulesOptions";
import buildTabPathActionsOptions from "./buildTabPathActionsOptions";
import buildTextFindResultPanelPaginationOptions from "./buildTextFindResultPanelPaginationOptions";
import buildTextFindResultsModelOptions from "./buildTextFindResultsModelOptions";
import buildTextSessionOptions from "./buildTextSessionOptions";

import useColumnManagement from "./useColumnManagement";
import useCsvDataModel from "./useCsvDataModel";
import useCsvDataLoader from "./useCsvDataLoader";
import {
  TEXT_FIND_RESULTS_PANEL_LIMIT,
} from "../utils/textFind";
import { normalizeColumnWidths as normalizeColumnWidthsRaw } from "../utils/columnResize";

// Imported Types

// Imported Constants
import {
  AUTO_INDEX_THRESHOLD_BYTES,
  DELIMITER_PRESETS as delimiterPresets, // Alias to maintain compatibility
  GLOBAL_VIEW_PATCH_DEBOUNCE_MS,
  MAX_UI_COLUMNS,
} from "../constants";

// Imported Utils
import { formatByteSize } from "../utils/formatting";


export default function useAppViewModel() {
  const [error, setError] = useState<string | null>(null);
  const [fileMode, setFileMode] = useState<"none" | "csv" | "text">("none");
  const csvSessionState = useCsvSession(buildCsvSessionOptions({ setError }));
  const {
    preview,
    delimiter,
    loading,
    rows,
    headers,
    eof,
    activePath,
    delimiterApplied,
    setDelimiter,
    setLoading,
    setRows,
    setHeaders,
    setEof,
  } = csvSessionState;

  const textSessionState = useTextSession(buildTextSessionOptions({ setError }));
  const {
    LARGE_TEXT_FILE_THRESHOLD_BYTES,
    LARGE_TEXT_PREVIEW_BYTES,
    textPath,
    textContent,
    textDirty,
    textLoading,
    textEncoding,
    textReadOnlyPreview,
    textPreviewOffset,
    textPreviewHasPrev,
    textPreviewHasNext,
    textPreviewBytes,
    textTotalBytes,
    setTextContent,
    setTextEncoding,
    loadNextTextPreviewChunk,
    loadPrevTextPreviewChunk,
  } = textSessionState;

  const { dataColumnCount, layoutStorageKey, normalizeColumnWidths: normalizeColumnWidthsCallback } =
    useCsvLayoutBasics(buildCsvLayoutBasicsOptions({
      rows,
      headersLength: headers.length,
      previewPath: preview?.path ?? null,
      activePath,
      maxUiColumns: MAX_UI_COLUMNS,
      normalizeColumnWidthsRaw,
    }));

  // Layout Hooks
  const gridLayoutState = useGridLayout(buildGridLayoutOptions({
    layoutStorageKey,
    columnCount: Math.min(dataColumnCount, MAX_UI_COLUMNS),
    normalizeColumnWidths: normalizeColumnWidthsCallback,
  }));
  const {
    columnWidths,
    rowHeaderWidth,
    rowHeight,
    headerHeightOverride,
    rowHeightOverrides,
    autoFitColumns,
    setColumnWidths,
    setRowHeaderWidth,
    setRowHeight,
    setHeaderHeightOverride,
    setRowHeightOverrides,
    setAutoFitColumns,
  } = gridLayoutState;

  const {
    startColumnResize,
    startColumnResizeAll,
    startRowHeaderResize,
    startRowHeightResizeAll,
    startHeaderRowHeightResize,
    startRowHeightResizeRow,
  } = useGridResize(buildGridResizeOptions({
    columnWidths,
    rowHeaderWidth,
    rowHeight,
    headerHeightOverride,
    rowHeightOverrides,
    setColumnWidths,
    setRowHeaderWidth,
    setRowHeight,
    setHeaderHeightOverride,
    setRowHeightOverrides,
    normalizeColumnWidths: normalizeColumnWidthsCallback,
  }));

  const {
    freezeFirstCol,
    freezeFirstRow,
    frozenFirstRowValues,
    frozenFirstRowBaseIndex,
    setFreezeFirstCol,
    setFreezeFirstRow,
    setFrozenFirstRowValues,
    setFrozenFirstRowBaseIndex,
  } = useFreezePane();

  const columnManagementState = useColumnManagement(buildColumnManagementOptions({
    dataColumnCount,
  }));
  const {
    hiddenCols,
    columnOrder,
    setHiddenCols,
    setColumnOrder,
    handleToggleColumnHidden,
    handleShowAllColumns,
    handleHideAllColumns,
  } = columnManagementState;

  const [rowIndexMap, setRowIndexMap] = useState<number[] | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  // Re-added rowIndexMap because it was in the deleted block but not replaced by a hook yet


  const csvInputState = useCsvInputState();
  const {
    columnIndexInput, columnNameInput,
    rowIndexInput, pasteMode, setColumnSearch,
  } = csvInputState;
  const csvSortFilterModel = useCsvSortFilterModel();
  const {
    sortRules,
    setSortRules,
    filterRules,
    setFilterRules,
    hasSortFilter,
  } = csvSortFilterModel;

  const csvPanelVisibilityState = useCsvPanelVisibilityState();
  const {
    setShowQuickbar, setShowFindBar, showMacroPanel, setShowMacroPanel,
    showOpsPanel, setShowOpsPanel, showExportPanel, setShowExportPanel, showFindPanel, setShowFindPanel,
    showStatsPanel, setShowStatsPanel,
  } = csvPanelVisibilityState;
  const sortFilterPreferences = useSortFilterPreferences();
  const {
    sortFilterMemoryLimitMb,
    forceExternalSort,
    autoIndexMode,
  } = sortFilterPreferences;
  const [lastIndexTrigger, setLastIndexTrigger] = useState<"auto" | "manual" | null>(null);
  const { recentFiles, addRecentFile } = useRecentFiles();
  const localeState = useLocaleState();
  const { locale } = localeState;

  const { csvGridFocused, setCsvGridFocused } = useCsvGridFocusState(buildCsvGridFocusStateOptions({ fileMode }));
  const csvFindState = useCsvFindState();
  const { activeFindMatchIndex } = csvFindState;
  const tabState = useTabState();
  const { tabs, setTabs, activeTabId } = tabState;
  const {
    globalViewTotal, setGlobalViewTotal, globalViewLoading, setGlobalViewLoading,
    globalViewPatchTick, setGlobalViewPatchTick, globalViewIdRef, globalViewBuildRef,
    globalViewRebuildTimerRef, globalViewBuildRunningRef, globalViewBuildPendingRef,
  } = useGlobalViewState();
  const { pendingInitialSaveRef, pendingImportRef } = usePendingWorkflowRefs();
  const diagnosticsState = useDiagnostics();
  const {
    bumpDiagnostics,
  } = diagnosticsState;
  const textFindReplaceState = useTextFindReplaceState();
  const {
    textFindHits,
    textFindContextRadiusInput,
    setTextFindContextRadiusInput,
    textFindQuery,
    textFindUseRegex,
    textFindMatchCase,
    activeTextFindIndex,
  } = textFindReplaceState;

  const { t } = useLocaleTranslator(buildLocaleTranslatorOptions({ locale }));

  const textFindResultPanelPagination = useTextFindResultPanelPagination(
    buildTextFindResultPanelPaginationOptions({
    textFindHitsLength: textFindHits.length,
    pageLimit: TEXT_FIND_RESULTS_PANEL_LIMIT,
    }),
  );
  const { textFindResultPanelRange } = textFindResultPanelPagination;

  const { showPanels, drawerCollapsed, setDrawerCollapsed, showDrawer, sidebarWidth, startSidebarResize } =
    usePanelDrawer(buildPanelDrawerOptions({
      showMacroPanel,
      showOpsPanel,
      showExportPanel,
      showFindPanel,
      showStatsPanel,
    }));



  const textFindResultsModelState = useTextFindResultsModel(buildTextFindResultsModelOptions({
    textFindHits,
    textFindResultPanelRange,
    textReadOnlyPreview,
    textPreviewBytes,
    textPreviewOffset,
    largeTextPreviewBytes: LARGE_TEXT_PREVIEW_BYTES,
    textFindContextRadiusInput,
    setTextFindContextRadiusInput,
    textPath,
    textFindQuery,
    textFindUseRegex,
    textFindMatchCase,
    activeTextFindIndex,
    textEncoding,
    t,
  }));

  const { shouldAutoBuildIndex } = useAutoIndexPolicy(buildAutoIndexPolicyOptions({
    autoIndexMode,
    autoIndexThresholdBytes: AUTO_INDEX_THRESHOLD_BYTES,
  }));

  const {
    displayColumnCount,
    selectionColumnCount,
    gridHeaders,
    selectionRowCount,
  } = useCsvGridDerivedState(buildCsvGridDerivedStateOptions({
    dataColumnCount,
    maxUiColumns: MAX_UI_COLUMNS,
    headers,
    windowStart,
    rowsLength: rows.length,
    fileMode,
    hasSortFilter,
    globalViewTotal,
  }));
  const { queueGlobalViewPatchRefresh } = useCsvGlobalViewPatchQueue(buildCsvGlobalViewPatchQueueOptions({
    hasSortFilter,
    sortRules,
    filterRules,
    debounceMs: GLOBAL_VIEW_PATCH_DEBOUNCE_MS,
    setGlobalViewPatchTick,
  }));
  const {
    selectionAnchor,
    selectionRanges,
    selectionMode,
    isDraggingSelection,
    setIsDraggingSelection,
    updateSelection,
    clearSelection,
    selectAll,
    getActiveRange,
    isCellInSelection,
    isRowInSelection,
    isColInSelection,
  } = useSelection(selectionRowCount, selectionColumnCount);
  const activeRange = getActiveRange();

  const csvDataModelState = useCsvDataModel(buildCsvDataModelOptions({
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
    getCurrentDelimiter: () => delimiterApplied ?? delimiter,
    getActiveRange,
    clearSelection,
    setError,
    onGlobalViewPatchRefresh: queueGlobalViewPatchRefresh,
    t,
  }));
  const {
    patches,
    undoStack,
    redoStack,
    setUndoStack,
    setRedoStack,
    clearedRows,
    clearedCols,
    editingCell,
    editingHeader,
    setEditingCell,
    setEditingHeader,
    rowOps,
    columnOps,
    getCellValue,
    applyPatch,
    startEditing,
    commitEditing,
    cancelEditing,
    startHeaderEditing: startHeaderEditingModel,
    commitHeaderEditing: commitHeaderEditingModel,
    cancelHeaderEditing: cancelHeaderEditingModel,
    copySelection,
    pasteSelection,
    undo,
    redo,
    resetOps,
    pushUndo,
    setPatches,
    setRowOps,
    setClearedRows,
    setClearedCols,
    applyColumnOpsToRows,
  } = csvDataModelState;

  const { clearDraftForPath, loadDraftForPath } = useCsvDraftPersistence(buildCsvDraftPersistenceOptions({
    fileMode,
    path: preview?.path ?? null,
    patches,
    clearedRows,
    clearedCols,
  }));

  const csvDataLoaderState = useCsvDataLoader(buildCsvDataLoaderOptions({
    activePath,
    preview,
    delimiter,
    delimiterApplied,
    rows,
    setRows,
    setEof,
    applyColumnOpsToRows,
    bumpDiagnostics,
    globalViewIdRef,
    setError,
    setLastIndexTrigger,
    windowStart,
    setWindowStart,
    setRowIndexMap,
  }));
  const {
    totalRows,
    setTotalRows,
    setIndexJobId,
    indexProgress,
    setIndexProgress,
    indexRunning,
    setIndexRunning,
    indexCanceled,
    setIndexCanceled,
    windowLoading,
    windowSize,
    setWindowSize,
    setFileSizeBytes,
    resetWindowCaches,
    cancelIndexBuild,
    refreshTotalRows,
    loadWindow,
    requestWindow,
  } = csvDataLoaderState;

  useCsvInitialWindowLoad(buildCsvInitialWindowLoadOptions({
    fileMode,
    previewPath: preview?.path ?? null,
    activePath,
    delimiter,
    delimiterApplied,
    previewDelimiter: preview?.delimiter ?? null,
    refreshTotalRows,
    loadWindow,
  }));

  const {
    startHeaderEditing,
    commitHeaderEditing,
    cancelHeaderEditing,
    appendContextUndo,
    resetRedoStack,
  } = useCsvHeaderEditingActions(buildCsvHeaderEditingActionsOptions({
    loading,
    globalViewLoading,
    hasSortFilter,
    headers,
    startHeaderEditingModel,
    commitHeaderEditingModel,
    cancelHeaderEditingModel,
    pushUndo,
  }));









  usePendingImportRules(buildPendingImportRulesOptions({
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
  }));

  const fileOpsState = useFileOps(buildFileOpsOptions({
    preview,
    headers,
    rows,
    windowStart,
    patches,
    rowOps,
    columnOps,
    clearRows: Array.from(clearedRows),
    clearCols: Array.from(clearedCols),
    getCellValue,
    applyPatch,
    pushUndo,
    setError,
    setLoading,
    t,
  }));
  const {
    resetFileOps,
  } = fileOpsState;

  const { updateActiveTabPath } = useTabPathActions(buildTabPathActionsOptions({
    activeTabId,
    setTabs,
  }));

  const { gridTemplateColumns } = useGridTemplateColumns(buildGridTemplateColumnsOptions({
    columnWidths,
    hiddenCols,
    rowHeaderWidth,
    normalizeColumnWidths: normalizeColumnWidthsCallback,
  }));

  const csvViewOrchestration = useCsvViewOrchestration({
    hasSortFilter,
    globalViewTotal,
    totalRows,
    autoFitColumns,
    selectionColumnCount,
    headers,
    rows,
    windowStart,
    getCellValue,
    setColumnWidths,
    fileMode,
    previewPath: preview?.path ?? null,
    activePath,
    rowHeight,
    rowHeightOverrides,
    eof,
    windowLoading,
    requestWindow,
    bumpDiagnostics,
    activeTabId,
    tabs,
    rowOps,
    columnOps,
    clearedRows,
    clearedCols,
    textDirty,
    setTabs,
    showStatsPanel,
    dataColumnCount,
    t,
    displayColumnCount,
    columnOrder,
    setColumnOrder,
    patches,
    delimiter,
    delimiterApplied,
    previewDelimiter: preview?.delimiter ?? null,
    globalViewIdRef,
    freezeFirstRow,
    applyColumnOpsToRows,
    setFrozenFirstRowValues,
    setFrozenFirstRowBaseIndex,
    frozenFirstRowValues,
    frozenFirstRowBaseIndex,
    setGlobalViewTotal,
    setSortRules,
    setFilterRules,
    setHiddenCols,
    setColumnSearch,
    resetOps,
    resetFileOps,
    clearSelection,
    setEditingCell,
    setFileSizeBytes,
    setWindowSize,
    setRowIndexMap,
    setIndexJobId,
    setIndexRunning,
    setIndexProgress,
    setIndexCanceled,
    resetWindowCaches,
    setTotalRows,
    setWindowStart,
    setRowHeight,
    setRowHeightOverrides,
    setPatches,
    setClearedRows,
    setClearedCols,
    setUndoStack,
    setRedoStack,
    selectionRowCount,
    selectionAnchor,
    selectionRanges,
    getActiveRange,
    applyPatch,
    pushUndo,
    setError,
    windowSize,
    queueGlobalViewPatchRefresh,
    copySelection,
    editingCell,
    selectAll,
    pasteSelection,
    updateSelection,
    startEditing,
    sortRules,
    filterRules,
    globalViewPatchTick,
    sortFilterMemoryLimitMb,
    forceExternalSort,
    globalViewBuildRef,
    globalViewRebuildTimerRef,
    globalViewBuildRunningRef,
    globalViewBuildPendingRef,
    setGlobalViewLoading,
  });

const { saveCurrentTabData, loadTabData } = useAppTabPersistenceBridge({
  tabState,
  csvSessionState,
  textSessionState,
  gridLayoutState,
  columnManagementState,
  csvDataModelState,
  csvDataLoaderState,
  setFileMode,
});

const textSearchActions = useTextSearchActionsBridge({
  textSessionState,
  textFindReplaceState,
  textFindResultPanelPagination,
  textFindResultsModelState,
  updateActiveTabPath,
  setError,
  t,
});

const csvWorkflowActions = useCsvWorkflowActionsBridge({
  csvInputState,
  csvSortFilterModel,
  csvFindState,
  fileOpsState,
  fileMode,
  textSearchActions,
  clearDraftForPath,
  csvSessionState,
  updateActiveTabPath,
  resetSessionState: csvViewOrchestration.resetSessionState,
  setFileMode,
  csvDataLoaderState,
  shouldAutoBuildIndex,
  tabState,
  saveCurrentTabData,
  pendingInitialSaveRef,
  textSessionState,
  csvDataModelState,
  setError,
  setGlobalViewPatchTick,
  setIsDraggingSelection,
  updateSelection,
  t,
  globalViewIdRef,
  csvViewOrchestration,
  selectionColumnCount,
  getActiveRange,
  globalViewLoading,
  dataColumnCount,
  startHeaderEditing,
  appendContextUndo,
  resetRedoStack,
});

const appCommandActions = useAppCommandActionsBridge({
  csvInputState,
  tabState,
  csvSessionState,
  textSessionState,
  csvDataModelState,
  csvDataLoaderState,
  csvWorkflowActions,
  fileOpsState,
  pendingImportRef,
  pendingInitialSaveRef,
  loadDraftForPath,
  loadTabData,
  saveCurrentTabData,
  clearDraftForPath,
  addRecentFile,
  fileMode,
  setFileMode,
  shouldAutoBuildIndex,
  setRowIndexMap,
  resetSessionState: csvViewOrchestration.resetSessionState,
  saveTextAs: textSearchActions.saveTextAs,
  loadNextWindow: csvViewOrchestration.loadNextWindow,
  t,
  locale,
  setShowExportPanel,
  setShowFindBar,
  setShowFindPanel,
  setShowMacroPanel,
  setShowOpsPanel,
  setShowQuickbar,
  setShowStatsPanel,
});

const { textEditorPageProps, csvWorkspacePageProps } = buildAppViewPageProps({
  csvInputState,
  csvSortFilterModel,
  csvPanelVisibilityState,
  sortFilterPreferences,
  localeState,
  csvFindState,
  diagnosticsState,
  fileOpsState,
  csvViewOrchestration,
  csvWorkflowActions,
  appCommandActions,
  textFindReplaceState,
  textFindResultPanelPagination,
  textFindResultsModelState,
  textSearchActions,
  activeFindMatchIndex,
  activeRange,
  activeTabId,
  autoFitColumns,
  cancelEditing,
  cancelHeaderEditing,
  clearSelection,
  columnWidths,
  commitEditing,
  commitHeaderEditing,
  delimiter,
  delimiterApplied,
  delimiterPresets,
  drawerCollapsed,
  editingCell,
  editingHeader,
  error,
  freezeFirstCol,
  freezeFirstRow,
  getCellValue,
  globalViewLoading,
  gridHeaders,
  gridTemplateColumns,
  handleHideAllColumns,
  handleShowAllColumns,
  handleToggleColumnHidden,
  hasSortFilter,
  headerHeightOverride,
  hiddenCols,
  isCellInSelection,
  isColInSelection,
  isDraggingSelection,
  isRowInSelection,
  loading,
  pasteSelection,
  patches,
  preview,
  recentFiles,
  redo,
  redoStack,
  rowHeaderWidth,
  rowHeight,
  rows,
  selectionAnchor,
  selectionColumnCount,
  selectionMode,
  setAutoFitColumns,
  setCsvGridFocused,
  setDelimiter,
  setDrawerCollapsed,
  setEditingCell,
  setEditingHeader,
  setFreezeFirstCol,
  setFreezeFirstRow,
  setIsDraggingSelection,
  showDrawer,
  showPanels,
  sidebarWidth,
  startColumnResize,
  startColumnResizeAll,
  startEditing,
  startHeaderEditing,
  startHeaderRowHeightResize,
  startRowHeaderResize,
  startRowHeightResizeAll,
  startRowHeightResizeRow,
  startSidebarResize,
  t,
  tabs,
  undo,
  undoStack,
  updateSelection,
  textPath,
  textDirty,
  textEncoding,
  textReadOnlyPreview,
  textLoading,
  textPreviewHasPrev,
  textPreviewHasNext,
  textTotalBytes,
  textPreviewOffset,
  textPreviewBytes,
  largeTextPreviewBytes: LARGE_TEXT_PREVIEW_BYTES,
  largeTextFileThresholdBytes: LARGE_TEXT_FILE_THRESHOLD_BYTES,
  textContent,
  formatByteSize,
  setTextEncoding,
  setTextContent,
  loadPrevTextPreviewChunk,
  loadNextTextPreviewChunk,
  windowLoading,
  fileMode,
  csvGridFocused,
  previewPath: preview?.path ?? null,
  eof,
  rowsLength: rows.length,
  patchCount: Object.keys(patches).length,
  indexRunning,
  indexProgress,
  indexCanceled,
  autoIndexMode,
  forceExternalSort,
  lastIndexTrigger,
  totalRows,
  refreshTotalRows,
  cancelIndexBuild,
});

  return {
    fileMode,
    textEditorPageProps,
    csvWorkspacePageProps,
  };
}



