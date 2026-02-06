import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type UIEvent,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  confirm,
  message,
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { useVirtualizer } from "@tanstack/react-virtual";
import FindBar from "./components/FindBar";
import GridView from "./components/GridView";
import Panels from "./components/Panels";
import Quickbar from "./components/Quickbar";
import StatusBar from "./components/StatusBar";
import SurfaceHeader from "./components/SurfaceHeader";
import useRowColumnOps, { type RowOp } from "./hooks/useRowColumnOps";
import useCsvSession from "./hooks/useCsvSession";
import useFileOps from "./hooks/useFileOps";
import useSelection from "./hooks/useSelection";
import useTextSession from "./hooks/useTextSession";
import TabBar from "./components/TabBar";
import type { TabData } from "./components/TabBar/types";
import "./App.css";

type PatchEntry = { key: string; value: string };
type DiagnosticState = {
  scrollEvents: number;
  autoDown: number;
  autoUp: number;
  requestCalls: number;
  loadCalls: number;
  cacheHits: number;
  lastStart: number | null;
  lastRows: number;
  lastEof: boolean;
  lastScrollTop: number;
  lastTotalSize: number;
  blockedLoading: number;
  blockedSuppress: number;
  blockedEof: number;
  blockedDuplicate: number;
  lastAction: string;
};

const createDiagnosticState = (): DiagnosticState => ({
  scrollEvents: 0,
  autoDown: 0,
  autoUp: 0,
  requestCalls: 0,
  loadCalls: 0,
  cacheHits: 0,
  lastStart: null,
  lastRows: 0,
  lastEof: false,
  lastScrollTop: 0,
  lastTotalSize: 0,
  blockedLoading: 0,
  blockedSuppress: 0,
  blockedEof: 0,
  blockedDuplicate: 0,
  lastAction: "idle",
});
type UndoOp =
  | { kind: "cell"; key: string; prev: string | null; next: string | null }
  | { kind: "bulk"; entries: Array<{ key: string; prev: string | null; next: string | null }> }
  | { kind: "clear_rows"; rows: number[]; patches: PatchEntry[] }
  | { kind: "clear_cols"; cols: number[]; patches: PatchEntry[] }
  | { kind: "row_insert"; index: number; values: string[] }
  | { kind: "row_delete"; index: number; values: string[]; wasCleared?: boolean }
  | { kind: "col_insert"; index: number; name: string }
  | {
      kind: "col_delete";
      index: number;
      name: string;
      values: Array<{ row: number; value: string }>;
      wasCleared?: boolean;
    }
  | { kind: "col_rename"; index: number; prev: string; next: string }
  | { kind: "row_duplicate"; index: number; values: string[] }
  | { kind: "col_duplicate"; index: number };

type TabFileData = {
  fileType: "csv" | "text";
  csvData?: {
    rows: string[][];
    headers: string[];
    delimiter: string;
    delimiterApplied: string | null;
    windowStart: number;
    windowSize: number;
    eof: boolean;
    patches: Record<string, string>;
    undoStack: UndoOp[];
    redoStack: UndoOp[];
    columnWidths: number[];
    rowHeaderWidth: number;
    rowHeight: number;
    headerHeightOverride: number | null;
    rowHeightOverrides: Record<number, number>;
    autoFitColumns: boolean;
    hiddenCols: number[];
    totalRows: number | null;
    preview: { path: string; delimiter: string } | null;
    activePath: string | null;
    rowOps: ReturnType<typeof useRowColumnOps>["rowOps"];
    columnOps: ReturnType<typeof useRowColumnOps>["columnOps"];
    clearedRows: number[];
    clearedCols: number[];
    columnOrder: number[];
  };
  textData?: {
    content: string;
    dirty: boolean;
    path: string;
    encoding: "UTF-8" | "UTF-16LE";
  };
};

const delimiterPresets = [
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Tab (\\t)", value: "\t" },
  { label: "Pipe (|)", value: "|" },
];

