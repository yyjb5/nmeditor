import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useVirtualizer } from "@tanstack/react-virtual";
import "./App.css";

type CsvPreview = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  path: string;
};

type CsvSessionInfo = {
  session_id: number;
  headers: string[];
  delimiter: string;
  path: string;
};

type CsvSlice = {
  rows: string[][];
  start: number;
  end: number;
  eof: boolean;
};

type PatchOp = {
  key: string;
  prev: string | null;
  next: string | null;
};

type CsvPatch = {
  row: number;
  col: number;
  value: string;
};

type MacroOp = "replace" | "uppercase" | "lowercase" | "trim" | "prefix" | "suffix";

type CsvMacroSpec = {
  op: MacroOp;
  column: number;
  find?: string;
  replace?: string;
  text?: string;
};

type CsvMacroResult = {
  output_path: string;
  applied: number;
};

type ColumnStat = {
  name: string;
  non_empty: number;
  distinct: number;
  distinct_truncated: boolean;
  inferred: string;
};

type FindReplaceSpec = {
  find: string;
  replace: string;
  column?: number;
  regex: boolean;
  match_case: boolean;
};

type FindReplaceResult = {
  output_path: string;
  applied: number;
};

const delimiterPresets = [
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Tab (\\t)", value: "\t" },
  { label: "Pipe (|)", value: "|" },
];

