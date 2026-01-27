import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { message, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useVirtualizer } from "@tanstack/react-virtual";
import FindBar from "./components/FindBar";
import GridView from "./components/GridView";
import Panels from "./components/Panels";
import Quickbar from "./components/Quickbar";
import StatusBar from "./components/StatusBar";
import SurfaceHeader from "./components/SurfaceHeader";
import useRowColumnOps from "./hooks/useRowColumnOps";
import useCsvSession from "./hooks/useCsvSession";
import useFileOps from "./hooks/useFileOps";
import useSelection from "./hooks/useSelection";
import useTextSession from "./hooks/useTextSession";
import "./App.css";

type PatchOp = {
  key: string;
  prev: string | null;
  next: string | null;
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
  const [windowStart, setWindowStart] = useState(0);
  const [windowLoading, setWindowLoading] = useState(false);
  const [windowSize, setWindowSize] = useState(400);
  const [patches, setPatches] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<PatchOp[]>([]);
  const [redoStack, setRedoStack] = useState<PatchOp[]>([]);
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
  const [showQuickbar, setShowQuickbar] = useState(true);
  const [showFindBar, setShowFindBar] = useState(true);
  const [showMacroPanel, setShowMacroPanel] = useState(false);
  const [showOpsPanel, setShowOpsPanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
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

  const t = useCallback(
    (en: string, zh: string) => (locale === "zh" ? zh : en),
    [locale],
  );

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
    setTextContent,
    openText,
    saveTextTo,
    resetTextSession,
  } = useTextSession({ setError });

  const MEMORY_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;

  const dataColumnCount = useMemo(() => {
    const rowMax = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return Math.max(headers.length, rowMax);
  }, [headers.length, rows]);

  const selectionColumnCount = Math.max(dataColumnCount, 3);

  const {
    selectionMode,
    isDraggingSelection,
    setIsDraggingSelection,
    updateSelection,
    clearSelection,
    getActiveRange,
    isCellInSelection,
    isRowInSelection,
    isColInSelection,
  } = useSelection(rows.length, selectionColumnCount);

  const getCellValue = useCallback(
    (row: number, col: number) => {
      const key = `${row}:${col}`;
      if (Object.prototype.hasOwnProperty.call(patches, key)) {
        return patches[key];
      }
      const localRow = row - windowStart;
      if (localRow < 0 || localRow >= rows.length) return "";
      return rows[localRow]?.[col] ?? "";
    },
    [patches, rows, windowStart],
  );

  const applyPatchValue = useCallback((key: string, value: string | null) => {
    setPatches((current) => {
      const updated = { ...current };
      if (value === null) {
        delete updated[key];
      } else {
        updated[key] = value;
      }
      return updated;
    });
  }, []);

  const applyPatch = useCallback(
    (row: number, col: number, value: string) => {
      const localRow = row - windowStart;
      if (localRow < 0 || localRow >= rows.length) return;
      const key = `${row}:${col}`;
      const baseValue = rows[localRow]?.[col] ?? "";
      const hasPatch = Object.prototype.hasOwnProperty.call(patches, key);
      const currentValue = hasPatch ? patches[key] : baseValue;
      if (value === currentValue) return;

      const nextValue = value === baseValue ? null : value;
      applyPatchValue(key, nextValue);
      setUndoStack((current) => [
        ...current,
        { key, prev: hasPatch ? patches[key] : baseValue, next: nextValue },
      ]);
      setRedoStack([]);
    },
    [applyPatchValue, patches, rows, windowStart],
  );

  const startEditing = (row: number, col: number) => {
    setEditingCell({ row, col, value: getCellValue(row, col) });
  };

  const commitEditing = () => {
    if (!editingCell) return;
    applyPatch(editingCell.row, editingCell.col, editingCell.value);
    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
  };

  const undo = () => {
    setUndoStack((current) => {
      if (!current.length) return current;
      const last = current[current.length - 1];
      applyPatchValue(last.key, last.prev);
      setRedoStack((redo) => [...redo, last]);
      return current.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((current) => {
      if (!current.length) return current;
      const last = current[current.length - 1];
      applyPatchValue(last.key, last.next);
      setUndoStack((undoStackCurrent) => [...undoStackCurrent, last]);
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

  const {
    rowOps,
    columnOps,
    resetOps,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    renameColumn,
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

  const {
    macroOp,
    macroColumn,
    macroFind,
    macroReplace,
    macroText,
    macroAppliedCount,
    macroOutputPath,
    setMacroOp,
    setMacroColumn,
    setMacroFind,
    setMacroReplace,
    setMacroText,
    findText,
    replaceText,
    useRegex,
    matchCase,
    findColumnInput,
    findStartRow,
    findEndRow,
    findAppliedCount,
    findOutputPath,
    setFindText,
    setReplaceText,
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
    resetFileOps,
    runFullStats,
    runMacro,
    runMacroOnFile,
    applyFindReplace,
    runFindReplaceOnFile,
    saveAs,
  } = useFileOps({
    preview,
    headers,
    rows,
    patches,
    rowOps,
    columnOps,
    getCellValue,
    applyPatch,
    setError,
    setLoading,
    t,
  });

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

  const visibleRowIndices = useMemo(() => {
    const indices = rows.map((_, idx) => windowStart + idx);
    const filtered = indices.filter((rowIndex) =>
      filterRules.every((rule) => {
        const colIndex = Number.parseInt(rule.column, 10);
        if (Number.isNaN(colIndex)) return true;
        return getCellValue(rowIndex, colIndex).includes(rule.value);
      }),
    );

    if (!sortRules.length) return filtered;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      for (const rule of sortRules) {
        const colIndex = Number.parseInt(rule.column, 10);
        if (Number.isNaN(colIndex)) continue;
        const aValue = getCellValue(a, colIndex);
        const bValue = getCellValue(b, colIndex);
        const order = aValue.localeCompare(bValue, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (order !== 0) {
          return rule.direction === "asc" ? order : -order;
        }
      }
      return 0;
    });

    return sorted;
  }, [rows, filterRules, sortRules, getCellValue, windowStart]);

  const hasSortFilter = sortRules.length > 0 || filterRules.length > 0;

  const totalRowCount = hasSortFilter
    ? visibleRowIndices.length
    : totalRows ?? rows.length;

  const getRowIndex = useCallback(
    (virtualIndex: number) => {
      if (hasSortFilter) {
        return visibleRowIndices[virtualIndex] ?? null;
      }
      return virtualIndex;
    },
    [hasSortFilter, visibleRowIndices],
  );

  const isRowLoaded = useCallback(
    (rowIndex: number) => rowIndex >= windowStart && rowIndex < windowStart + rows.length,
    [rows.length, windowStart],
  );

  const gridTemplateColumns = useMemo(
    () => `48px repeat(${selectionColumnCount}, minmax(120px, 1fr))`,
    [selectionColumnCount],
  );

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: totalRowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 12,
    onChange: (instance) => {
      if (fileMode !== "csv" || hasSortFilter) return;
      if (windowLoading) return;
      const items = instance.getVirtualItems();
      if (!items.length) return;
      const first = items[0].index;
      const last = items[items.length - 1].index;
      const maxStart = Math.max(totalRowCount - windowSize, 0);

      if (last >= windowStart + rows.length - 20 && windowStart < maxStart) {
        const nextStart = Math.min(Math.max(last - Math.floor(windowSize * 0.7), 0), maxStart);
        if (nextStart !== windowStart) {
          void loadWindow(nextStart);
        }
      } else if (first <= windowStart + 20 && windowStart > 0) {
        const nextStart = Math.max(Math.min(first - Math.floor(windowSize * 0.3), maxStart), 0);
        if (nextStart !== windowStart) {
          void loadWindow(nextStart);
        }
      }
    },
  });

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
  }, [rows, dataColumnCount, headers, getCellValue, inferType, t]);

  const resetSessionState = useCallback(() => {
    setPatches({});
    setUndoStack([]);
    setRedoStack([]);
    setSortRules([]);
    setFilterRules([]);
    resetOps();
    resetFileOps();
    clearSelection();
    setEditingCell(null);
    setTotalRows(null);
    setWindowStart(0);
    setWindowSize(400);
  }, [clearSelection, resetFileOps, resetOps]);

  const refreshTotalRows = useCallback(
    async (path: string, delimiterValue?: string) => {
      try {
        const count = await invoke<number>("count_csv_rows", {
          path,
          delimiter: delimiterValue ?? delimiter,
        });
        setTotalRows(count);
      } catch (err) {
        setError(String(err));
        setTotalRows(null);
      }
    },
    [delimiter],
  );

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
    async (start: number, pathOverride?: string, delimiterOverride?: string) => {
      const path = pathOverride ?? preview?.path ?? activePath;
      if (!path) return;
      setWindowLoading(true);
      try {
        const slice = await invoke<{
          rows: string[][];
          start: number;
          end: number;
          eof: boolean;
        }>("read_csv_rows_window", {
          path,
          delimiter: delimiterOverride ?? delimiterApplied ?? preview?.delimiter ?? delimiter,
          start,
          limit: windowSize,
        });
        setRows(slice.rows);
        setWindowStart(slice.start);
        setEof(slice.eof);
        estimateWindowSize(slice.rows);
      } catch (err) {
        setError(String(err));
      } finally {
        setWindowLoading(false);
      }
    },
    [
      preview,
      activePath,
      delimiterApplied,
      delimiter,
      windowSize,
      setRows,
      setEof,
      estimateWindowSize,
    ],
  );

  const loadNextWindow = useCallback(async () => {
    const nextStart = windowStart + rows.length;
    if (totalRowCount !== null && nextStart >= totalRowCount) return;
    await loadWindow(nextStart);
  }, [windowStart, rows.length, totalRowCount, loadWindow]);

  const handleOpen = async () => {
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

      const path = selected;
      const isCsv = path.toLowerCase().endsWith(".csv");

      if (isCsv) {
        resetTextSession();
        await closeSession();
        const info = await openCsvPath(path);
        if (!info) return;
        setFileMode("csv");
        resetSessionState();
        await loadWindow(0, path, info.delimiter);
        void refreshTotalRows(path, info.delimiter);
        return;
      }

      resetSessionState();
      await closeSession();
      const opened = await openText(path);
      if (!opened) return;
      setFileMode("text");
    } finally {
      openDialogActiveRef.current = false;
    }
  };

  const handleApplyDelimiter = async () => {
    if (fileMode !== "csv") return;
    const info = await applyDelimiter();
    if (!info) return;
    resetSessionState();
    await loadWindow(0, info.path, info.delimiter);
    void refreshTotalRows(info.path, info.delimiter);
  };

  const clearEdits = () => {
    setPatches({});
    setUndoStack([]);
    setRedoStack([]);
    resetOps();
    resetFileOps();
    setEditingCell(null);
    setError(null);
  };

  const saveTextAs = async () => {
    const defaultPath = textPath ?? "untitled.txt";
    const target = await saveDialog({
      defaultPath,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!target || Array.isArray(target)) return;
    await saveTextTo(target);
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
    saveAs,
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
      saveAs,
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
    saveAs,
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
            if (handlers.fileMode === "text") {
              void handlers.saveTextAs();
            } else {
              void handlers.saveAs();
            }
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
                loadingRows={windowLoading}
                eof={eof}
                hasPreview={Boolean(preview)}
                onLocaleChange={setLocale}
                onDelimiterChange={setDelimiter}
                onApplyDelimiter={handleApplyDelimiter}
                onLoadMore={loadNextWindow}
                onUndo={undo}
                onRedo={redo}
                onFindReplaceLoaded={applyFindReplace}
                onMacroLoaded={runMacro}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                t={t}
              />
            ) : null}
          </div>
          <SurfaceHeader
            activePath={activePath}
            delimiter={delimiter}
            delimiterApplied={delimiterApplied}
            rowsLength={rows.length}
            previewDelimiter={preview?.delimiter}
            t={t}
          />

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
            macroOutputPath={macroOutputPath}
            onMacroOpChange={setMacroOp}
            onMacroColumnChange={setMacroColumn}
            onMacroFindChange={setMacroFind}
            onMacroReplaceChange={setMacroReplace}
            onMacroTextChange={setMacroText}
            onRunMacro={runMacro}
            onRunMacroOnFile={runMacroOnFile}
            rowIndexInput={rowIndexInput}
            columnIndexInput={columnIndexInput}
            columnNameInput={columnNameInput}
            onRowIndexChange={setRowIndexInput}
            onColumnIndexChange={setColumnIndexInput}
            onColumnNameChange={setColumnNameInput}
            onInsertRow={insertRow}
            onDeleteRow={deleteRow}
            onCopySelection={copySelection}
            onPasteSelection={pasteSelection}
            onInsertColumn={insertColumn}
            onDeleteColumn={deleteColumn}
            onRenameColumn={renameColumn}
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
            findColumnInput={findColumnInput}
            findStartRow={findStartRow}
            findEndRow={findEndRow}
            useRegex={useRegex}
            matchCase={matchCase}
            findOutputPath={findOutputPath}
            onFindTextChange={setFindText}
            onReplaceTextChange={setReplaceText}
            onFindColumnChange={setFindColumnInput}
            onFindStartRowChange={setFindStartRow}
            onFindEndRowChange={setFindEndRow}
            onUseRegexChange={setUseRegex}
            onMatchCaseChange={setMatchCase}
            onApplyFindReplace={applyFindReplace}
            onApplyFindReplaceOnFile={runFindReplaceOnFile}
            columnStats={columnStats}
            fullStats={fullStats}
            fullStatsLoading={fullStatsLoading}
            onRunFullStats={runFullStats}
            loading={loading}
            hasPreview={Boolean(preview)}
            t={t}
          />

          {error ? <div className="banner error">{error}</div> : null}

          <GridView
            headers={headers}
            gridTemplateColumns={gridTemplateColumns}
            isRowLoaded={isRowLoaded}
            getRowIndex={getRowIndex}
            parentRef={parentRef}
            rowVirtualizer={rowVirtualizer}
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
            updateSelection={updateSelection}
            setIsDraggingSelection={setIsDraggingSelection}
            isDraggingSelection={isDraggingSelection}
            selectionMode={selectionMode}
            t={t}
          />
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
          visibleCount={hasSortFilter ? visibleRowIndices.length : rows.length}
          patchCount={Object.keys(patches).length}
          macroAppliedCount={macroAppliedCount}
          findAppliedCount={findAppliedCount}
          t={t}
        />
      )}
    </div>
  );
}

export default App;