function App() {
  const [error, setError] = useState<string | null>(null);
  const [fileMode, setFileMode] = useState<"none" | "csv" | "text">("none");
  const openDialogActiveRef = useRef(false);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [indexJobId, setIndexJobId] = useState<number | null>(null);
  const [indexProgress, setIndexProgress] = useState(0);
  const [indexRunning, setIndexRunning] = useState(false);
  const [indexCanceled, setIndexCanceled] = useState(false);
  const [windowStart, setWindowStart] = useState(0);
  const [windowLoading, setWindowLoading] = useState(false);
  const [windowSize, setWindowSize] = useState(400);
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [rowHeaderWidth, setRowHeaderWidth] = useState(52);
  const [rowHeight, setRowHeight] = useState(28);
  const [headerHeightOverride, setHeaderHeightOverride] = useState<number | null>(null);
  const [rowHeightOverrides, setRowHeightOverrides] = useState<Record<number, number>>({});
  const [rowIndexMap, setRowIndexMap] = useState<number[] | null>(null);
  const [autoFitColumns, setAutoFitColumns] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
  const [columnOrder, setColumnOrder] = useState<number[]>([]);
  const resizeStateRef = useRef<
    | { type: "col"; index: number; startX: number; startWidth: number }
    | { type: "colAll"; startX: number; startWidths: number[]; startRowHeaderWidth: number }
    | { type: "row"; startX: number; startWidth: number }
    | { type: "headerRow"; startY: number; startHeight: number }
    | { type: "rowHeightAll"; startY: number; startHeight: number }
    | { type: "rowHeightRow"; rowIndex: number; startY: number; startHeight: number }
    | null
  >(null);
  const [patches, setPatches] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<UndoOp[]>([]);
  const [redoStack, setRedoStack] = useState<UndoOp[]>([]);
  const [columnIndexInput, setColumnIndexInput] = useState("0");
  const [columnNameInput, setColumnNameInput] = useState("");
  const [rowIndexInput, setRowIndexInput] = useState("0");
  const [sortColumnInput, setSortColumnInput] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumnInput, setFilterColumnInput] = useState("");
  const [filterText, setFilterText] = useState("");
  const [sortRules, setSortRules] = useState<
    Array<{ column: string; direction: "asc" | "desc" }>
  >([]);
  const [filterRules, setFilterRules] = useState<Array<{ column: string; value: string }>>(
    [],
  );
  const hasSortFilter = sortRules.length > 0 || filterRules.length > 0;
  const [clearedRows, setClearedRows] = useState<Set<number>>(new Set());
  const [clearedCols, setClearedCols] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<
    | { type: "row"; index: number; x: number; y: number }
    | { type: "col"; index: number; x: number; y: number }
    | null
  >(null);
  const [editingHeader, setEditingHeader] = useState<{ index: number; value: string } | null>(
    null,
  );
  const [showQuickbar, setShowQuickbar] = useState(true);
  const [showFindBar, setShowFindBar] = useState(true);
  const [showMacroPanel, setShowMacroPanel] = useState(false);
  const [showOpsPanel, setShowOpsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [sortFilterMemoryLimitMb, setSortFilterMemoryLimitMb] = useState(300);
  const [sortFilterMemoryLimitText, setSortFilterMemoryLimitText] = useState("300");
  const [pasteMode, setPasteMode] = useState<"auto" | "strict" | "delimiter">("auto");
  const [columnSearch, setColumnSearch] = useState("");
  const [importSkipRows, setImportSkipRows] = useState("0");
  const [importFirstRowHeader, setImportFirstRowHeader] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem("nmeditor.recentFiles");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [locale, setLocale] = useState<"en" | "zh">(() => {
    const stored = window.localStorage.getItem("nmeditor.locale");
    if (stored === "en" || stored === "zh") return stored;
    return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
  });
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
    value: string;
  } | null>(null);
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabDataMap, setTabDataMap] = useState<Map<string, TabFileData>>(new Map());
  const [globalViewTotal, setGlobalViewTotal] = useState<number | null>(null);
  const [globalViewLoading, setGlobalViewLoading] = useState(false);
  const [globalViewPatchTick, setGlobalViewPatchTick] = useState(0);
  const globalViewIdRef = useRef<number | null>(null);
  const globalViewBuildRef = useRef(0);
  const globalViewRebuildTimerRef = useRef<number | null>(null);
  const globalViewBuildRunningRef = useRef(false);
  const globalViewBuildPendingRef = useRef(false);
  const globalViewPatchTimerRef = useRef<number | null>(null);
  const globalViewPatchPendingRef = useRef(false);
  const pendingInitialSaveRef = useRef<{ tabId: string; type: "csv" | "text" } | null>(
    null,
  );
  const draftSaveTimerRef = useRef<number | null>(null);
  const pendingImportRef = useRef<{ skipRows: number; firstRowHeader: boolean } | null>(null);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("nmeditor.diagnostics") === "1";
    } catch {
      return false;
    }
  });
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>(createDiagnosticState);
  const diagnosticRef = useRef<DiagnosticState>(createDiagnosticState());
  const diagnosticRafRef = useRef<number | null>(null);

  const t = useCallback(
    (en: string, zh: string) => (locale === "zh" ? zh : en),
    [locale],
  );

  const flushDiagnostics = useCallback(() => {
    if (!diagnosticsEnabled) return;
    if (diagnosticRafRef.current !== null) return;
    diagnosticRafRef.current = window.requestAnimationFrame(() => {
      diagnosticRafRef.current = null;
      setDiagnosticState({ ...diagnosticRef.current });
    });
  }, [diagnosticsEnabled]);

  const bumpDiagnostics = useCallback(
    (updater: (current: DiagnosticState) => DiagnosticState) => {
      if (!diagnosticsEnabled) return;
      diagnosticRef.current = updater(diagnosticRef.current);
      flushDiagnostics();
    },
    [diagnosticsEnabled, flushDiagnostics],
  );

  const resetDiagnostics = useCallback(() => {
    const next = createDiagnosticState();
    diagnosticRef.current = next;
    setDiagnosticState(next);
  }, []);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      if (diagnosticRafRef.current !== null) {
        window.cancelAnimationFrame(diagnosticRafRef.current);
        diagnosticRafRef.current = null;
      }
      return;
    }
    try {
      window.localStorage.setItem("nmeditor.diagnostics", "1");
    } catch {
      // ignore storage failure
    }
    return () => {
      if (diagnosticRafRef.current !== null) {
        window.cancelAnimationFrame(diagnosticRafRef.current);
        diagnosticRafRef.current = null;
      }
    };
  }, [diagnosticsEnabled]);

  useEffect(() => {
    if (diagnosticsEnabled) return;
    try {
      window.localStorage.removeItem("nmeditor.diagnostics");
    } catch {
      // ignore storage failure
    }
  }, [diagnosticsEnabled]);

  useEffect(() => {
    const onToggleDiagnostics = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d")) return;
      event.preventDefault();
      setDiagnosticsEnabled((current) => {
        const next = !current;
        if (next) {
          resetDiagnostics();
        }
        return next;
      });
    };
    window.addEventListener("keydown", onToggleDiagnostics);
    return () => window.removeEventListener("keydown", onToggleDiagnostics);
  }, [resetDiagnostics]);

  const showPanels =
    showMacroPanel || showOpsPanel || showExportPanel || showFindPanel || showStatsPanel;
  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const showDrawer = showPanels && !drawerCollapsed;
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const startSidebarResize = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    sidebarDragRef.current = { startX: event.clientX, startWidth: sidebarWidth };
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMove = (event: globalThis.MouseEvent) => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      const nextWidth = Math.min(520, Math.max(220, drag.startWidth - (event.clientX - drag.startX)));
      setSidebarWidth(nextWidth);
    };
    const handleUp = () => {
      sidebarDragRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const addRecentFile = useCallback((path: string) => {
    setRecentFiles((current) => {
      const next = [path, ...current.filter((item) => item !== path)].slice(0, 8);
      try {
        window.localStorage.setItem("nmeditor.recentFiles", JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);


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
    openCsvPath,
    closeSession,
    applyDelimiter,
  } = useCsvSession({ setError });


  const {
    textPath,
    textContent,
    textDirty,
    textLoading,
    textEncoding,
    setTextContent,
    setTextPath,
    setTextContentState,
    setTextDirty,
    setTextEncoding,
    openText,
    saveTextTo,
    resetTextSession,
  } = useTextSession({ setError });

  const MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
  const PREFETCH_ENABLED = true;
  const AUTO_INDEX_THRESHOLD_BYTES = 300 * 1024 * 1024;
  const GLOBAL_VIEW_REBUILD_DEBOUNCE_MS = 650;
  const GLOBAL_VIEW_PATCH_DEBOUNCE_MS = 220;
  const TAB_ROW_SNAPSHOT_LIMIT = 200;

  const getDraftKey = useCallback((path: string) => {
    const encoded = encodeURIComponent(path);
    return `nmeditor.draft.${encoded}`;
  }, []);

  const clearDraftForPath = useCallback(
    (path: string | null) => {
      if (!path) return;
      try {
        window.localStorage.removeItem(getDraftKey(path));
      } catch {
        // ignore storage errors
      }
    },
    [getDraftKey],
  );

  const loadDraftForPath = useCallback(
    (path: string) => {
      try {
        const raw = window.localStorage.getItem(getDraftKey(path));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
          patches?: Record<string, string>;
          clearedRows?: number[];
          clearedCols?: number[];
          updatedAt?: number;
        };
        return parsed;
      } catch {
        return null;
      }
    },
    [getDraftKey],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem("nmeditor.sortfilter.memoryLimitMb");
    if (!raw) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 50 && parsed <= 4096) {
      setSortFilterMemoryLimitMb(parsed);
      setSortFilterMemoryLimitText(String(parsed));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "nmeditor.sortfilter.memoryLimitMb",
      String(sortFilterMemoryLimitMb),
    );
    setSortFilterMemoryLimitText(String(sortFilterMemoryLimitMb));
  }, [sortFilterMemoryLimitMb]);

  const dataColumnCount = useMemo(() => {
    const rowMax = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return Math.max(headers.length, rowMax);
  }, [headers.length, rows]);

  const MAX_UI_COLUMNS = 2000;
  const displayColumnCount = Math.min(dataColumnCount, MAX_UI_COLUMNS);

  const handleToggleColumnHidden = useCallback((index: number) => {
    setHiddenCols((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleShowAllColumns = useCallback(() => {
    setHiddenCols(new Set());
  }, []);

  const handleHideAllColumns = useCallback(() => {
    const count = Math.max(dataColumnCount, 0);
    setHiddenCols(new Set(Array.from({ length: count }, (_, idx) => idx)));
  }, [dataColumnCount]);

  useEffect(() => {
    setColumnOrder((current) => {
      if (!current.length) return current;
      const maxIndex = Math.max(dataColumnCount, 0);
      const filtered = current.filter((idx) => idx >= 0 && idx < maxIndex);
      const missing: number[] = [];
      const present = new Set(filtered);
      for (let idx = 0; idx < maxIndex; idx += 1) {
        if (!present.has(idx)) missing.push(idx);
      }
      return [...filtered, ...missing];
    });
  }, [dataColumnCount]);

  const columnCount = Math.max(displayColumnCount, 3);
  const selectionColumnCount = columnCount;
  const gridHeaders = useMemo(() => headers.slice(0, selectionColumnCount), [headers, selectionColumnCount]);
  const globalViewRelevantColumns = useMemo(() => {
    const columns = new Set<number>();
    sortRules.forEach((rule) => {
      const parsed = Number.parseInt(rule.column, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) columns.add(parsed);
    });
    filterRules.forEach((rule) => {
      const parsed = Number.parseInt(rule.column, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) columns.add(parsed);
    });
    return columns;
  }, [sortRules, filterRules]);

  const queueGlobalViewPatchRefresh = useCallback(
    (column: number) => {
      if (!hasSortFilter) return;
      if (globalViewRelevantColumns.size > 0 && !globalViewRelevantColumns.has(column)) return;
      globalViewPatchPendingRef.current = true;
      if (globalViewPatchTimerRef.current !== null) return;
      globalViewPatchTimerRef.current = window.setTimeout(() => {
        globalViewPatchTimerRef.current = null;
        if (!globalViewPatchPendingRef.current) return;
        globalViewPatchPendingRef.current = false;
        setGlobalViewPatchTick((current) => current + 1);
      }, GLOBAL_VIEW_PATCH_DEBOUNCE_MS);
    },
    [GLOBAL_VIEW_PATCH_DEBOUNCE_MS, globalViewRelevantColumns, hasSortFilter],
  );

  useEffect(() => {
    if (hasSortFilter) return;
    globalViewPatchPendingRef.current = false;
    if (globalViewPatchTimerRef.current !== null) {
      window.clearTimeout(globalViewPatchTimerRef.current);
      globalViewPatchTimerRef.current = null;
    }
  }, [hasSortFilter]);

  useEffect(
    () => () => {
      if (globalViewPatchTimerRef.current !== null) {
        window.clearTimeout(globalViewPatchTimerRef.current);
        globalViewPatchTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    setColumnWidths((current) => {
      const next = [...current];
      for (let i = next.length; i < columnCount; i += 1) {
        next.push(140);
      }
      if (next.length > columnCount) {
        next.length = columnCount;
      }
      return next;
    });
  }, [columnCount]);

  const layoutStorageKey = useMemo(() => {
    const path = preview?.path ?? activePath;
    if (!path) return "nmeditor.grid.layout.default";
    return `nmeditor.grid.layout.${path}`;
  }, [preview?.path, activePath]);

  useEffect(() => {
    const raw = window.localStorage.getItem(layoutStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        columnWidths?: number[];
        rowHeaderWidth?: number;
        rowHeight?: number;
        headerHeightOverride?: number;
        rowHeightOverrides?: Record<string, number>;
        autoFitColumns?: boolean;
      };
      if (Array.isArray(parsed.columnWidths)) {
        setColumnWidths(parsed.columnWidths.map((value) => Math.max(60, Number(value) || 140)));
      }
      if (typeof parsed.rowHeaderWidth === "number" && Number.isFinite(parsed.rowHeaderWidth)) {
        setRowHeaderWidth(Math.max(36, parsed.rowHeaderWidth));
      }
      if (typeof parsed.rowHeight === "number" && Number.isFinite(parsed.rowHeight)) {
        setRowHeight(Math.max(18, Math.min(300, parsed.rowHeight)));
      }
      if (
        typeof parsed.headerHeightOverride === "number" &&
        Number.isFinite(parsed.headerHeightOverride)
      ) {
        setHeaderHeightOverride(Math.max(18, Math.min(300, parsed.headerHeightOverride)));
      }
      if (parsed.rowHeightOverrides && typeof parsed.rowHeightOverrides === "object") {
        const next: Record<number, number> = {};
        Object.entries(parsed.rowHeightOverrides).forEach(([key, value]) => {
          const index = Number.parseInt(key, 10);
          if (Number.isNaN(index)) return;
          const parsedValue = Number(value);
          if (!Number.isFinite(parsedValue)) return;
          const height = Math.max(18, Math.min(300, parsedValue));
          next[index] = height;
        });
        setRowHeightOverrides(next);
      }
      if (typeof parsed.autoFitColumns === "boolean") {
        setAutoFitColumns(parsed.autoFitColumns);
      }
    } catch {
      // ignore malformed storage
    }
  }, [layoutStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({
        columnWidths,
        rowHeaderWidth,
        rowHeight,
        headerHeightOverride,
        rowHeightOverrides,
        autoFitColumns,
      }),
    );
  }, [
    columnWidths,
    rowHeaderWidth,
    rowHeight,
    headerHeightOverride,
    rowHeightOverrides,
    autoFitColumns,
    layoutStorageKey,
  ]);

  const streamRowCount = useMemo(() => {
    if (totalRows !== null) return totalRows;
    return Math.max(windowStart + rows.length, rows.length);
  }, [totalRows, windowStart, rows.length]);

  const selectionRowCount =
    fileMode === "csv"
      ? (hasSortFilter ? globalViewTotal ?? rows.length : streamRowCount)
      : rows.length;

  const {
    selectionAnchor,
    selectionMode,
    isDraggingSelection,
    setIsDraggingSelection,
    updateSelection,
    clearSelection,
    getActiveRange,
    isCellInSelection,
    isRowInSelection,
    isColInSelection,
  } = useSelection(selectionRowCount, selectionColumnCount);

  const mapViewRowToBase = useCallback(
    (viewRow: number) => {
      if (!rowIndexMap) return viewRow;
      const offset = viewRow - windowStart;
      if (offset < 0 || offset >= rowIndexMap.length) return viewRow;
      return rowIndexMap[offset];
    },
    [rowIndexMap, windowStart],
  );

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

  const applyPatchValue = useCallback(
    (key: string, value: string | null) => {
      const sep = key.lastIndexOf(":");
      if (sep >= 0) {
        const col = Number.parseInt(key.slice(sep + 1), 10);
        if (!Number.isNaN(col)) {
          queueGlobalViewPatchRefresh(col);
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
    [queueGlobalViewPatchRefresh],
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

  const startEditing = (row: number, col: number) => {
    setEditingCell({ row, col, value: getCellValue(row, col) });
  };

  const commitEditing = () => {
    if (!editingCell) return;
    applyPatchWithUndo(editingCell.row, editingCell.col, editingCell.value);
    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
  };

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
        renameColumnAtIndex(last.index, last.prev);
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
        renameColumnAtIndex(last.index, last.next);
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

  const resetTransientEdits = () => {
    setUndoStack([]);
    setRedoStack([]);
    setEditingCell(null);
  };

  const getColumnCount = useCallback(() => dataColumnCount, [dataColumnCount]);

  const getCurrentDelimiter = useCallback(
    () => delimiterApplied ?? delimiter,
    [delimiterApplied, delimiter],
  );

  const pushUndo = (op: UndoOp) => {
    setUndoStack((current) => [...current, op]);
    setRedoStack([]);
  };

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
    renameColumnAtIndex,
    copySelection,
    pasteSelection,
  } = useRowColumnOps({
    headers,
    rows,
    rowIndexInput,
    columnIndexInput,
    columnNameInput,
    getColumnCount,
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
  }, [fileMode, rows, setRowOps, setRows, setHeaders, setWindowStart, totalRows]);

  useEffect(() => {
    if (!pendingImportRef.current) return;
    if (fileMode !== "csv" || loading) return;
    if (!rows.length) return;
    applyPendingImportRules();
  }, [applyPendingImportRules, fileMode, loading, rows.length]);

  const {
    macroOp,
    macroColumn,
    macroFind,
    macroReplace,
    macroText,
    macroScope,
    macroAppliedCount,
    macroOutputPath,
    setMacroOp,
    setMacroColumn,
    setMacroFind,
    setMacroReplace,
    setMacroText,
    setMacroScope,
    findText,
    replaceText,
    findScope,
    useRegex,
    matchCase,
    findColumnInput,
    findStartRow,
    findEndRow,
    findAppliedCount,
    findOutputPath,
    setFindText,
    setReplaceText,
    setFindScope,
    setUseRegex,
    setMatchCase,
    setFindColumnInput,
    setFindStartRow,
    setFindEndRow,
    eolMode,
    includeBom,
    encodingMode,
    dialectDelimiter,
    dialectQuote,
    dialectEscape,
    setEolMode,
    setIncludeBom,
    setEncodingMode,
    setDialectDelimiter,
    setDialectQuote,
    setDialectEscape,
    fullStats,
    fullStatsLoading,
    opStatus,
    resetFileOps,
    runFullStats,
    runMacro,
    runMacroOnFile,
    applyFindReplace,
    runFindReplaceOnFile,
    saveToPath,
    saveAs,
  } = useFileOps({
    preview,
    headers,
    rows,
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
  });

  const getBaseName = useCallback((path: string) => {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1] || path;
  }, []);

  const updateActiveTabPath = useCallback((nextPath: string) => {
    if (!activeTabId) return;
    const fileName = getBaseName(nextPath);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, path: nextPath, fileName } : tab,
      ),
    );
  }, [activeTabId, getBaseName]);

  const addSortRule = () => {
    const column = sortColumnInput.trim();
    if (!column) return;
    setSortRules((current) => [...current, { column, direction: sortDirection }]);
    setSortColumnInput("");
  };

  const addFilterRule = () => {
    const column = filterColumnInput.trim();
    const value = filterText.trim();
    if (!column || !value) return;
    setFilterRules((current) => [...current, { column, value }]);
    setFilterColumnInput("");
    setFilterText("");
  };

  const clearSortFilter = () => {
    setSortRules([]);
    setFilterRules([]);
  };

  const removeSortRule = (index: number) => {
    setSortRules((current) => current.filter((_, idx) => idx !== index));
  };

  const removeFilterRule = (index: number) => {
    setFilterRules((current) => current.filter((_, idx) => idx !== index));
  };

  const totalRowCount = hasSortFilter
    ? globalViewTotal ?? rows.length
    : streamRowCount;

  const effectiveTotalRows = hasSortFilter ? globalViewTotal : totalRows;

  const virtualCount = rows.length;
  const virtualPaddingStart = windowStart * rowHeight;
  const virtualPaddingEnd =
    effectiveTotalRows !== null
      ? Math.max(effectiveTotalRows - windowStart - rows.length, 0) * rowHeight
      : 0;

  const getRowIndex = useCallback(
    (virtualIndex: number) => windowStart + virtualIndex,
    [windowStart],
  );

  const isRowLoaded = useCallback(
    (rowIndex: number) => rowIndex >= windowStart && rowIndex < windowStart + rows.length,
    [rows.length, windowStart],
  );

  const getRowHeight = useCallback(
    (rowIndex: number) => rowHeightOverrides[rowIndex] ?? rowHeight,
    [rowHeightOverrides, rowHeight],
  );

  const gridTemplateColumns = useMemo(() => {
    let widths = columnWidths.length
      ? columnWidths
      : new Array(selectionColumnCount).fill(140);

    // Safety check: Pad widths if they don't match column count to prevent wrapping
    if (widths.length < selectionColumnCount) {
      widths = [...widths, ...new Array(selectionColumnCount - widths.length).fill(140)];
    }

    const columnDefs = widths.map((width, index) =>
      hiddenCols.has(index) ? "0px" : `${width}px`,
    );

    return `${rowHeaderWidth}px ${columnDefs.join(" ")}`;
  }, [columnWidths, hiddenCols, rowHeaderWidth, selectionColumnCount]);

  const computeAutoFit = useCallback(() => {
    const widths = new Array(selectionColumnCount).fill(80);
    const headerLabels = headers.length ? headers : new Array(selectionColumnCount).fill("");
    headerLabels.forEach((label, idx) => {
      widths[idx] = Math.max(widths[idx], label.length * 8 + 24);
    });
    const maxCells = 20000;
    const maxRows = Math.max(50, Math.floor(maxCells / Math.max(selectionColumnCount, 1)));
    const sampleRows = rows.length > maxRows ? rows.slice(0, maxRows) : rows;
    sampleRows.forEach((_, rowOffset) => {
      const rowIndex = windowStart + rowOffset;
      for (let col = 0; col < selectionColumnCount; col += 1) {
        const value = getCellValue(rowIndex, col);
        widths[col] = Math.max(widths[col], value.length * 8 + 24);
      }
    });
    const clamped = widths.map((width) => Math.min(Math.max(width, 80), 600));
    setColumnWidths(clamped);
  }, [selectionColumnCount, headers, rows, windowStart, getCellValue]);


  useEffect(() => {
    if (!autoFitColumns) return;
    computeAutoFit();
  }, [autoFitColumns, computeAutoFit]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const windowStartAdjustRef = useRef<number | null>(null);
  const pendingWindowRef = useRef<{
    start: number;
    path?: string;
    delimiter?: string;
    viewId?: number | null;
  } | null>(null);

  const windowLoadingRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const prefetchRef = useRef<{
    start: number;
    rows: string[][];
    eof: boolean;
    path?: string;
    delimiter?: string;
    viewId?: number | null;
    rowIndices?: number[] | null;
  } | null>(null);
  const prefetchUpRef = useRef<{
    start: number;
    rows: string[][];
    eof: boolean;
    path?: string;
    delimiter?: string;
    viewId?: number | null;
    rowIndices?: number[] | null;
  } | null>(null);
  const prefetchingRef = useRef(false);
  const prefetchTimerRef = useRef<number | null>(null);
  const suppressAutoLoadRef = useRef(false);
  const suppressAutoLoadTimerRef = useRef<number | null>(null);

  useEffect(() => {
    windowStartAdjustRef.current = null;
    suppressAutoLoadRef.current = false;
    if (suppressAutoLoadTimerRef.current !== null) {
      window.clearTimeout(suppressAutoLoadTimerRef.current);
      suppressAutoLoadTimerRef.current = null;
    }
  }, [preview?.path, activePath, fileMode]);

  // Track edits and update isDirty flag
  useEffect(() => {
    if (!activeTabId) return;

    const currentTab = tabs.find(t => t.id === activeTabId);
    if (!currentTab) return;

    const isDirty =
      currentTab.fileType === "csv"
        ? Object.keys(patches).length > 0 ||
          rowOps.length > 0 ||
          columnOps.length > 0 ||
          clearedRows.size > 0 ||
          clearedCols.size > 0
        : textDirty;

    if (currentTab.isDirty !== isDirty) {
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId ? { ...tab, isDirty } : tab
      ));
    }
  }, [activeTabId, tabs, patches, textDirty, rowOps, columnOps, clearedRows, clearedCols]);

  const indexPollRef = useRef<number | null>(null);
  const lastAutoRequestRef = useRef<number | null>(null);

  const resetWindowCaches = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingWindowRef.current = null;
    prefetchRef.current = null;
    prefetchUpRef.current = null;
    if (prefetchTimerRef.current !== null) {
      window.clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    prefetchingRef.current = false;
    requestIdRef.current += 1;
    lastAutoRequestRef.current = null;
    windowLoadingRef.current = false;
    setWindowLoading(false);
    suppressAutoLoadRef.current = false;
    if (suppressAutoLoadTimerRef.current !== null) {
      window.clearTimeout(suppressAutoLoadTimerRef.current);
      suppressAutoLoadTimerRef.current = null;
    }
  }, [setWindowLoading]);

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    paddingStart: virtualPaddingStart,
    paddingEnd: virtualPaddingEnd,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const rowIndex = getRowIndex(index);
      if (rowIndex === null) return rowHeight;
      return getRowHeight(rowIndex);
    },
    overscan: 8,
  });

  useEffect(() => {
    lastAutoRequestRef.current = null;
  }, [windowStart, rows.length]);

  useEffect(() => {
    const prev = windowStartAdjustRef.current;
    if (prev === null) {
      windowStartAdjustRef.current = windowStart;
      return;
    }
    const delta = windowStart - prev;
    if (delta !== 0 && parentRef.current) {
      suppressAutoLoadRef.current = true;
      parentRef.current.scrollTop += delta * rowHeight;
      // When total row count is unknown, keeping exact bottom anchoring can
      // continuously re-trigger "load next window" and cause runaway loading.
      if (delta > 0 && effectiveTotalRows === null) {
        const threshold = rowHeight * 6;
        const maxScrollTop = Math.max(
          parentRef.current.scrollHeight - parentRef.current.clientHeight,
          0,
        );
        const safeTop = Math.max(maxScrollTop - threshold - 1, 0);
        if (parentRef.current.scrollTop > safeTop) {
          parentRef.current.scrollTop = safeTop;
        }
      }
      if (suppressAutoLoadTimerRef.current !== null) {
        window.clearTimeout(suppressAutoLoadTimerRef.current);
      }
      suppressAutoLoadTimerRef.current = window.setTimeout(() => {
        suppressAutoLoadRef.current = false;
        suppressAutoLoadTimerRef.current = null;
      }, 120);
    }
    windowStartAdjustRef.current = windowStart;
  }, [windowStart, rowHeight, effectiveTotalRows]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowHeightOverrides, rowVirtualizer]);

  const inferType = useCallback(
    (values: string[]) => {
      if (!values.length) return t("Empty", "空");
      const isNumber = values.every((value) => {
        if (value.trim() === "") return false;
        return !Number.isNaN(Number(value));
      });
      if (isNumber) return t("Number", "数字");
      const isBoolean = values.every((value) => {
        const normalized = value.trim().toLowerCase();
        return ["true", "false", "0", "1"].includes(normalized);
      });
      if (isBoolean) return t("Boolean", "布尔");
      return t("Text", "文本");
    },
    [t],
  );

  const columnStats = useMemo(() => {
    if (!showStatsPanel) return [];
    if (!rows.length || dataColumnCount === 0) return [];
    return Array.from({ length: dataColumnCount }, (_, colIndex) => {
      const values = rows.map((_, rowIndex) => getCellValue(windowStart + rowIndex, colIndex));
      const nonEmptyValues = values.filter((value) => value !== "");
      return {
        name: headers[colIndex] ?? t(`Column ${colIndex + 1}`, `列 ${colIndex + 1}`),
        nonEmpty: nonEmptyValues.length,
        distinct: new Set(nonEmptyValues).size,
        inferred: inferType(nonEmptyValues),
      };
    });
  }, [showStatsPanel, rows, dataColumnCount, headers, getCellValue, inferType, t]);

  const applyColumnOpsToRow = useCallback((row: string[]) => {
    if (!columnOps.length) return row;
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
  }, [columnOps]);

  const applyColumnOpsToRows = useCallback(
    (sliceRows: string[][]) => {
      if (!columnOps.length) return sliceRows;
      return sliceRows.map((row) => applyColumnOpsToRow(row));
    },
    [applyColumnOpsToRow, columnOps.length],
  );

  const columnSelectOptions = useMemo(() => {
    const count = Math.max(displayColumnCount, 3);
    if (headers.length) {
      const base = headers.slice(0, count).map((name, idx) => ({
        value: String(idx),
        label: name ? `${idx}: ${name}` : t(`Column ${idx + 1}`, `列 ${idx + 1}`),
      }));
      if (!columnOrder.length) return base;
      return columnOrder
        .filter((idx) => idx >= 0 && idx < base.length)
        .map((idx) => base[idx]);
    }
    const base = new Array(count).fill(null).map((_, idx) => ({
      value: String(idx),
      label: t(`Column ${idx + 1}`, `列 ${idx + 1}`),
    }));
    if (!columnOrder.length) return base;
    return columnOrder
      .filter((idx) => idx >= 0 && idx < base.length)
      .map((idx) => base[idx]);
  }, [dataColumnCount, headers, t, columnOrder]);

  const moveColumnInOrder = useCallback((index: number, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const pos = current.indexOf(index);
      if (pos === -1) return current;
      const nextPos = pos + direction;
      if (nextPos < 0 || nextPos >= current.length) return current;
      const next = [...current];
      [next[pos], next[nextPos]] = [next[nextPos], next[pos]];
      return next;
    });
  }, []);

  const releaseGlobalView = useCallback(async (viewId: number | null) => {
    if (!viewId) return;
    try {
      await invoke("release_global_view", { viewId });
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
    setUndoStack([]);
    setRedoStack([]);
    setSortRules([]);
    setFilterRules([]);
    setClearedRows(new Set());
    setClearedCols(new Set());
    setHiddenCols(new Set());
    setColumnSearch("");
    setColumnOrder([]);
    resetOps();
    resetFileOps();
    clearSelection();
    setEditingCell(null);
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
  }, [clearSelection, releaseGlobalView, resetFileOps, resetOps, resetWindowCaches]);

  const startColumnResize = (index: number, clientX: number) => {
    const startWidth = columnWidths[index] ?? 140;
    resizeStateRef.current = { type: "col", index, startX: clientX, startWidth };
  };

  const startColumnResizeAll = (clientX: number) => {
    const startWidths = columnWidths.length
      ? [...columnWidths]
      : new Array(selectionColumnCount).fill(140);
    resizeStateRef.current = {
      type: "colAll",
      startX: clientX,
      startWidths,
      startRowHeaderWidth: rowHeaderWidth,
    };
  };

  const startRowHeaderResize = (clientX: number) => {
    resizeStateRef.current = { type: "row", startX: clientX, startWidth: rowHeaderWidth };
  };

  const startRowHeightResizeAll = (clientY: number) => {
    resizeStateRef.current = { type: "rowHeightAll", startY: clientY, startHeight: rowHeight };
  };

  const startHeaderRowHeightResize = (clientY: number) => {
    const startHeight = headerHeightOverride ?? rowHeight;
    resizeStateRef.current = { type: "headerRow", startY: clientY, startHeight };
  };

  const startRowHeightResizeRow = (rowIndex: number, clientY: number) => {
    const startHeight = rowHeightOverrides[rowIndex] ?? rowHeight;
    resizeStateRef.current = {
      type: "rowHeightRow",
      rowIndex,
      startY: clientY,
      startHeight,
    };
  };

  useEffect(() => {
    const handleMove = (event: globalThis.MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      if (state.type === "col") {
        const delta = event.clientX - state.startX;
        const nextWidth = Math.max(60, state.startWidth + delta);
        setColumnWidths((current) => {
          const next = [...current];
          next[state.index] = nextWidth;
          return next;
        });
      } else if (state.type === "colAll") {
        const delta = event.clientX - state.startX;
        setRowHeaderWidth(Math.max(36, state.startRowHeaderWidth + delta));
        setColumnWidths(state.startWidths.map((width) => Math.max(60, width + delta)));
      } else if (state.type === "row") {
        const delta = event.clientX - state.startX;
        const nextWidth = Math.max(36, state.startWidth + delta);
        setRowHeaderWidth(nextWidth);
      } else if (state.type === "headerRow") {
        const delta = event.clientY - state.startY;
        const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
        setHeaderHeightOverride(nextHeight);
      } else if (state.type === "rowHeightAll") {
        const delta = event.clientY - state.startY;
        const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
        setRowHeight(nextHeight);
        setRowHeightOverrides({});
        setHeaderHeightOverride(null);
      } else {
        const delta = event.clientY - state.startY;
        const nextHeight = Math.max(18, Math.min(300, state.startHeight + delta));
        setRowHeightOverrides((current) => ({
          ...current,
          [state.rowIndex]: nextHeight,
        }));
      }
    };

    const handleUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const clearIndexPoll = useCallback(() => {
    if (indexPollRef.current !== null) {
      window.clearInterval(indexPollRef.current);
      indexPollRef.current = null;
    }
  }, []);

  const cancelIndexBuild = useCallback(async () => {
    if (indexJobId === null) return;
    try {
      await invoke("cancel_prepare_csv_index", { jobId: indexJobId });
      setIndexCanceled(true);
      setIndexRunning(false);
    } catch (err) {
      setError(String(err));
    } finally {
      clearIndexPoll();
    }
  }, [indexJobId, clearIndexPoll]);

  const refreshTotalRows = useCallback(
    async (path: string, delimiterValue?: string) => {
      await cancelIndexBuild();
      setIndexProgress(0);
      setIndexCanceled(false);
      try {
        const response = await invoke<{
          job_id: number;
          done: boolean;
          total_rows?: number;
        }>("start_prepare_csv_index", {
          path,
          delimiter: delimiterValue ?? delimiter,
        });
        if (response.done) {
          setIndexRunning(false);
          setIndexJobId(null);
          setIndexProgress(1);
          if (response.total_rows !== undefined) {
            setTotalRows(response.total_rows);
          }
          return;
        }
        setIndexRunning(true);
        setIndexJobId(response.job_id);
      } catch (err) {
        setError(String(err));
        setTotalRows(null);
        setIndexRunning(false);
      }
    },
    [delimiter, cancelIndexBuild],
  );

  useEffect(() => {
    if (indexJobId === null || !indexRunning) {
      clearIndexPoll();
      return;
    }
    clearIndexPoll();
    indexPollRef.current = window.setInterval(async () => {
      try {
        const status = await invoke<{
          job_id: number;
          progress: number;
          done: boolean;
          canceled: boolean;
          total_rows?: number;
        }>("get_prepare_csv_index_status", { jobId: indexJobId });
        setIndexProgress(status.progress ?? 0);
        if (status.done) {
          setIndexRunning(false);
          setIndexCanceled(status.canceled);
          setIndexJobId(null);
          if (status.total_rows !== undefined) {
            setTotalRows(status.total_rows);
          }
          clearIndexPoll();
        }
      } catch (err) {
        setError(String(err));
        setIndexRunning(false);
        clearIndexPoll();
      }
    }, 350);

    return () => {
      clearIndexPoll();
    };
  }, [indexJobId, indexRunning, clearIndexPoll]);

  const estimateWindowSize = useCallback((sampleRows: string[][]) => {
    if (!sampleRows.length) return;
    const bytesPerRow =
      sampleRows.reduce((total, row) => {
        const rowBytes = row.reduce((sum, cell) => sum + cell.length * 2, 0);
        return total + rowBytes;
      }, 0) / sampleRows.length;
    if (!bytesPerRow || !Number.isFinite(bytesPerRow)) return;
    const safeBytes = MEMORY_BUDGET_BYTES * 0.6;
    const maxRows = Math.max(50, Math.floor(safeBytes / Math.max(bytesPerRow, 128)));
    const clamped = Math.min(Math.max(maxRows, 200), 20000);
    setWindowSize(clamped);
  }, []);

  const loadWindow = useCallback(
    async (start: number, pathOverride?: string, delimiterOverride?: string, reqId?: number) => {
      const path = pathOverride ?? preview?.path ?? activePath ?? undefined;
      if (!path && !globalViewIdRef.current) return;
      bumpDiagnostics((current) => ({
        ...current,
        loadCalls: current.loadCalls + 1,
        lastStart: start,
        lastAction: "load-window",
      }));

      const currentReqId = reqId ?? requestIdRef.current;
      if (currentReqId !== requestIdRef.current) return;

      const resolvedDelimiter =
        delimiterOverride ?? delimiterApplied ?? preview?.delimiter ?? delimiter;
      const viewId = globalViewIdRef.current;
      setWindowLoading(true);
      windowLoadingRef.current = true;
      if (
        prefetchRef.current &&
        (prefetchRef.current.viewId !== viewId ||
          prefetchRef.current.path !== path ||
          prefetchRef.current.delimiter !== resolvedDelimiter)
      ) {
        prefetchRef.current = null;
        prefetchUpRef.current = null;
      }
      try {
        const slice = viewId
          ? await invoke<{
              rows: string[][];
              start: number;
              end: number;
              eof: boolean;
              row_indices?: number[];
            }>("read_global_view_rows", {
              viewId,
              start,
              limit: windowSize,
            })
          : await invoke<{
              rows: string[][];
              start: number;
              end: number;
              eof: boolean;
              row_indices?: number[];
            }>("read_csv_rows_window", {
              path,
              delimiter: resolvedDelimiter,
              start,
              limit: windowSize,
            });

        // Race condition check: if a newer request started, ignore this result
        if (requestIdRef.current !== currentReqId) return;

        const normalizedRows = applyColumnOpsToRows(slice.rows);
        setRows(normalizedRows);
        setWindowStart(slice.start);
        setEof(slice.eof);
        bumpDiagnostics((current) => ({
          ...current,
          lastRows: normalizedRows.length,
          lastEof: slice.eof,
          lastStart: slice.start,
          lastAction: "load-success",
        }));
        setRowIndexMap(slice.row_indices ?? null);
        estimateWindowSize(normalizedRows);
        if (!slice.eof) {
          const nextStart = slice.start + slice.rows.length;
          schedulePrefetch(nextStart, path, resolvedDelimiter, "down", viewId);
        }
        if (slice.start > 0) {
          const prevStart = Math.max(slice.start - windowSize, 0);
          schedulePrefetch(prevStart, path, resolvedDelimiter, "up", viewId);
        }
      } catch (err) {
        if (requestIdRef.current === currentReqId) {
          setError(String(err));
          bumpDiagnostics((current) => ({
            ...current,
            lastAction: "load-error",
          }));
        }
      } finally {
        if (requestIdRef.current === currentReqId) {
          setWindowLoading(false);
          windowLoadingRef.current = false;
        }
      }
    },
    [
      preview,
      activePath,
      bumpDiagnostics,
      delimiterApplied,
      delimiter,
      windowSize,
      setRows,
      setEof,
      estimateWindowSize,
      applyColumnOpsToRows,
    ],
  );

  const prefetchWindow = useCallback(
    async (
      start: number,
      path: string | undefined,
      resolvedDelimiter: string,
      direction: "down" | "up",
      viewId?: number | null,
    ) => {
      if (prefetchingRef.current) return;
      if (effectiveTotalRows !== null && start >= effectiveTotalRows) return;
      if (!viewId && !path) return;
      prefetchingRef.current = true;
      try {
        const slice = viewId
          ? await invoke<{
              rows: string[][];
              start: number;
              end: number;
              eof: boolean;
              row_indices?: number[];
            }>("read_global_view_rows", {
              viewId,
              start,
              limit: windowSize,
            })
          : await invoke<{
              rows: string[][];
              start: number;
              end: number;
              eof: boolean;
              row_indices?: number[];
            }>("read_csv_rows_window", {
              path,
              delimiter: resolvedDelimiter,
              start,
              limit: windowSize,
            });
        const payload = {
          start: slice.start,
          rows: applyColumnOpsToRows(slice.rows),
          eof: slice.eof,
          path,
          delimiter: resolvedDelimiter,
          rowIndices: slice.row_indices ?? null,
          viewId: viewId ?? null,
        };
        if (direction === "down") {
          prefetchRef.current = payload;
        } else {
          prefetchUpRef.current = payload;
        }
      } finally {
        prefetchingRef.current = false;
      }
    },
    [effectiveTotalRows, windowSize, applyColumnOpsToRows],
  );

  const schedulePrefetch = useCallback(
    (
      start: number,
      path: string | undefined,
      resolvedDelimiter: string,
      direction: "down" | "up",
      viewId?: number | null,
    ) => {
      if (!PREFETCH_ENABLED) return;
      if (prefetchTimerRef.current !== null) {
        window.clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
      if (windowLoadingRef.current) {
        prefetchTimerRef.current = window.setTimeout(() => {
          prefetchTimerRef.current = null;
          if (!windowLoadingRef.current) {
            void prefetchWindow(start, path, resolvedDelimiter, direction, viewId);
          }
        }, 160);
        return;
      }
      void prefetchWindow(start, path, resolvedDelimiter, direction, viewId);
    },
    [prefetchWindow],
  );

  const requestWindow = useCallback(
    async (start: number, pathOverride?: string, delimiterOverride?: string) => {
      const path = pathOverride ?? preview?.path ?? activePath ?? undefined;
      if (!path && !globalViewIdRef.current) {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "request-skip-no-path",
        }));
        return;
      }
      bumpDiagnostics((current) => ({
        ...current,
        requestCalls: current.requestCalls + 1,
        lastStart: start,
        lastAction: "request-window",
      }));
      const resolvedDelimiter =
        delimiterOverride ?? delimiterApplied ?? preview?.delimiter ?? delimiter;
      const viewId = globalViewIdRef.current;
      const matchCache = (cache: typeof prefetchRef.current) =>
        cache &&
        cache.start === start &&
        cache.viewId === viewId &&
        cache.path === path &&
        cache.delimiter === resolvedDelimiter;

      if (matchCache(prefetchRef.current) || matchCache(prefetchUpRef.current)) {
        const cached = matchCache(prefetchRef.current)
          ? prefetchRef.current
          : prefetchUpRef.current;

        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
          pendingWindowRef.current = null;
        }

        prefetchRef.current = null;
        prefetchUpRef.current = null;
        if (!cached) return;

        // Invalidate current request
        requestIdRef.current += 1;
        setWindowLoading(false);
        windowLoadingRef.current = false;

        setRows(cached.rows);
        setWindowStart(cached.start);
        setEof(cached.eof);
        bumpDiagnostics((current) => ({
          ...current,
          cacheHits: current.cacheHits + 1,
          lastStart: cached.start,
          lastRows: cached.rows.length,
          lastEof: cached.eof,
          lastAction: "request-cache-hit",
        }));
        setRowIndexMap(cached.rowIndices ?? null);
        estimateWindowSize(cached.rows);
        if (!cached.eof) {
          const nextStart = cached.start + cached.rows.length;
          schedulePrefetch(nextStart, path, resolvedDelimiter, "down", viewId);
        }
        if (cached.start > 0) {
          const prevStart = Math.max(cached.start - windowSize, 0);
          schedulePrefetch(prevStart, path, resolvedDelimiter, "up", viewId);
        }
        return;
      }

      // If nothing is loaded yet, skip debounce and load immediately.
      if (!rows.length && !windowLoadingRef.current) {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "request-immediate",
        }));
        requestIdRef.current += 1;
        await loadWindow(start, path, resolvedDelimiter, requestIdRef.current);
        return;
      }

      // 2. Pend the request
      pendingWindowRef.current = { start, path, delimiter: resolvedDelimiter, viewId };

      // 3. Clear existing debounce
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      // 4. Define runner
      const fireRequest = async () => {
        if (windowLoadingRef.current) return;

        while (pendingWindowRef.current) {
          const next = pendingWindowRef.current;
          pendingWindowRef.current = null;

          requestIdRef.current += 1;
          await loadWindow(next.start, next.path, next.delimiter, requestIdRef.current);
        }
      };

      // 5. Set timer
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void fireRequest();
      }, 80);
    },
    [
      activePath,
      preview,
      delimiterApplied,
      delimiter,
      bumpDiagnostics,
      loadWindow,
      estimateWindowSize,
      prefetchWindow,
      windowSize,
      schedulePrefetch,
      rows.length,
    ],
  );

  const handleBodyScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (fileMode !== "csv") return;
      const target = event.currentTarget;
      const scrollTop = target.scrollTop;
      const viewHeight = target.clientHeight;
      const totalSize = rowVirtualizer.getTotalSize();
      bumpDiagnostics((current) => ({
        ...current,
        scrollEvents: current.scrollEvents + 1,
        lastScrollTop: scrollTop,
        lastTotalSize: totalSize,
        lastAction: "scroll",
      }));
      if (windowLoadingRef.current) {
        bumpDiagnostics((current) => ({
          ...current,
          blockedLoading: current.blockedLoading + 1,
          lastAction: "scroll-blocked-loading",
        }));
        return;
      }
      if (suppressAutoLoadRef.current) {
        bumpDiagnostics((current) => ({
          ...current,
          blockedSuppress: current.blockedSuppress + 1,
          lastAction: "scroll-blocked-suppress",
        }));
        return;
      }
      if (!rows.length) {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "scroll-no-rows",
        }));
        return;
      }
      if (!Number.isFinite(totalSize) || totalSize <= 0) return;
      const threshold = rowHeight * 6;

      if (scrollTop + viewHeight >= totalSize - threshold) {
        if (eof) {
          bumpDiagnostics((current) => ({
            ...current,
            blockedEof: current.blockedEof + 1,
            lastAction: "scroll-blocked-eof",
          }));
          return;
        }
        const nextStart = windowStart + rows.length;
        if (effectiveTotalRows === null || nextStart < effectiveTotalRows) {
          if (lastAutoRequestRef.current !== nextStart) {
            lastAutoRequestRef.current = nextStart;
            bumpDiagnostics((current) => ({
              ...current,
              autoDown: current.autoDown + 1,
              lastStart: nextStart,
              lastAction: "auto-down",
            }));
            void requestWindow(nextStart);
          } else {
            bumpDiagnostics((current) => ({
              ...current,
              blockedDuplicate: current.blockedDuplicate + 1,
              lastAction: "scroll-blocked-dup-down",
            }));
          }
        } else {
          bumpDiagnostics((current) => ({
            ...current,
            lastAction: "scroll-blocked-down-bound",
          }));
        }
      } else if (scrollTop <= threshold && windowStart > 0) {
        const prevStart = Math.max(windowStart - rows.length, 0);
        if (lastAutoRequestRef.current !== prevStart) {
          lastAutoRequestRef.current = prevStart;
          bumpDiagnostics((current) => ({
            ...current,
            autoUp: current.autoUp + 1,
            lastStart: prevStart,
            lastAction: "auto-up",
          }));
          void requestWindow(prevStart);
        } else {
          bumpDiagnostics((current) => ({
            ...current,
            blockedDuplicate: current.blockedDuplicate + 1,
            lastAction: "scroll-blocked-dup-up",
          }));
        }
      } else {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "scroll-middle",
        }));
      }
    },
    [
      bumpDiagnostics,
      effectiveTotalRows,
      fileMode,
      eof,
      requestWindow,
      rowHeight,
      rowVirtualizer,
      rows.length,
      windowStart,
    ],
  );

  const loadNextWindow = useCallback(async () => {
    if (eof) {
      bumpDiagnostics((current) => ({
        ...current,
        blockedEof: current.blockedEof + 1,
        lastAction: "load-next-blocked-eof",
      }));
      return;
    }
    const nextStart = windowStart + rows.length;
    if (effectiveTotalRows !== null && nextStart >= effectiveTotalRows) {
      bumpDiagnostics((current) => ({
        ...current,
        lastAction: "load-next-blocked-bound",
      }));
      return;
    }
    bumpDiagnostics((current) => ({
      ...current,
      autoDown: current.autoDown + 1,
      lastStart: nextStart,
      lastAction: "load-next",
    }));
    await requestWindow(nextStart);
  }, [windowStart, rows.length, effectiveTotalRows, requestWindow, eof, bumpDiagnostics]);

  useEffect(() => {
    const clearRebuildTimer = () => {
      if (globalViewRebuildTimerRef.current !== null) {
        window.clearTimeout(globalViewRebuildTimerRef.current);
        globalViewRebuildTimerRef.current = null;
      }
    };
    clearRebuildTimer();

    if (fileMode !== "csv") {
      globalViewBuildPendingRef.current = false;
      return;
    }
    if (!hasSortFilter) {
      globalViewBuildRef.current += 1;
      globalViewBuildPendingRef.current = false;
      globalViewBuildRunningRef.current = false;
      if (globalViewIdRef.current) {
        const prev = globalViewIdRef.current;
        globalViewIdRef.current = null;
        setGlobalViewTotal(null);
        setRowIndexMap(null);
        void releaseGlobalView(prev);
        resetWindowCaches();
        if (preview?.path) {
          void requestWindow(0, preview.path, delimiterApplied ?? delimiter);
        }
      }
      setGlobalViewLoading(false);
      return;
    }

    if (!preview?.path) return;

    globalViewBuildPendingRef.current = true;

    const scheduleBuild = (delay: number) => {
      if (globalViewRebuildTimerRef.current !== null) return;
      globalViewRebuildTimerRef.current = window.setTimeout(() => {
        globalViewRebuildTimerRef.current = null;
        if (!globalViewBuildPendingRef.current) return;
        if (globalViewBuildRunningRef.current) {
          scheduleBuild(120);
          return;
        }

        globalViewBuildPendingRef.current = false;
        const buildId = ++globalViewBuildRef.current;

        const build = async () => {
          const sortRulesParsed = sortRules.map((rule) => {
            const column = Number.parseInt(rule.column, 10);
            if (Number.isNaN(column) || column < 0) {
              throw new Error(
                t("Sort column must be a non-negative number.", "排序列必须是非负数字。"),
              );
            }
            return { column, direction: rule.direction };
          });

          const filterRulesParsed = filterRules.map((rule) => {
            const column = Number.parseInt(rule.column, 10);
            if (Number.isNaN(column) || column < 0) {
              throw new Error(
                t("Filter column must be a non-negative number.", "筛选列必须是非负数字。"),
              );
            }
            return { column, value: rule.value };
          });

          const patchList = Object.entries(patches).map(([key, value]) => {
            const [row, col] = key.split(":").map(Number);
            return { row, col, value };
          });

          const result = await invoke<{ view_id: number; total_rows: number }>(
            "build_global_view",
            {
              path: preview.path,
              delimiter: delimiterApplied ?? delimiter,
              sortRules: sortRulesParsed,
              filterRules: filterRulesParsed,
              patches: patchList,
              rowOps,
              columnOps,
              clearRows: Array.from(clearedRows),
              clearCols: Array.from(clearedCols),
              memoryLimitMb: sortFilterMemoryLimitMb,
            },
          );

          if (buildId !== globalViewBuildRef.current) return;

          const prev = globalViewIdRef.current;
          globalViewIdRef.current = result.view_id;
          setGlobalViewTotal(result.total_rows);
          resetWindowCaches();
          await requestWindow(0);
          if (prev && prev !== result.view_id) {
            void releaseGlobalView(prev);
          }
        };

        globalViewBuildRunningRef.current = true;
        setError(null);
        setGlobalViewLoading(true);
        build()
          .catch((err) => {
            if (buildId !== globalViewBuildRef.current) return;
            setError(String(err));
          })
          .finally(() => {
            globalViewBuildRunningRef.current = false;
            if (buildId === globalViewBuildRef.current) {
              setGlobalViewLoading(false);
            }
            if (globalViewBuildPendingRef.current) {
              scheduleBuild(120);
            }
          });
      }, delay);
    };

    scheduleBuild(GLOBAL_VIEW_REBUILD_DEBOUNCE_MS);
    return clearRebuildTimer;
  }, [
    fileMode,
    hasSortFilter,
    sortRules,
    filterRules,
    globalViewPatchTick,
    rowOps,
    columnOps,
    clearedRows,
    clearedCols,
    preview?.path,
    delimiterApplied,
    delimiter,
    sortFilterMemoryLimitMb,
    requestWindow,
    resetWindowCaches,
    releaseGlobalView,
    t,
  ]);

  // Tab data management helpers
  const saveCurrentTabData = useCallback((tabId: string, type: "csv" | "text") => {
    if (type === "csv") {
      const csvData: TabFileData["csvData"] = {
        rows: rows.slice(0, TAB_ROW_SNAPSHOT_LIMIT),
        headers,
        delimiter,
        delimiterApplied,
        windowStart,
        windowSize,
        eof,
        patches,
        undoStack,
        redoStack,
        columnWidths,
        rowHeaderWidth,
        rowHeight,
        headerHeightOverride,
    rowHeightOverrides,
    autoFitColumns,
    hiddenCols: Array.from(hiddenCols),
    totalRows,
        preview,
        activePath,
    rowOps,
    columnOps,
    clearedRows: Array.from(clearedRows),
    clearedCols: Array.from(clearedCols),
    columnOrder,
  };
      setTabDataMap((prev) => {
        const next = new Map(prev);
        next.set(tabId, { fileType: "csv", csvData });
        return next;
      });
    } else if (type === "text") {
      const textData: TabFileData["textData"] = {
        content: textContent,
        dirty: textDirty,
        path: textPath || "",
        encoding: textEncoding,
      };
      setTabDataMap((prev) => {
        const next = new Map(prev);
        next.set(tabId, { fileType: "text", textData });
        return next;
      });
    }
  }, [
    rows, headers, delimiter, delimiterApplied, windowStart, windowSize, eof,
    patches, undoStack, redoStack, columnWidths, rowHeaderWidth, rowHeight,
    headerHeightOverride, rowHeightOverrides, autoFitColumns, totalRowCount,
    preview, activePath, rowOps, columnOps, clearedRows, clearedCols, hiddenCols, columnOrder, textContent, textDirty, textPath, textEncoding,
  ]);

  const loadTabData = useCallback(async (tabId: string) => {
    const data = tabDataMap.get(tabId);
    if (!data) return;

    if (data.fileType === "csv" && data.csvData) {
      const csv = data.csvData;
      setFileMode("csv");
      setDelimiter(csv.delimiter);
      setPatches(csv.patches);
      setUndoStack(csv.undoStack);
      setRedoStack(csv.redoStack);
      setRowOps(csv.rowOps ?? []);
      setColumnOps(csv.columnOps ?? []);
      setClearedRows(new Set(csv.clearedRows ?? []));
      setClearedCols(new Set(csv.clearedCols ?? []));
      setHiddenCols(new Set(csv.hiddenCols ?? []));
      if (csv.columnOrder) {
        setColumnOrder(csv.columnOrder);
      }
      setColumnWidths(csv.columnWidths);
      setRowHeaderWidth(csv.rowHeaderWidth);
      // Enforce minimum row height of 28 to fix squashed rows regression
      setRowHeight(Math.max(csv.rowHeight, 28));
      setHeaderHeightOverride(csv.headerHeightOverride);
      setRowHeightOverrides(csv.rowHeightOverrides);
      setAutoFitColumns(csv.autoFitColumns);
      const loadedCount = csv.windowStart + (csv.rows?.length ?? 0);
      if (csv.totalRows !== null && csv.totalRows >= loadedCount) {
        setTotalRows(csv.totalRows);
      } else {
        setTotalRows(null);
      }
      resetWindowCaches();
      if (csv.activePath) {
        await closeSession();
        const delimiterToUse = csv.delimiterApplied ?? csv.delimiter;
        await openCsvPath(csv.activePath, delimiterToUse);
        setHeaders(csv.headers);
        setRows(csv.rows);
        setWindowStart(csv.windowStart);
        setWindowSize(csv.windowSize);
        setEof(csv.eof);
        await requestWindow(csv.windowStart, csv.activePath, delimiterToUse);
      }
    } else if (data.fileType === "text" && data.textData) {
      const txt = data.textData;
      setFileMode("text");
      setTextPath(txt.path || null);
      setTextContentState(txt.content);
      setTextDirty(txt.dirty);
      if (txt.encoding) {
        setTextEncoding(txt.encoding);
      }
    }
  }, [
    tabDataMap,
    setRows,
    setHeaders,
    setDelimiter,
    setEof,
    setTextContent,
    setTextPath,
    setTextContentState,
    setTextDirty,
    setRowOps,
    setColumnOps,
    closeSession,
    openCsvPath,
    requestWindow,
    resetWindowCaches,
  ]);

  const createTab = useCallback((path: string, fileType: "csv" | "text") => {
    const tabId = `${Date.now()}-${Math.random()}`;
    const fileName = getBaseName(path);
    const newTab: TabData = {
      id: tabId,
      path,
      fileName,
      isDirty: false,
      fileType,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(tabId);
    return tabId;
  }, []);

  const isTabDirty = useCallback(
    (tab: TabData | undefined) => {
      if (!tab) return false;
      if (tab.id === activeTabId) {
        return tab.fileType === "csv"
          ? Object.keys(patches).length > 0 || rowOps.length > 0 || columnOps.length > 0
          : textDirty;
      }
      const cached = tabDataMap.get(tab.id);
      if (!cached) return tab.isDirty;
      if (cached.fileType === "csv" && cached.csvData) {
        return (
          Object.keys(cached.csvData.patches).length > 0 ||
          cached.csvData.rowOps.length > 0 ||
          cached.csvData.columnOps.length > 0
        );
      }
      if (cached.fileType === "text" && cached.textData) {
        return cached.textData.dirty;
      }
      return tab.isDirty;
    },
    [activeTabId, columnOps, patches, rowOps, tabDataMap, textDirty],
  );

  const confirmDiscardForTab = useCallback(
    async (tab: TabData) => {
      const discard = await confirm(
        t(`Discard changes to ${tab.fileName}?`, `放弃对 ${tab.fileName} 的更改？`),
        { title: t("Unsaved changes", "未保存更改"), kind: "warning" },
      );
      return discard;
    },
    [t],
  );

  const saveTextAs = useCallback(async (): Promise<boolean> => {
    const defaultPath = textPath ?? "untitled.txt";
    const target = await saveDialog({
      defaultPath,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!target || Array.isArray(target)) return false;
    const saved = await saveTextTo(target);
    if (saved) {
      updateActiveTabPath(target);
    }
    return saved;
  }, [saveTextTo, textPath, updateActiveTabPath]);

  const saveAsCurrent = useCallback(async (): Promise<boolean> => {
    if (fileMode === "text") {
      return saveTextAs();
    }
    if (fileMode !== "csv") return false;
    const result = await saveAs();
    if (!result) return false;
    clearDraftForPath(preview?.path ?? null);
    clearDraftForPath(result.path);
    updateActiveTabPath(result.path);
    resetSessionState();
    await closeSession();
    const info = await openCsvPath(result.path, result.delimiter);
    if (!info) return false;
    setFileMode("csv");
    await requestWindow(0, info.path, info.delimiter);
    if (fileSizeBytes !== null && fileSizeBytes <= AUTO_INDEX_THRESHOLD_BYTES) {
      void refreshTotalRows(info.path, info.delimiter);
    }
    if (activeTabId) {
      saveCurrentTabData(activeTabId, "csv");
    }
    return true;
  }, [
    activeTabId,
    closeSession,
    fileMode,
    openCsvPath,
    refreshTotalRows,
    requestWindow,
    resetSessionState,
    saveAs,
    saveCurrentTabData,
    saveTextAs,
    updateActiveTabPath,
    clearDraftForPath,
    preview?.path,
  ]);

  const handleApplyDelimiter = async () => {
    if (fileMode !== "csv") return;
    const info = await applyDelimiter();
    if (!info) return;
    resetSessionState();
    await requestWindow(0, info.path, info.delimiter);
    if (fileSizeBytes !== null && fileSizeBytes <= AUTO_INDEX_THRESHOLD_BYTES) {
      void refreshTotalRows(info.path, info.delimiter);
    }
  };

  useEffect(() => {
    const pending = pendingInitialSaveRef.current;
    if (!pending) return;
    if (activeTabId !== pending.tabId) return;
    if (pending.type === "csv") {
      if (fileMode !== "csv" || loading) return;
      saveCurrentTabData(pending.tabId, "csv");
      pendingInitialSaveRef.current = null;
      return;
    }
    if (pending.type === "text") {
      if (fileMode !== "text" || textLoading) return;
      saveCurrentTabData(pending.tabId, "text");
      pendingInitialSaveRef.current = null;
    }
  }, [
    activeTabId,
    fileMode,
    loading,
    rows,
    headers,
    textContent,
    textEncoding,
    textLoading,
    textPath,
    saveCurrentTabData,
  ]);



  useEffect(() => {
    if (fileMode !== "csv" || !preview?.path) return;
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      const hasEdits =
        Object.keys(patches).length > 0 || clearedRows.size > 0 || clearedCols.size > 0;
      if (!hasEdits) {
        clearDraftForPath(preview.path);
        return;
      }
      try {
        const payload = JSON.stringify({
          patches,
          clearedRows: Array.from(clearedRows),
          clearedCols: Array.from(clearedCols),
          updatedAt: Date.now(),
        });
        window.localStorage.setItem(getDraftKey(preview.path), payload);
      } catch {
        // ignore storage failures (quota, serialization)
      }
    }, 1800);
    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [
    fileMode,
    preview?.path,
    patches,
    clearedRows,
    clearedCols,
    clearDraftForPath,
    getDraftKey,
  ]);

  const handleRunMacro = () => {
    if (macroScope === "file") {
      void runMacroOnFile();
      return;
    }
    runMacro();
  };

  const handleApplyFindReplace = () => {
    if (findScope === "file") {
      void runFindReplaceOnFile();
      return;
    }
    applyFindReplace();
  };

  const clearEdits = () => {
    setPatches({});
    setUndoStack([]);
    setRedoStack([]);
    resetOps();
    resetFileOps();
    setClearedRows(new Set());
    setClearedCols(new Set());
    setEditingCell(null);
    setError(null);
    if (preview?.path) {
      clearDraftForPath(preview.path);
    }
    if (hasSortFilter) {
      setGlobalViewPatchTick((current) => current + 1);
    }
  };

  const resolveRowTarget = (allowEnd: boolean) => {
    if (rowIndexInput.trim() !== "") {
      const parsed = Number.parseInt(rowIndexInput, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    const range = getActiveRange();
    if (range) {
      return Math.min(range.startRow, range.endRow);
    }
    return allowEnd ? rows.length : null;
  };

  const parseColumnIndex = (allowEnd: boolean) => {
    if (columnIndexInput.trim() === "") return null;
    const parsed = Number.parseInt(columnIndexInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    if (allowEnd && parsed > headers.length) return null;
    if (!allowEnd && parsed >= headers.length) return null;
    return parsed;
  };

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
      setError(t("Column index is invalid for rename.", "重命名时列索引无效。"));
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Column name is required for rename.", "重命名需要列名。"));
      return;
    }
    const prev = headers[index] ?? "";
    if (prev === trimmed) return;
    renameColumnAtIndex(index, trimmed);
    pushUndo({ kind: "col_rename", index, prev, next: trimmed });
  };

  const handleInsertRow = () => {
    const target = resolveRowTarget(true);
    if (target === null) {
      insertRow();
      return;
    }
    insertRowWithUndo(target);
  };

  const handleDeleteRow = () => {
    const target = resolveRowTarget(false);
    if (target === null) {
      deleteRow();
      return;
    }
    deleteRowWithUndo(target);
  };

  const handleInsertColumn = () => {
    const index = parseColumnIndex(true);
    if (index === null) {
      insertColumn();
      return;
    }
    insertColumnWithUndo(index, columnNameInput);
  };

  const handleDeleteColumn = () => {
    const index = parseColumnIndex(false);
    if (index === null) {
      deleteColumn();
      return;
    }
    deleteColumnWithUndo(index);
  };

  const handleRenameColumn = () => {
    const index = parseColumnIndex(false);
    if (index === null) {
      renameColumn();
      return;
    }
    renameColumnWithUndo(index, columnNameInput);
  };

  const handleRowHeaderContextMenu = (rowIndex: number, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (loading || globalViewLoading || hasSortFilter) return;
    setContextMenu({ type: "row", index: rowIndex, x: event.clientX, y: event.clientY });
  };

  const handleColumnHeaderContextMenu = (colIndex: number, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (loading || globalViewLoading || hasSortFilter) return;
    setContextMenu({ type: "col", index: colIndex, x: event.clientX, y: event.clientY });
  };

  const startHeaderEditing = (colIndex: number) => {
    if (loading || globalViewLoading || hasSortFilter) return;
    setEditingHeader({ index: colIndex, value: headers[colIndex] ?? "" });
  };

  const commitHeaderEditing = () => {
    if (!editingHeader) return;
    renameColumnWithUndo(editingHeader.index, editingHeader.value);
    setEditingHeader(null);
  };

  const cancelHeaderEditing = () => {
    setEditingHeader(null);
  };

  const runContextAction = async (action: string) => {
    if (!contextMenu) return;
    if (hasSortFilter) {
      setError(t("Disable sort/filter before editing rows/columns.", "编辑行列前请先关闭排序/筛选。"));
      setContextMenu(null);
      return;
    }
    if (contextMenu.type === "row") {
      const index = contextMenu.index;
      if (action === "insert_above") {
        insertRowWithUndo(index);
      }
      if (action === "insert_below") {
        insertRowWithUndo(index + 1);
      }
      if (action === "duplicate") {
        const values = new Array(dataColumnCount)
          .fill("")
          .map((_, col) => getCellValue(index, col));
        shiftClearedRowsOnInsert(index + 1);
        insertRowAtIndex(index + 1, values);
        setUndoStack((current) => [
          ...current,
          { kind: "row_duplicate", index: index + 1, values },
        ]);
        setRedoStack([]);
      }
      if (action === "clear") {
        const range = getActiveRange();
        const start = range ? Math.min(range.startRow, range.endRow) : index;
        const end = range ? Math.max(range.startRow, range.endRow) : index;
        const rowsToAdd: number[] = [];
        const removedPatches: PatchEntry[] = [];
        setClearedRows((current) => {
          const next = new Set(current);
          for (let row = start; row <= end; row += 1) {
            if (!next.has(row)) rowsToAdd.push(row);
            next.add(row);
          }
          return next;
        });
        setPatches((current) => {
          const next: Record<string, string> = {};
          Object.entries(current).forEach(([key, value]) => {
            const [row] = key.split(":").map(Number);
            if (row < start || row > end) {
              next[key] = value;
            } else {
              removedPatches.push({ key, value });
            }
          });
          return next;
        });
        if (rowsToAdd.length || removedPatches.length) {
          setUndoStack((current) => [
            ...current,
            { kind: "clear_rows", rows: rowsToAdd, patches: removedPatches },
          ]);
          setRedoStack([]);
        }
      }
      if (action === "delete") {
        deleteRowWithUndo(index);
      }
    }
    if (contextMenu.type === "col") {
      const index = contextMenu.index;
      if (action === "insert_left") {
        insertColumnWithUndo(index);
      }
      if (action === "insert_right") {
        insertColumnWithUndo(index + 1);
      }
      if (action === "duplicate") {
        shiftClearedColsOnInsert(index + 1);
        duplicateColumnAtIndex(index);
        setUndoStack((current) => [
          ...current,
          { kind: "col_duplicate", index },
        ]);
        setRedoStack([]);
      }
      if (action === "copy_name") {
        try {
          await navigator.clipboard.writeText(headers[index] ?? "");
        } catch (err) {
          setError(String(err));
        }
      }
      if (action === "clear") {
        const range = getActiveRange();
        const start = range ? Math.min(range.startCol, range.endCol) : index;
        const end = range ? Math.max(range.startCol, range.endCol) : index;
        const colsToAdd: number[] = [];
        const removedPatches: PatchEntry[] = [];
        setClearedCols((current) => {
          const next = new Set(current);
          for (let col = start; col <= end; col += 1) {
            if (!next.has(col)) colsToAdd.push(col);
            next.add(col);
          }
          return next;
        });
        setPatches((current) => {
          const next: Record<string, string> = {};
          Object.entries(current).forEach(([key, value]) => {
            const [, col] = key.split(":").map(Number);
            if (col < start || col > end) {
              next[key] = value;
            } else {
              removedPatches.push({ key, value });
            }
          });
          return next;
        });
        if (colsToAdd.length || removedPatches.length) {
          setUndoStack((current) => [
            ...current,
            { kind: "clear_cols", cols: colsToAdd, patches: removedPatches },
          ]);
          setRedoStack([]);
        }
      }
      if (action === "delete") {
        deleteColumnWithUndo(index);
      }
      if (action === "rename") startHeaderEditing(index);
    }
    setContextMenu(null);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    const handleMenuKey = (event: KeyboardEvent) => {
      if (!contextMenu) return;
      const key = event.key.toLowerCase();
      if (contextMenu.type === "row") {
        if (key === "a") { event.preventDefault(); runContextAction("insert_above"); }
        if (key === "b") { event.preventDefault(); runContextAction("insert_below"); }
        if (key === "d") { event.preventDefault(); runContextAction("duplicate"); }
        if (key === "c") { event.preventDefault(); runContextAction("clear"); }
        if (key === "x") { event.preventDefault(); runContextAction("delete"); }
      } else {
        if (key === "l") { event.preventDefault(); runContextAction("insert_left"); }
        if (key === "r") { event.preventDefault(); runContextAction("insert_right"); }
        if (key === "d") { event.preventDefault(); runContextAction("duplicate"); }
        if (key === "c") { event.preventDefault(); runContextAction("clear"); }
        if (key === "n") { event.preventDefault(); runContextAction("copy_name"); }
        if (key === "e") { event.preventDefault(); runContextAction("rename"); }
        if (key === "x") { event.preventDefault(); runContextAction("delete"); }
      }
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleMenuKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleMenuKey);
    };
  }, [contextMenu, runContextAction]);

  const saveCurrent = useCallback(async (): Promise<boolean> => {
    if (fileMode === "text") {
      if (textPath) {
        return saveTextTo(textPath);
      }
      return saveTextAs();
    }
    if (fileMode === "csv" && preview?.path) {
      const saved = await saveToPath(preview.path);
      if (!saved) return false;
      clearDraftForPath(preview.path);
      setPatches({});
      setUndoStack([]);
      setRedoStack([]);
      resetOps();
      resetFileOps();
      setClearedRows(new Set());
      setClearedCols(new Set());
      setEditingCell(null);
      await requestWindow(windowStart, preview.path, delimiterApplied ?? delimiter);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, isDirty: false } : tab,
        ),
      );
      if (activeTabId) {
        saveCurrentTabData(activeTabId, "csv");
      }
      return true;
    }
    return false;
  }, [
    activeTabId,
    delimiter,
    delimiterApplied,
    fileMode,
    preview?.path,
    requestWindow,
    resetFileOps,
    resetOps,
    saveCurrentTabData,
    saveTextAs,
    saveTextTo,
    saveToPath,
    clearDraftForPath,
    textPath,
    windowStart,
  ]);

  const confirmSaveOrDiscard = useCallback(
    async (tab: TabData) => {
      if (!isTabDirty(tab)) return true;
      if (tab.id !== activeTabId) {
        return confirmDiscardForTab(tab);
      }
      const saveChanges = await confirm(
        t(`Save changes to ${tab.fileName}?`, `保存对 ${tab.fileName} 的更改？`),
        { title: t("Unsaved changes", "未保存更改"), kind: "warning" },
      );
      if (saveChanges) {
        return saveCurrent();
      }
      return confirmDiscardForTab(tab);
    },
    [activeTabId, confirmDiscardForTab, isTabDirty, saveCurrent, t],
  );

  const handleTabClick = useCallback(async (tabId: string) => {
    if (tabId === activeTabId) return; // Already active

    // Save current tab's data before switching
    if (activeTabId) {
      const currentTab = tabs.find((tab) => tab.id === activeTabId);
      if (currentTab) {
        const ok = await confirmSaveOrDiscard(currentTab);
        if (!ok) return;
        saveCurrentTabData(activeTabId, currentTab.fileType);
      }
    }

    // Switch to new tab
    setActiveTabId(tabId);

    // Load new tab's data
    await loadTabData(tabId);
  }, [activeTabId, tabs, saveCurrentTabData, loadTabData, confirmSaveOrDiscard]);

  const handleTabClose = useCallback(async (tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (tab) {
      const ok = await confirmSaveOrDiscard(tab);
      if (!ok) return;
    }

    setTabs((prev) => {
      const filtered = prev.filter((item) => item.id !== tabId);
      if (activeTabId === tabId && filtered.length > 0) {
        const nextTab = filtered[filtered.length - 1];
        setActiveTabId(nextTab.id);
        void loadTabData(nextTab.id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
        setFileMode("none");
        // Clear editor state to prevent stale content
        setRows([]);
        setHeaders([]);
        setPatches({});
        setRowIndexMap(null);
        resetTextSession();
      }
      return filtered;
    });

    // Clean up tab data
    setTabDataMap((prev) => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });
  }, [
    activeTabId,
    loadTabData,
    resetTextSession,
    setHeaders,
    setPatches,
    setRows,
    tabs,
    confirmSaveOrDiscard,
  ]);

  const handleNewTab = useCallback(() => {
    void handleOpen();
  }, []);

  const openPath = useCallback(async (path: string) => {
    const isCsv = path.toLowerCase().endsWith(".csv");

    // Save current tab's data before opening new file
    if (activeTabId) {
      const currentTab = tabs.find((tab) => tab.id === activeTabId);
      if (currentTab) {
        saveCurrentTabData(activeTabId, currentTab.fileType);
      }
    }

    if (isCsv) {
      resetTextSession();
      await closeSession();
      const info = await openCsvPath(path);
      if (!info) return;
      setFileMode("csv");
      resetSessionState();
      const parsedSkip = Number.parseInt(importSkipRows, 10);
      const skipRows = Number.isNaN(parsedSkip) ? 0 : Math.max(0, parsedSkip);
      pendingImportRef.current = { skipRows, firstRowHeader: importFirstRowHeader };
      await requestWindow(skipRows, path, info.delimiter);
      try {
        const fileInfo = await stat(path);
        setFileSizeBytes(fileInfo.size ?? null);
        if ((fileInfo.size ?? 0) <= AUTO_INDEX_THRESHOLD_BYTES) {
          void refreshTotalRows(path, info.delimiter);
        }
      } catch {
        setFileSizeBytes(null);
      }
      const draft = loadDraftForPath(path);
      const hasDraft =
        draft &&
        ((draft.patches && Object.keys(draft.patches).length > 0) ||
          (draft.clearedRows && draft.clearedRows.length > 0) ||
          (draft.clearedCols && draft.clearedCols.length > 0));
      if (hasDraft) {
        const restore = await confirm(
          t(
            "Restore unsaved edits from the last session?",
            "是否恢复上次未保存的编辑？",
          ),
          { title: t("Draft detected", "检测到草稿"), kind: "warning" },
        );
        if (restore && draft) {
          setPatches(draft.patches ?? {});
          setClearedRows(new Set(draft.clearedRows ?? []));
          setClearedCols(new Set(draft.clearedCols ?? []));
          setUndoStack([]);
          setRedoStack([]);
        } else {
          clearDraftForPath(path);
        }
      }
      const tabId = createTab(path, "csv");
      pendingInitialSaveRef.current = { tabId, type: "csv" };
      addRecentFile(path);
      return;
    }

    resetSessionState();
    await closeSession();
    const opened = await openText(path);
    if (!opened) return;
    setFileMode("text");
    setFileSizeBytes(null);
    const tabId = createTab(path, "text");
    pendingInitialSaveRef.current = { tabId, type: "text" };
    addRecentFile(path);
  }, [
    activeTabId,
    addRecentFile,
    clearDraftForPath,
    closeSession,
    createTab,
    importFirstRowHeader,
    importSkipRows,
    loadDraftForPath,
    openCsvPath,
    openText,
    refreshTotalRows,
    requestWindow,
    resetSessionState,
    resetTextSession,
    saveCurrentTabData,
    setFileSizeBytes,
    setClearedCols,
    setClearedRows,
    setPatches,
    setRedoStack,
    setUndoStack,
    setFileMode,
    tabs,
    t,
  ]);

  const handleOpen = async () => {
    if (activeTabId) {
      const currentTab = tabs.find((tab) => tab.id === activeTabId);
      if (currentTab) {
        const ok = await confirmSaveOrDiscard(currentTab);
        if (!ok) return;
      }
    }
    if (openDialogActiveRef.current) return;
    openDialogActiveRef.current = true;
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: "CSV", extensions: ["csv"] },
          { name: "Text", extensions: ["txt", "log", "md"] },
        ],
      });

      if (!selected || Array.isArray(selected)) return;
      await openPath(selected);
    } finally {
      openDialogActiveRef.current = false;
    }
  };


  useEffect(() => {
    window.localStorage.setItem("nmeditor.locale", locale);
    void invoke("set_menu_locale", { locale });
  }, [locale]);

  const showAboutDialog = async () => {
    await message(t("nmeditor — Streamed CSV editor.", "nmeditor — 流式CSV编辑器。"), {
      title: t("About", "关于"),
      kind: "info",
    });
  };

  const menuHandlersRef = useRef({
    handleOpen,
    saveCurrent,
    saveAsCurrent,
    saveTextAs,
    runMacroOnFile,
    runFindReplaceOnFile,
    undo,
    redo,
    clearEdits,
    loadNextWindow,
    runFullStats,
    applyFindReplace,
    runMacro,
    setShowQuickbar,
    setShowFindBar,
    setShowMacroPanel,
    setShowOpsPanel,
    setShowExportPanel,
    setShowFindPanel,
    setShowStatsPanel,
    setError,
    locale,
    showAboutDialog,
    fileMode,
  });

  useEffect(() => {
    menuHandlersRef.current = {
      handleOpen,
      saveCurrent,
      saveAsCurrent,
      saveTextAs,
      runMacroOnFile,
      runFindReplaceOnFile,
      undo,
      redo,
      clearEdits,
      loadNextWindow,
      runFullStats,
      applyFindReplace,
      runMacro,
      setShowQuickbar,
      setShowFindBar,
      setShowMacroPanel,
      setShowOpsPanel,
      setShowExportPanel,
      setShowFindPanel,
      setShowStatsPanel,
      setError,
      locale,
      showAboutDialog,
      fileMode,
    };
  }, [
    handleOpen,
    saveCurrent,
    saveAsCurrent,
    saveTextAs,
    runMacroOnFile,
    runFindReplaceOnFile,
    undo,
    redo,
    clearEdits,
    loadNextWindow,
    runFullStats,
    applyFindReplace,
    runMacro,
    setShowQuickbar,
    setShowFindBar,
    setShowMacroPanel,
    setShowOpsPanel,
    setShowExportPanel,
    setShowFindPanel,
    setShowStatsPanel,
    setError,
    locale,
    showAboutDialog,
    fileMode,
  ]);

  const menuListenerRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (menuListenerRef.current) return;
    let disposed = false;
    const setup = async () => {
      const unlisten = await listen<string>("menu-event", (event) => {
        const handlers = menuHandlersRef.current;
        switch (event.payload) {
          case "file_open":
            void handlers.handleOpen();
            break;
          case "file_save_as":
            void handlers.saveAsCurrent();
            break;
          case "file_save":
            void handlers.saveCurrent();
            break;
          case "file_macro":
            if (handlers.fileMode === "csv") {
              void handlers.runMacroOnFile();
            }
            break;
          case "file_find_replace":
            if (handlers.fileMode === "csv") {
              void handlers.runFindReplaceOnFile();
            }
            break;
          case "edit_undo":
            if (handlers.fileMode === "csv") {
              handlers.undo();
            }
            break;
          case "edit_redo":
            if (handlers.fileMode === "csv") {
              handlers.redo();
            }
            break;
          case "edit_clear":
            if (handlers.fileMode === "csv") {
              handlers.clearEdits();
            }
            break;
          case "view_load_more":
            if (handlers.fileMode === "csv") {
              void handlers.loadNextWindow();
            }
            break;
          case "view_stats":
            if (handlers.fileMode === "csv") {
              void handlers.runFullStats();
            }
            break;
          case "view_toggle_quickbar":
            handlers.setShowQuickbar((current) => !current);
            break;
          case "view_toggle_findbar":
            handlers.setShowFindBar((current) => !current);
            break;
          case "view_toggle_macro":
            handlers.setShowMacroPanel((current) => !current);
            break;
          case "view_toggle_ops":
            handlers.setShowOpsPanel((current) => !current);
            break;
          case "view_toggle_export":
            handlers.setShowExportPanel((current) => !current);
            break;
          case "view_toggle_find_panel":
            handlers.setShowFindPanel((current) => !current);
            break;
          case "view_toggle_stats_panel":
            handlers.setShowStatsPanel((current) => !current);
            break;
          case "tools_find_loaded":
            if (handlers.fileMode === "csv") {
              handlers.applyFindReplace();
            }
            break;
          case "tools_macro_loaded":
            if (handlers.fileMode === "csv") {
              handlers.runMacro();
            }
            break;
          case "help_about":
            void handlers.showAboutDialog();
            break;
          default:
            break;
        }
      });

      if (disposed) {
        unlisten();
        return;
      }
      menuListenerRef.current = unlisten;
    };

    void setup();
    return () => {
      disposed = true;
      if (menuListenerRef.current) {
        menuListenerRef.current();
        menuListenerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="app-shell">
      {fileMode === "text" ? (
        <section className="surface">
          <div className="text-toolbar">
            <div className="text-meta">
              <span className="label">{t("Text file", "文本文件")}</span>
              <span className="value">{textPath ?? t("Select a file", "选择文件")}</span>
              {textDirty ? <span className="dirty">{t("(modified)", "(已修改)")}</span> : null}
            </div>
            <div className="text-actions">
              <label className="text-field">
                <span>{t("Encoding", "编码")}</span>
                <select
                  value={textEncoding}
                  onChange={(e) => setTextEncoding(e.target.value as "UTF-8" | "UTF-16LE")}
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="UTF-16LE">UTF-16 LE</option>
                </select>
              </label>
              <button onClick={saveCurrent} disabled={textLoading || (!textDirty && Boolean(textPath))}>
                {t("Save", "保存")}
              </button>
              <button onClick={saveTextAs} disabled={textLoading}>
                {t("Save As", "另存为")}
              </button>
            </div>
          </div>
          <textarea
            className="text-area"
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            placeholder={t("Open a text file to start editing", "打开文本文件开始编辑")}
            spellCheck={false}
          />
          {error ? <div className="banner error">{error}</div> : null}
        </section>
      ) : (
        <section className="surface">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
            t={t}
          />
          <div className="sticky-bars">
            {showFindBar ? (
              <FindBar
                findText={findText}
                replaceText={replaceText}
                useRegex={useRegex}
                matchCase={matchCase}
                onFindChange={setFindText}
                onReplaceChange={setReplaceText}
                onToggleRegex={setUseRegex}
                onToggleMatchCase={setMatchCase}
                onApply={applyFindReplace}
                onApplyFile={runFindReplaceOnFile}
                disabled={!preview || loading}
                t={t}
              />
            ) : null}
            {showQuickbar ? (
              <Quickbar
                locale={locale}
                delimiter={delimiter}
                delimiterApplied={delimiterApplied}
                delimiterPresets={delimiterPresets}
                loading={loading}
                hasPreview={Boolean(preview)}
                onLocaleChange={setLocale}
                onDelimiterChange={setDelimiter}
                onApplyDelimiter={handleApplyDelimiter}
                autoFitEnabled={autoFitColumns}
                onToggleAutoFit={setAutoFitColumns}
                onAutoFitNow={computeAutoFit}
                onUndo={undo}
                onRedo={redo}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                t={t}
              />
            ) : null}
          </div>
          <SurfaceHeader
            delimiter={delimiter}
            delimiterApplied={delimiterApplied}
            rowsLength={rows.length}
            previewDelimiter={preview?.delimiter}
            t={t}
          />
          {diagnosticsEnabled ? (
            <section className="diagnostic-panel">
              <div className="diagnostic-head">
                <strong>{t("Diagnostics", "诊断")}</strong>
                <span>{t("Toggle: Ctrl+Shift+D", "切换：Ctrl+Shift+D")}</span>
                <button onClick={resetDiagnostics}>{t("Reset", "重置")}</button>
                <button onClick={() => setDiagnosticsEnabled(false)}>{t("Close", "关闭")}</button>
              </div>
              <div className="diagnostic-metrics">
                <span>{t(`scroll ${diagnosticState.scrollEvents}`, `滚动 ${diagnosticState.scrollEvents}`)}</span>
                <span>{t(`auto-down ${diagnosticState.autoDown}`, `下翻自动加载 ${diagnosticState.autoDown}`)}</span>
                <span>{t(`auto-up ${diagnosticState.autoUp}`, `上翻自动加载 ${diagnosticState.autoUp}`)}</span>
                <span>{t(`request ${diagnosticState.requestCalls}`, `请求 ${diagnosticState.requestCalls}`)}</span>
                <span>{t(`load ${diagnosticState.loadCalls}`, `加载 ${diagnosticState.loadCalls}`)}</span>
                <span>{t(`cache-hit ${diagnosticState.cacheHits}`, `缓存命中 ${diagnosticState.cacheHits}`)}</span>
                <span>{t(`blocked-loading ${diagnosticState.blockedLoading}`, `被加载中拦截 ${diagnosticState.blockedLoading}`)}</span>
                <span>{t(`blocked-suppress ${diagnosticState.blockedSuppress}`, `被抑制拦截 ${diagnosticState.blockedSuppress}`)}</span>
                <span>{t(`blocked-eof ${diagnosticState.blockedEof}`, `被EOF拦截 ${diagnosticState.blockedEof}`)}</span>
                <span>{t(`blocked-dup ${diagnosticState.blockedDuplicate}`, `被重复请求拦截 ${diagnosticState.blockedDuplicate}`)}</span>
                <span>{t(`last-start ${diagnosticState.lastStart ?? "-"}`, `最后起始 ${diagnosticState.lastStart ?? "-"}`)}</span>
                <span>{t(`last-rows ${diagnosticState.lastRows}`, `最后行数 ${diagnosticState.lastRows}`)}</span>
                <span>{t(`last-eof ${diagnosticState.lastEof ? "true" : "false"}`, `最后EOF ${diagnosticState.lastEof ? "true" : "false"}`)}</span>
                <span>{t(`scrollTop ${Math.round(diagnosticState.lastScrollTop)}`, `滚动Top ${Math.round(diagnosticState.lastScrollTop)}`)}</span>
                <span>{t(`totalSize ${Math.round(diagnosticState.lastTotalSize)}`, `总高度 ${Math.round(diagnosticState.lastTotalSize)}`)}</span>
                <span>{t(`last-action ${diagnosticState.lastAction}`, `最后动作 ${diagnosticState.lastAction}`)}</span>
              </div>
            </section>
          ) : null}

          <div
            className={`workspace${showDrawer ? " with-drawer" : ""}`}
            style={showDrawer ? { gridTemplateColumns: `minmax(0, 1fr) ${sidebarWidth}px` } : undefined}
          >
            {showDrawer ? (
              <aside className="panel-drawer">
                <div className="panel-header">
                  <span>{t("Panels", "面板")}</span>
                  <button onClick={() => setDrawerCollapsed(true)}>
                    {t("Collapse", "收起")}
                  </button>
                </div>
                <div className="panel-resizer" onMouseDown={startSidebarResize} />
                <Panels
                  showMacroPanel={showMacroPanel}
                  showOpsPanel={showOpsPanel}
                  showExportPanel={showExportPanel}
                  showFindPanel={showFindPanel}
                  showStatsPanel={showStatsPanel}
                  macroOp={macroOp}
                  macroColumn={macroColumn}
                  macroFind={macroFind}
                  macroReplace={macroReplace}
                  macroText={macroText}
                  macroScope={macroScope}
                  macroOutputPath={macroOutputPath}
                  onMacroOpChange={setMacroOp}
                  onMacroColumnChange={setMacroColumn}
                  onMacroFindChange={setMacroFind}
                  onMacroReplaceChange={setMacroReplace}
                  onMacroTextChange={setMacroText}
                  onMacroScopeChange={setMacroScope}
                  onRunMacro={handleRunMacro}
                  rowIndexInput={rowIndexInput}
                  columnIndexInput={columnIndexInput}
                  columnNameInput={columnNameInput}
                  onRowIndexChange={setRowIndexInput}
                  onColumnIndexChange={setColumnIndexInput}
                  onColumnNameChange={setColumnNameInput}
                  onInsertRow={handleInsertRow}
                  onDeleteRow={handleDeleteRow}
            onCopySelection={copySelection}
                  onPasteSelection={pasteSelection}
                  pasteMode={pasteMode}
                  onPasteModeChange={setPasteMode}
                  columnSearch={columnSearch}
                  onColumnSearchChange={setColumnSearch}
                  hiddenCols={Array.from(hiddenCols)}
                  onToggleColumnHidden={handleToggleColumnHidden}
                  onShowAllColumns={handleShowAllColumns}
                  onHideAllColumns={handleHideAllColumns}
                  onMoveColumnUp={(index) => moveColumnInOrder(index, -1)}
                  onMoveColumnDown={(index) => moveColumnInOrder(index, 1)}
                  importSkipRows={importSkipRows}
                  onImportSkipRowsChange={setImportSkipRows}
                  importFirstRowHeader={importFirstRowHeader}
                  onImportFirstRowHeaderChange={setImportFirstRowHeader}
                  onInsertColumn={handleInsertColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onRenameColumn={handleRenameColumn}
                  sortColumnInput={sortColumnInput}
                  sortDirection={sortDirection}
                  filterColumnInput={filterColumnInput}
                  filterText={filterText}
                  onSortColumnChange={setSortColumnInput}
                  onSortDirectionChange={setSortDirection}
                  onFilterColumnChange={setFilterColumnInput}
                  onFilterTextChange={setFilterText}
                  onAddSortRule={addSortRule}
                  onAddFilterRule={addFilterRule}
                  onClearSortFilter={clearSortFilter}
                  sortRules={sortRules}
                  filterRules={filterRules}
                  onRemoveSortRule={removeSortRule}
                  onRemoveFilterRule={removeFilterRule}
                  encodingMode={encodingMode}
                  eolMode={eolMode}
                  includeBom={includeBom}
                  dialectDelimiter={dialectDelimiter}
                  dialectQuote={dialectQuote}
                  dialectEscape={dialectEscape}
                  onEncodingModeChange={setEncodingMode}
                  onEolModeChange={setEolMode}
                  onIncludeBomChange={setIncludeBom}
                  onDialectDelimiterChange={setDialectDelimiter}
                  onDialectQuoteChange={setDialectQuote}
                  onDialectEscapeChange={setDialectEscape}
                  findText={findText}
                  replaceText={replaceText}
                  findScope={findScope}
                  findColumnInput={findColumnInput}
                  findStartRow={findStartRow}
                  findEndRow={findEndRow}
                  useRegex={useRegex}
                  matchCase={matchCase}
                  findOutputPath={findOutputPath}
                  onFindTextChange={setFindText}
                  onReplaceTextChange={setReplaceText}
                  onFindScopeChange={setFindScope}
                  onFindColumnChange={setFindColumnInput}
                  onFindStartRowChange={setFindStartRow}
                  onFindEndRowChange={setFindEndRow}
                  onUseRegexChange={setUseRegex}
                  onMatchCaseChange={setMatchCase}
                  onApplyFindReplace={handleApplyFindReplace}
                  columnStats={columnStats}
                  fullStats={fullStats}
                  fullStatsLoading={fullStatsLoading}
                  onRunFullStats={runFullStats}
                  loading={loading || globalViewLoading}
                  sortFilterActive={hasSortFilter}
                  sortFilterMemoryLimitMb={sortFilterMemoryLimitMb}
                  sortFilterMemoryLimitText={sortFilterMemoryLimitText}
                  onSortFilterMemoryLimitTextChange={setSortFilterMemoryLimitText}
                  onSortFilterMemoryLimitCommit={(value) => setSortFilterMemoryLimitMb(value)}
                  columnSelectOptions={columnSelectOptions}
                  hasPreview={Boolean(preview)}
                  t={t}
                />
              </aside>
            ) : null}
            <div className="grid-area">
              {showPanels && drawerCollapsed ? (
                <div className="panel-collapsed">
                  <button onClick={() => setDrawerCollapsed(false)}>
                    {t("Show panels", "显示面板")}
                  </button>
                </div>
              ) : null}
              {error ? <div className="banner error">{error}</div> : null}
              {!preview && !loading ? (
                <div className="empty-state">
                  <div className="empty-card">
                    <h2>{t("Open a CSV or text file to begin", "打开 CSV 或文本文件开始")}</h2>
                    <p>
                      {t(
                        "You can drag and drop a file here or use the open button.",
                        "可以拖拽文件到此处，或点击打开按钮。",
                      )}
                    </p>
                    <button onClick={handleOpen}>{t("Open file", "打开文件")}</button>
                    {recentFiles.length ? (
                      <div className="recent-files">
                        <div className="recent-title">{t("Recent files", "最近文件")}</div>
                        <div className="recent-list">
                          {recentFiles.map((path) => (
                            <button key={path} onClick={() => void openPath(path)}>
                              {path}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <GridView
                  headers={gridHeaders}
                  columnCount={selectionColumnCount}
                  columnWidths={columnWidths}
                  rowHeaderWidth={rowHeaderWidth}
                  gridTemplateColumns={gridTemplateColumns}
                  isRowLoaded={isRowLoaded}
                  getRowIndex={getRowIndex}
                  onColumnResizeStart={startColumnResize}
                  onColumnResizeStartAll={startColumnResizeAll}
                  onRowHeaderResizeStart={startRowHeaderResize}
                  onRowHeightResizeStartAll={startRowHeightResizeAll}
                  onRowHeightResizeStartRow={startRowHeightResizeRow}
                  onHeaderRowHeightResizeStart={startHeaderRowHeightResize}
                  rowHeight={rowHeight}
                  headerHeight={headerHeightOverride ?? rowHeight}
                  getRowHeight={getRowHeight}
                  parentRef={parentRef}
                  rowVirtualizer={rowVirtualizer}
                  onBodyScroll={handleBodyScroll}
                  editingCell={editingCell}
                  patches={patches}
                  getCellValue={getCellValue}
                  startEditing={startEditing}
                  setEditingCell={setEditingCell}
                  commitEditing={commitEditing}
                  cancelEditing={cancelEditing}
                  onClearSelection={clearSelection}
                  isRowInSelection={isRowInSelection}
                  isColInSelection={isColInSelection}
                  isCellInSelection={isCellInSelection}
                  activeCell={selectionAnchor}
                  hiddenCols={hiddenCols}
                  updateSelection={updateSelection}
                  setIsDraggingSelection={setIsDraggingSelection}
                  isDraggingSelection={isDraggingSelection}
                  selectionMode={selectionMode}
                  onRowHeaderContextMenu={handleRowHeaderContextMenu}
                  onColumnHeaderContextMenu={handleColumnHeaderContextMenu}
                  editingHeader={editingHeader}
                  setEditingHeader={setEditingHeader}
                  commitHeaderEditing={commitHeaderEditing}
                  cancelHeaderEditing={cancelHeaderEditing}
                  onHeaderDoubleClick={startHeaderEditing}
                  t={t}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {fileMode === "text" ? (
        <footer className="status-bar">
          <span>
            {textLoading
              ? t("Loading text...", "加载文本中...")
              : textPath
                ? t("Text mode", "文本模式")
                : t("Waiting for file", "等待选择文件")}
          </span>
          <span>
            {textPath
              ? t(
                `Length ${textContent.length} · Lines ${textContent.split(/\r?\n/).length}`,
                `长度 ${textContent.length} · 行数 ${textContent.split(/\r?\n/).length}`,
              )
              : ""}
          </span>
        </footer>
      ) : (
        <StatusBar
        loading={loading}
        loadingRows={windowLoading}
        hasPreview={Boolean(preview)}
        eof={eof}
        rowsLength={rows.length}
          visibleCount={rows.length}
        patchCount={Object.keys(patches).length}
        macroAppliedCount={macroAppliedCount}
        findAppliedCount={findAppliedCount}
        opStatus={opStatus}
        indexing={indexRunning}
        indexProgress={indexProgress}
        indexCanceled={indexCanceled}
        globalViewLoading={globalViewLoading}
        canBuildIndex={
          fileMode === "csv" &&
          !indexRunning &&
          totalRows === null &&
          (fileSizeBytes === null || fileSizeBytes > AUTO_INDEX_THRESHOLD_BYTES)
        }
        onBuildIndex={() => {
          if (preview?.path) {
            void refreshTotalRows(preview.path, delimiterApplied ?? delimiter);
          }
        }}
        onCancelIndex={cancelIndexBuild}
        t={t}
      />
      )}

      {contextMenu ? (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          {contextMenu.type === "row" ? (
            <>
              <button onClick={() => runContextAction("insert_above")}>
                <span>{t("Insert row above", "在上方插入行")}</span>
                <span className="context-key">A</span>
              </button>
              <button onClick={() => runContextAction("insert_below")}>
                <span>{t("Insert row below", "在下方插入行")}</span>
                <span className="context-key">B</span>
              </button>
              <div className="context-menu-sep" />
              <button onClick={() => runContextAction("duplicate")}>
                <span>{t("Duplicate row", "复制行")}</span>
                <span className="context-key">D</span>
              </button>
              <button onClick={() => runContextAction("clear")}>
                <span>{t("Clear rows", "清空行")}</span>
                <span className="context-key">C</span>
              </button>
              <div className="context-menu-sep" />
              <button onClick={() => runContextAction("delete")}>
                <span>{t("Delete row", "删除行")}</span>
                <span className="context-key">X</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => runContextAction("insert_left")}>
                <span>{t("Insert column left", "在左侧插入列")}</span>
                <span className="context-key">L</span>
              </button>
              <button onClick={() => runContextAction("insert_right")}>
                <span>{t("Insert column right", "在右侧插入列")}</span>
                <span className="context-key">R</span>
              </button>
              <div className="context-menu-sep" />
              <button onClick={() => runContextAction("duplicate")}>
                <span>{t("Duplicate column", "复制列")}</span>
                <span className="context-key">D</span>
              </button>
              <button onClick={() => runContextAction("clear")}>
                <span>{t("Clear columns", "清空列")}</span>
                <span className="context-key">C</span>
              </button>
              <div className="context-menu-sep" />
              <button onClick={() => runContextAction("copy_name")}>
                <span>{t("Copy column name", "复制列名")}</span>
                <span className="context-key">N</span>
              </button>
              <button onClick={() => runContextAction("rename")}>
                <span>{t("Rename column", "重命名列")}</span>
                <span className="context-key">E</span>
              </button>
              <div className="context-menu-sep" />
              <button onClick={() => runContextAction("delete")}>
                <span>{t("Delete column", "删除列")}</span>
                <span className="context-key">X</span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default App;