function App() {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [eof, setEof] = useState(false);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delimiterApplied, setDelimiterApplied] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<PatchOp[]>([]);
  const [redoStack, setRedoStack] = useState<PatchOp[]>([]);
  const [macroOp, setMacroOp] = useState<MacroOp>("replace");
  const [macroColumn, setMacroColumn] = useState("0");
  const [macroFind, setMacroFind] = useState("");
  const [macroReplace, setMacroReplace] = useState("");
  const [macroText, setMacroText] = useState("");
  const [macroAppliedCount, setMacroAppliedCount] = useState(0);
  const [macroOutputPath, setMacroOutputPath] = useState<string | null>(null);
  const [columnIndexInput, setColumnIndexInput] = useState("0");
  const [columnNameInput, setColumnNameInput] = useState("");
  const [sortColumnInput, setSortColumnInput] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumnInput, setFilterColumnInput] = useState("");
  const [filterText, setFilterText] = useState("");
  const [sortRules, setSortRules] = useState<Array<{ column: string; direction: "asc" | "desc" }>>(
    [],
  );
  const [filterRules, setFilterRules] = useState<Array<{ column: string; value: string }>>(
    [],
  );
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [findColumnInput, setFindColumnInput] = useState("");
  const [findStartRow, setFindStartRow] = useState("");
  const [findEndRow, setFindEndRow] = useState("");
  const [findAppliedCount, setFindAppliedCount] = useState(0);
  const [findOutputPath, setFindOutputPath] = useState<string | null>(null);
  const [eolMode, setEolMode] = useState<"CRLF" | "LF">("CRLF");
  const [includeBom, setIncludeBom] = useState(false);
  const [encodingMode, setEncodingMode] = useState<"UTF-8" | "UTF-16LE">("UTF-8");
  const [dialectDelimiter, setDialectDelimiter] = useState(",");
  const [dialectQuote, setDialectQuote] = useState("\"");
  const [dialectEscape, setDialectEscape] = useState("\"");
  const [fullStats, setFullStats] = useState<ColumnStat[] | null>(null);
  const [fullStatsLoading, setFullStatsLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
    value: string;
  } | null>(null);
  const columnTemplate = useMemo(
    () => `repeat(${Math.max(headers.length, 3)}, minmax(120px, 1fr))`,
    [headers.length],
  );

  const parentRef = useRef<HTMLDivElement | null>(null);
  const getCellKey = (row: number, col: number) => `${row}:${col}`;
  const getCellValue = (row: number, col: number) => {
    const key = getCellKey(row, col);
    if (patches[key] !== undefined) {
      return patches[key];
    }
    return rows[row]?.[col] ?? "";
  };

  const visibleRowIndices = useMemo(() => {
    const indices = rows.map((_, index) => index);

    const filters = filterRules
      .map((rule) => ({
        column: Number.parseInt(rule.column, 10),
        value: rule.value.toLowerCase(),
      }))
      .filter((rule) => !Number.isNaN(rule.column) && rule.value);

    const filtered = filters.length
      ? indices.filter((rowIndex) =>
          filters.every((rule) =>
            getCellValue(rowIndex, rule.column).toLowerCase().includes(rule.value),
          ),
        )
      : indices;

    const sorts = sortRules
      .map((rule) => ({
        column: Number.parseInt(rule.column, 10),
        direction: rule.direction,
      }))
      .filter((rule) => !Number.isNaN(rule.column));

    if (!sorts.length) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      for (const rule of sorts) {
        const left = getCellValue(a, rule.column);
        const right = getCellValue(b, rule.column);
        const result = left.localeCompare(right, undefined, { numeric: true });
        if (result !== 0) {
          return rule.direction === "asc" ? result : -result;
        }
      }
      return 0;
    });
  }, [rows, patches, sortRules, filterRules]);

  const columnStats = useMemo(() => {
    if (!headers.length || !rows.length) return [];
    return headers.map((header, colIdx) => {
      let nonEmpty = 0;
      const distinct = new Set<string>();
      let numberCount = 0;
      let dateCount = 0;
      rows.forEach((_, rowIdx) => {
        const value = getCellValue(rowIdx, colIdx).trim();
        if (!value) return;
        nonEmpty += 1;
        distinct.add(value);
        if (!Number.isNaN(Number(value))) {
          numberCount += 1;
        } else if (!Number.isNaN(Date.parse(value))) {
          dateCount += 1;
        }
      });

      let inferred = "text";
      if (nonEmpty > 0 && numberCount === nonEmpty) {
        inferred = "number";
      } else if (nonEmpty > 0 && dateCount === nonEmpty) {
        inferred = "date";
      }

      return {
        name: header || `Column ${colIdx + 1}`,
        nonEmpty,
        distinct: distinct.size,
        inferred,
      };
    });
  }, [headers, rows, patches]);

  const runFullStats = async () => {
    if (!preview) return;
    setError(null);
    setFullStatsLoading(true);
    try {
      const result = await invoke<ColumnStat[]>("compute_column_stats", {
        path: preview.path,
        delimiter: preview.delimiter,
        maxDistinct: 5000,
      });
      setFullStats(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setFullStatsLoading(false);
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: visibleRowIndices.length || 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (sessionId && rows.length === 0 && !loadingRows && !eof) {
      void loadMore();
    }
  }, [sessionId, rows.length, loadingRows, eof]);

  useEffect(() => {
    if (!virtualItems.length || eof) return;
    const last = virtualItems[virtualItems.length - 1];
    if (last.index >= visibleRowIndices.length - 8) {
      void loadMore();
    }
  }, [virtualItems, visibleRowIndices.length, eof]);

  const handleOpen = async () => {
    setError(null);
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv", "txt"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    setLoading(true);
    try {
      if (sessionId) {
        await invoke("close_csv_session", { sessionId });
      }

      const info = await invoke<CsvSessionInfo>("open_csv_session", {
        path: selected,
        delimiter,
      });
      setSessionId(info.session_id);
      setHeaders(info.headers);
      setRows([]);
      setEof(false);
      setActivePath(info.path);
      setDelimiterApplied(info.delimiter);
      setPatches({});
      setUndoStack([]);
      setRedoStack([]);
      setEditingCell(null);
      setMacroAppliedCount(0);
      setMacroOutputPath(null);
      setPreview({
        headers: info.headers,
        rows: [],
        delimiter: info.delimiter,
        path: info.path,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!sessionId || loadingRows || eof) return;
    setLoadingRows(true);
    try {
      const slice = await invoke<CsvSlice>("read_csv_rows", {
        sessionId,
        limit: 200,
      });
      if (slice.rows.length) {
        setRows((prev) => [...prev, ...slice.rows]);
      }
      setEof(slice.eof);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingRows(false);
    }
  };

  const applyDelimiter = async () => {
    if (!activePath || loading) return;
    setError(null);
    setLoading(true);
    try {
      if (sessionId) {
        await invoke("close_csv_session", { sessionId });
      }

      const info = await invoke<CsvSessionInfo>("open_csv_session", {
        path: activePath,
        delimiter,
      });
      setSessionId(info.session_id);
      setHeaders(info.headers);
      setRows([]);
      setEof(false);
      setDelimiterApplied(info.delimiter);
      setPatches({});
      setUndoStack([]);
      setRedoStack([]);
      setEditingCell(null);
      setMacroAppliedCount(0);
      setMacroOutputPath(null);
      setPreview({
        headers: info.headers,
        rows: [],
        delimiter: info.delimiter,
        path: info.path,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const saveAs = async () => {
    if (!preview) return;
    const target = await saveDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_edited.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!target || Array.isArray(target)) return;

    setError(null);
    setLoading(true);
    try {
      const patchList: CsvPatch[] = Object.entries(patches).map(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        return { row, col, value };
      });

      await invoke("save_csv_with_patches", {
        path: preview.path,
        targetPath: target,
        delimiter: dialectDelimiter || preview.delimiter,
        patches: patchList,
        eol: eolMode,
        bom: includeBom,
        encoding: encodingMode,
        quote: dialectQuote,
        escape: dialectEscape,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const applyPatch = (row: number, col: number, value: string) => {
    const key = getCellKey(row, col);
    const original = rows[row]?.[col] ?? "";
    const prev = patches[key] ?? null;
    const next = value === original ? null : value;

    if (prev === next) return;

    setPatches((current) => {
      const updated = { ...current };
      if (next === null) {
        delete updated[key];
      } else {
        updated[key] = next;
      }
      return updated;
    });
    setUndoStack((stack) => [...stack, { key, prev, next }]);
    setRedoStack([]);
  };

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
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, last]);
    setPatches((current) => {
      const updated = { ...current };
      if (last.prev === null) {
        delete updated[last.key];
      } else {
        updated[last.key] = last.prev;
      }
      return updated;
    });
  };

  const redo = () => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, last]);
    setPatches((current) => {
      const updated = { ...current };
      if (last.next === null) {
        delete updated[last.key];
      } else {
        updated[last.key] = last.next;
      }
      return updated;
    });
  };

  const clearEdits = () => {
    setPatches({});
    setUndoStack([]);
    setRedoStack([]);
    setEditingCell(null);
    setMacroAppliedCount(0);
  };

  const parseColumnIndex = (value: string, allowEnd: boolean) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    if (allowEnd && parsed > headers.length) return null;
    if (!allowEnd && parsed >= headers.length) return null;
    return parsed;
  };

  const insertColumn = () => {
    const index = parseColumnIndex(columnIndexInput, true);
    if (index === null) {
      setError("Column index is invalid for insert.");
      return;
    }
    const name = columnNameInput.trim() || `Column ${headers.length + 1}`;
    setError(null);
    setHeaders((current) => {
      const next = [...current];
      next.splice(index, 0, name);
      return next;
    });
    setRows((current) =>
      current.map((row) => {
        const next = [...row];
        next.splice(index, 0, "");
        return next;
      }),
    );
    clearEdits();
  };

  const deleteColumn = () => {
    const index = parseColumnIndex(columnIndexInput, false);
    if (index === null) {
      setError("Column index is invalid for delete.");
      return;
    }
    setError(null);
    setHeaders((current) => current.filter((_, idx) => idx !== index));
    setRows((current) => current.map((row) => row.filter((_, idx) => idx !== index)));
    clearEdits();
  };

  const renameColumn = () => {
    const index = parseColumnIndex(columnIndexInput, false);
    if (index === null) {
      setError("Column index is invalid for rename.");
      return;
    }
    const name = columnNameInput.trim();
    if (!name) {
      setError("Column name is required for rename.");
      return;
    }
    setError(null);
    setHeaders((current) => current.map((value, idx) => (idx === index ? name : value)));
  };

  const clearSortFilter = () => {
    setSortColumnInput("");
    setFilterColumnInput("");
    setFilterText("");
    setSortRules([]);
    setFilterRules([]);
  };

  const addSortRule = () => {
    if (!sortColumnInput) return;
    setSortRules((current) => [...current, { column: sortColumnInput, direction: sortDirection }]);
  };

  const addFilterRule = () => {
    if (!filterColumnInput || !filterText) return;
    setFilterRules((current) => [...current, { column: filterColumnInput, value: filterText }]);
  };

  const removeSortRule = (index: number) => {
    setSortRules((current) => current.filter((_, idx) => idx !== index));
  };

  const removeFilterRule = (index: number) => {
    setFilterRules((current) => current.filter((_, idx) => idx !== index));
  };

  const runMacro = () => {
    const columnIndex = Number.parseInt(macroColumn, 10);
    if (Number.isNaN(columnIndex) || columnIndex < 0) {
      setError("Macro column must be a non-negative number.");
      return;
    }
    if (!rows.length) {
      setError("No rows loaded. Load rows before running a macro.");
      return;
    }
    if (macroOp === "replace" && !macroFind) {
      setError("Find value is required for replace.");
      return;
    }

    setError(null);
    let applied = 0;

    rows.forEach((_, rowIdx) => {
      const current = getCellValue(rowIdx, columnIndex);
      let next = current;
      switch (macroOp) {
        case "replace":
          next = current.split(macroFind).join(macroReplace);
          break;
        case "uppercase":
          next = current.toUpperCase();
          break;
        case "lowercase":
          next = current.toLowerCase();
          break;
        case "trim":
          next = current.trim();
          break;
        case "prefix":
          next = `${macroText}${current}`;
          break;
        case "suffix":
          next = `${current}${macroText}`;
          break;
        default:
          break;
      }

      if (next !== current) {
        applyPatch(rowIdx, columnIndex, next);
        applied += 1;
      }
    });

    setMacroAppliedCount(applied);
  };

  const parseOptionalIndex = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  };

  const applyFindReplace = () => {
    if (!findText) {
      setError("Find text is required.");
      return;
    }

    const columnIndex = parseOptionalIndex(findColumnInput);
    const startRow = parseOptionalIndex(findStartRow) ?? 0;
    const endRow = parseOptionalIndex(findEndRow);
    const lastRow = endRow ?? rows.length - 1;

    if (startRow < 0 || lastRow < startRow) {
      setError("Row range is invalid.");
      return;
    }
    if (rows.length === 0) {
      setError("No rows loaded.");
      return;
    }

    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(findText, matchCase ? "g" : "gi");
      } catch (err) {
        setError(`Invalid regex: ${String(err)}`);
        return;
      }
    }

    setError(null);
    let applied = 0;

    for (let rowIndex = startRow; rowIndex <= lastRow && rowIndex < rows.length; rowIndex += 1) {
      const columns = columnIndex === null
        ? headers.map((_, idx) => idx)
        : [columnIndex];
      columns.forEach((col) => {
        if (col < 0 || col >= headers.length) return;
        const current = getCellValue(rowIndex, col);
        let next = current;
        if (useRegex && regex) {
          next = current.replace(regex, replaceText);
        } else if (matchCase) {
          next = current.split(findText).join(replaceText);
        } else {
          const pattern = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          next = current.replace(pattern, replaceText);
        }
        if (next !== current) {
          applyPatch(rowIndex, col, next);
          applied += 1;
        }
      });
    }

    setFindAppliedCount(applied);
  };

  const runFindReplaceOnFile = async () => {
    if (!preview) return;
    if (!findText) {
      setError("Find text is required.");
      return;
    }
    const columnIndex = parseOptionalIndex(findColumnInput) ?? undefined;

    const target = await saveDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_findreplace.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!target || Array.isArray(target)) return;

    setError(null);
    setLoading(true);
    try {
      const spec: FindReplaceSpec = {
        find: findText,
        replace: replaceText,
        column: columnIndex,
        regex: useRegex,
        match_case: matchCase,
      };
      const result = await invoke<FindReplaceResult>("apply_find_replace_to_file", {
        path: preview.path,
        targetPath: target,
        delimiter: dialectDelimiter || preview.delimiter,
        spec,
        eol: eolMode,
        bom: includeBom,
        encoding: encodingMode,
        quote: dialectQuote,
        escape: dialectEscape,
      });
      setFindAppliedCount(result.applied);
      setFindOutputPath(result.output_path);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const runMacroOnFile = async () => {
    if (!preview) return;
    const columnIndex = Number.parseInt(macroColumn, 10);
    if (Number.isNaN(columnIndex) || columnIndex < 0) {
      setError("Macro column must be a non-negative number.");
      return;
    }
    if (macroOp === "replace" && !macroFind) {
      setError("Find value is required for replace.");
      return;
    }

    const target = await saveDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_macro.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!target || Array.isArray(target)) return;

    setError(null);
    setLoading(true);
    try {
      const spec: CsvMacroSpec = {
        op: macroOp,
        column: columnIndex,
        find: macroFind || undefined,
        replace: macroReplace || undefined,
        text: macroText || undefined,
      };
      const result = await invoke<CsvMacroResult>("apply_macro_to_file", {
        path: preview.path,
        targetPath: target,
        delimiter: dialectDelimiter || preview.delimiter,
        spec,
        eol: eolMode,
        bom: includeBom,
        encoding: encodingMode,
        quote: dialectQuote,
        escape: dialectEscape,
      });
      setMacroAppliedCount(result.applied);
      setMacroOutputPath(result.output_path);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <nav className="menu-bar">
        <div className="menu-group">File</div>
        <div className="menu-group">Edit</div>
        <div className="menu-group">View</div>
        <div className="menu-group">Tools</div>
        <div className="menu-group">Help</div>
      </nav>
      <header className="toolbar">
        <div className="brand">
          <span className="dot" />
          <div>
            <div className="title">DeskCSV</div>
            <div className="subtitle">Streamed CSV editor (preview mode)</div>
          </div>
        </div>
        <div className="controls">
          <label className="field">
            <span>Delimiter</span>
            <select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              disabled={loading}
            >
              {delimiterPresets.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={handleOpen} disabled={loading}>
            {loading ? "Loading..." : "Open CSV"}
          </button>
          <button
            onClick={applyDelimiter}
            disabled={loading || !activePath || delimiterApplied === delimiter}
          >
            Apply delimiter
          </button>
          <button onClick={loadMore} disabled={loading || loadingRows || !preview || eof}>
            {loadingRows ? "Loading rows..." : eof ? "All rows loaded" : "Load more"}
          </button>
          <button onClick={saveAs} disabled={loading || !preview || !Object.keys(patches).length}>
            Save As
          </button>
          <button onClick={undo} disabled={!undoStack.length}>
            Undo
          </button>
          <button onClick={redo} disabled={!redoStack.length}>
            Redo
          </button>
        </div>
      </header>

      <section className="surface">
        <div className="surface-header">
          <div className="file-meta">
            <span className="label">File</span>
            <span className="value">{activePath ?? "Select a file"}</span>
          </div>
          <div className="file-meta">
            <span className="label">Delimiter</span>
            <span className="value">
              {preview?.delimiter ?? delimiter}
              {delimiterApplied && delimiterApplied !== delimiter
                ? " (pending)"
                : ""}
            </span>
          </div>
          <div className="file-meta">
            <span className="label">Rows (preview)</span>
            <span className="value">{rows.length}</span>
          </div>
        </div>

        <div className="macro-panel">
          <div className="macro-title">Macro / Batch (loaded rows)</div>
          <div className="macro-row">
            <label className="field">
              <span>Operation</span>
              <select value={macroOp} onChange={(e) => setMacroOp(e.target.value as MacroOp)}>
                <option value="replace">Find & Replace</option>
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
                <option value="trim">Trim</option>
                <option value="prefix">Add Prefix</option>
                <option value="suffix">Add Suffix</option>
              </select>
            </label>
            <label className="field">
              <span>Column (0-based)</span>
              <input
                value={macroColumn}
                onChange={(e) => setMacroColumn(e.target.value)}
                placeholder="0"
              />
            </label>
            {macroOp === "replace" ? (
              <>
                <label className="field">
                  <span>Find</span>
                  <input
                    value={macroFind}
                    onChange={(e) => setMacroFind(e.target.value)}
                    placeholder="old"
                  />
                </label>
                <label className="field">
                  <span>Replace</span>
                  <input
                    value={macroReplace}
                    onChange={(e) => setMacroReplace(e.target.value)}
                    placeholder="new"
                  />
                </label>
              </>
            ) : macroOp === "prefix" || macroOp === "suffix" ? (
              <label className="field">
                <span>Text</span>
                <input
                  value={macroText}
                  onChange={(e) => setMacroText(e.target.value)}
                  placeholder="value"
                />
              </label>
            ) : null}
            <button onClick={runMacro} disabled={!preview || loading}>
              Run on loaded rows
            </button>
            <button onClick={runMacroOnFile} disabled={!preview || loading}>
              Run on full file
            </button>
          </div>
          {macroOutputPath ? (
            <div className="macro-output">Saved: {macroOutputPath}</div>
          ) : null}
        </div>

        <div className="ops-panel">
          <div className="macro-title">Column / Sort / Filter</div>
          <div className="macro-row">
            <label className="field">
              <span>Column index</span>
              <input
                value={columnIndexInput}
                onChange={(e) => setColumnIndexInput(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Column name</span>
              <input
                value={columnNameInput}
                onChange={(e) => setColumnNameInput(e.target.value)}
                placeholder="Name"
              />
            </label>
            <button onClick={insertColumn} disabled={!preview || loading}>
              Insert
            </button>
            <button onClick={deleteColumn} disabled={!preview || loading}>
              Delete
            </button>
            <button onClick={renameColumn} disabled={!preview || loading}>
              Rename
            </button>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>Sort column</span>
              <input
                value={sortColumnInput}
                onChange={(e) => setSortColumnInput(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Direction</span>
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <label className="field">
              <span>Filter column</span>
              <input
                value={filterColumnInput}
                onChange={(e) => setFilterColumnInput(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>Filter text</span>
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="contains..."
              />
            </label>
            <button onClick={addSortRule} disabled={!sortColumnInput}>
              Add sort
            </button>
            <button onClick={addFilterRule} disabled={!filterColumnInput || !filterText}>
              Add filter
            </button>
            <button onClick={clearSortFilter} disabled={!sortRules.length && !filterRules.length}>
              Clear
            </button>
          </div>
          {(sortRules.length || filterRules.length) ? (
            <div className="rules-list">
              {sortRules.map((rule, idx) => (
                <div key={`sort-${idx}`} className="rule-item">
                  <span>{`Sort col ${rule.column} (${rule.direction})`}</span>
                  <button onClick={() => removeSortRule(idx)}>×</button>
                </div>
              ))}
              {filterRules.map((rule, idx) => (
                <div key={`filter-${idx}`} className="rule-item">
                  <span>{`Filter col ${rule.column} contains "${rule.value}"`}</span>
                  <button onClick={() => removeFilterRule(idx)}>×</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="ops-panel">
          <div className="macro-title">Export Options</div>
          <div className="macro-row">
            <label className="field">
              <span>Encoding</span>
              <select
                value={encodingMode}
                onChange={(e) => setEncodingMode(e.target.value as "UTF-8" | "UTF-16LE")}
              >
                <option value="UTF-8">UTF-8</option>
                <option value="UTF-16LE">UTF-16 LE</option>
              </select>
            </label>
            <label className="field">
              <span>EOL</span>
              <select value={eolMode} onChange={(e) => setEolMode(e.target.value as "CRLF" | "LF")}>
                <option value="CRLF">Windows (CRLF)</option>
                <option value="LF">Unix (LF)</option>
              </select>
            </label>
            <label className="field checkbox">
              <span>UTF-8 BOM</span>
              <input
                type="checkbox"
                checked={includeBom}
                onChange={(e) => setIncludeBom(e.target.checked)}
              />
            </label>
            <label className="field">
              <span>Delimiter</span>
              <input
                value={dialectDelimiter}
                onChange={(e) => setDialectDelimiter(e.target.value)}
                placeholder="," 
              />
            </label>
            <label className="field">
              <span>Quote</span>
              <input
                value={dialectQuote}
                onChange={(e) => setDialectQuote(e.target.value)}
                placeholder={'"'}
              />
            </label>
            <label className="field">
              <span>Escape</span>
              <input
                value={dialectEscape}
                onChange={(e) => setDialectEscape(e.target.value)}
                placeholder={'"'}
              />
            </label>
          </div>
        </div>

        <div className="find-panel">
          <div className="macro-title">Find / Replace (loaded rows)</div>
          <div className="macro-row">
            <label className="field">
              <span>Find</span>
              <input value={findText} onChange={(e) => setFindText(e.target.value)} />
            </label>
            <label className="field">
              <span>Replace</span>
              <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
            </label>
            <label className="field">
              <span>Column (optional)</span>
              <input
                value={findColumnInput}
                onChange={(e) => setFindColumnInput(e.target.value)}
                placeholder="all"
              />
            </label>
            <label className="field">
              <span>Start row</span>
              <input
                value={findStartRow}
                onChange={(e) => setFindStartRow(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="field">
              <span>End row</span>
              <input
                value={findEndRow}
                onChange={(e) => setFindEndRow(e.target.value)}
                placeholder="last"
              />
            </label>
            <label className="field checkbox">
              <span>Regex</span>
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
            </label>
            <label className="field checkbox">
              <span>Match case</span>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
            </label>
            <button onClick={applyFindReplace} disabled={!preview || loading}>
              Apply find/replace
            </button>
            <button onClick={runFindReplaceOnFile} disabled={!preview || loading}>
              Apply on full file
            </button>
          </div>
          {findOutputPath ? (
            <div className="macro-output">Saved: {findOutputPath}</div>
          ) : null}
        </div>

        <div className="stats-panel">
          <div className="stats-header">
            <div className="macro-title">Column Stats</div>
            <button onClick={runFullStats} disabled={!preview || fullStatsLoading}>
              {fullStatsLoading ? "Computing..." : "Compute full file"}
            </button>
          </div>
          {columnStats.length ? (
            <>
              <div className="stats-subtitle">Loaded rows</div>
              <div className="stats-table">
                <div className="stats-row stats-header">
                  <div>Column</div>
                  <div>Non-empty</div>
                  <div>Distinct</div>
                  <div>Type</div>
                </div>
                {columnStats.map((stat, idx) => (
                  <div key={`${stat.name}-${idx}`} className="stats-row">
                    <div>{stat.name}</div>
                    <div>{stat.nonEmpty}</div>
                    <div>{stat.distinct}</div>
                    <div>{stat.inferred}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="stats-empty">Load rows to see column statistics.</div>
          )}
          {fullStats ? (
            <>
              <div className="stats-subtitle">Full file</div>
              <div className="stats-table">
                <div className="stats-row stats-header">
                  <div>Column</div>
                  <div>Non-empty</div>
                  <div>Distinct</div>
                  <div>Type</div>
                </div>
                {fullStats.map((stat, idx) => (
                  <div key={`${stat.name}-${idx}`} className="stats-row">
                    <div>{stat.name}</div>
                    <div>{stat.non_empty}</div>
                    <div>
                      {stat.distinct}
                      {stat.distinct_truncated ? "+" : ""}
                    </div>
                    <div>{stat.inferred}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        <div className="grid-shell">
          <div className="grid-header" style={{ gridTemplateColumns: columnTemplate }}>
            {(headers.length ? headers : ["Column 1", "Column 2", "Column 3"]).map(
              (col, idx) => (
                <div key={idx} className="cell header">
                  {col}
                </div>
              ),
            )}
          </div>

          <div className="grid-body" ref={parentRef}>
            <div
              style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowIndex = visibleRowIndices[virtualRow.index];
                if (rowIndex === undefined) {
                  return null;
                }
                return (
                  <div
                    key={virtualRow.key}
                    className="grid-row"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                      gridTemplateColumns: columnTemplate,
                    }}
                  >
                    {(headers.length ? headers : new Array(3).fill(""))
                      .map((_, colIdx) => {
                        const isEditing =
                          editingCell?.row === rowIndex &&
                          editingCell?.col === colIdx;
                        const key = getCellKey(rowIndex, colIdx);
                        const isPatched = patches[key] !== undefined;
                        return (
                          <div
                            key={colIdx}
                            className={`cell${isEditing ? " editing" : ""}${isPatched ? " edited" : ""}`}
                            onDoubleClick={() => startEditing(rowIndex, colIdx)}
                          >
                            {isEditing ? (
                              <input
                                value={editingCell?.value ?? ""}
                                onChange={(event) =>
                                  setEditingCell((current) =>
                                    current
                                      ? { ...current, value: event.target.value }
                                      : current,
                                  )
                                }
                                onBlur={commitEditing}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    commitEditing();
                                  }
                                  if (event.key === "Escape") {
                                    cancelEditing();
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              getCellValue(rowIndex, colIdx)
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <footer className="status-bar">
        <span>
          {loading
            ? "Opening file..."
            : loadingRows
              ? "Loading rows..."
              : preview
                ? eof
                  ? `Rows: ${rows.length} (EOF)`
                  : `Rows: ${rows.length}`
                : "Waiting for file"}
        </span>
        <span>
          {preview
            ? `Visible ${visibleRowIndices.length} · Edits ${Object.keys(patches).length} · Macro ${macroAppliedCount} · Find ${findAppliedCount}`
            : ""}
        </span>
      </footer>
    </div>
  );
}

export default App;
