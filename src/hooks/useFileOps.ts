import { useState } from "react";
import type { RowOp, ColumnOp } from "./useRowColumnOps";
import { invokeCmd, saveFileDialog } from "../tauriBridge";

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

type FullColumnStat = {
  name: string;
  non_empty: number;
  distinct: number;
  distinct_truncated: boolean;
  inferred: string;
};

type UseFileOpsParams = {
  preview: { path: string; delimiter: string } | null;
  headers: string[];
  rows: string[][];
  windowStart: number;
  patches: Record<string, string>;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  clearRows: number[];
  clearCols: number[];
  getCellValue: (row: number, col: number) => string;
  applyPatch: (row: number, col: number, value: string) => { key: string; prev: string | null; next: string | null } | undefined;
  pushUndo: (op: { kind: "bulk"; entries: Array<{ key: string; prev: string | null; next: string | null }> }) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  t: (en: string, zh: string) => string;
};

export default function useFileOps({
  preview,
  headers,
  rows,
  windowStart,
  patches,
  rowOps,
  columnOps,
  clearRows,
  clearCols,
  getCellValue,
  applyPatch,
  pushUndo,
  setError,
  setLoading,
  t,
}: UseFileOpsParams) {
  const [macroOp, setMacroOp] = useState<MacroOp>("replace");
  const [macroColumn, setMacroColumn] = useState("0");
  const [macroFind, setMacroFind] = useState("");
  const [macroReplace, setMacroReplace] = useState("");
  const [macroText, setMacroText] = useState("");
  const [macroScope, setMacroScope] = useState<"loaded" | "file">("loaded");
  const [macroAppliedCount, setMacroAppliedCount] = useState(0);
  const [macroOutputPath, setMacroOutputPath] = useState<string | null>(null);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findScope, setFindScope] = useState<"loaded" | "file">("loaded");
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
  const [fullStats, setFullStats] = useState<FullColumnStat[] | null>(null);
  const [fullStatsLoading, setFullStatsLoading] = useState(false);
  const [opStatus, setOpStatus] = useState<string | null>(null);

  const resetFileOps = () => {
    setMacroAppliedCount(0);
    setMacroOutputPath(null);
    setFindAppliedCount(0);
    setFindOutputPath(null);
    setFullStats(null);
  };

  const parseOptionalIndex = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  };

  const runFullStats = async () => {
    if (!preview) return;
    setError(null);
    setFullStatsLoading(true);
    try {
      const result = await invokeCmd<FullColumnStat[]>("compute_column_stats", {
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

  const runMacro = () => {
    const columnIndex = Number.parseInt(macroColumn, 10);
    if (Number.isNaN(columnIndex) || columnIndex < 0) {
      setError(t("Macro column must be a non-negative number.", "宏列必须是非负数字。"));
      return;
    }
    if (!rows.length) {
      setError(t("No rows loaded. Load rows before running a macro.", "没有加载行，请先加载数据。"));
      return;
    }
    if (macroOp === "replace" && !macroFind) {
      setError(t("Find value is required for replace.", "替换操作需要查找内容。"));
      return;
    }

    setError(null);
    setOpStatus(t("Running macro...", "正在运行宏..."));
    let applied = 0;
    const bulkEntries: Array<{ key: string; prev: string | null; next: string | null }> = [];

    rows.forEach((_, rowIdx) => {
      const targetRow = windowStart + rowIdx;
      const current = getCellValue(targetRow, columnIndex);
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
        const entry = applyPatch(targetRow, columnIndex, next);
        if (entry) {
          bulkEntries.push(entry);
          applied += 1;
        }
      }
    });

    setMacroAppliedCount(applied);
    if (bulkEntries.length) {
      pushUndo({ kind: "bulk", entries: bulkEntries });
    }
    setOpStatus(null);
  };

  const applyFindReplace = () => {
    if (!findText) {
      setError(t("Find text is required.", "请输入查找内容。"));
      return;
    }

    const columnIndex = parseOptionalIndex(findColumnInput);
    const startRow = parseOptionalIndex(findStartRow) ?? 0;
    const endRow = parseOptionalIndex(findEndRow);
    const lastRow = endRow ?? rows.length - 1;

    if (startRow < 0 || lastRow < startRow) {
      setError(t("Row range is invalid.", "行范围无效。"));
      return;
    }
    if (rows.length === 0) {
      setError(t("No rows loaded.", "没有加载行。"));
      return;
    }

    let regex: RegExp | null = null;
    let literalPattern: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(findText, matchCase ? "g" : "gi");
      } catch (err) {
        setError(t(`Invalid regex: ${String(err)}`, `正则无效：${String(err)}`));
        return;
      }
    } else if (!matchCase) {
      const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      literalPattern = new RegExp(escaped, "gi");
    }

    setError(null);
    setOpStatus(t("Applying find/replace...", "正在应用查找/替换..."));
    let applied = 0;
    const bulkEntries: Array<{ key: string; prev: string | null; next: string | null }> = [];

    for (let rowIndex = startRow; rowIndex <= lastRow && rowIndex < rows.length; rowIndex += 1) {
      const targetRow = windowStart + rowIndex;
      const columns = columnIndex === null ? headers.map((_, idx) => idx) : [columnIndex];
      columns.forEach((col) => {
        if (col < 0 || col >= headers.length) return;
        const current = getCellValue(targetRow, col);
        let next = current;
        if (useRegex && regex) {
          next = current.replace(regex, replaceText);
        } else if (matchCase) {
          next = current.split(findText).join(replaceText);
        } else if (literalPattern) {
          next = current.replace(literalPattern, replaceText);
        }
        if (next !== current) {
          const entry = applyPatch(targetRow, col, next);
          if (entry) {
            bulkEntries.push(entry);
            applied += 1;
          }
        }
      });
    }

    setFindAppliedCount(applied);
    if (bulkEntries.length) {
      pushUndo({ kind: "bulk", entries: bulkEntries });
    }
    setOpStatus(null);
  };

  const runFindReplaceOnFile = async () => {
    if (!preview) return;
    if (!findText) {
      setError(t("Find text is required.", "请输入查找内容。"));
      return;
    }
    const columnIndex = parseOptionalIndex(findColumnInput) ?? undefined;

    const target = await saveFileDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_findreplace.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!target || Array.isArray(target)) return;

    setError(null);
    setLoading(true);
    setOpStatus(t("Applying find/replace on file...", "正在应用查找/替换（全文件）..."));
    try {
      const spec: FindReplaceSpec = {
        find: findText,
        replace: replaceText,
        column: columnIndex,
        regex: useRegex,
        match_case: matchCase,
      };
      const result = await invokeCmd<FindReplaceResult>("apply_find_replace_to_file", {
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
      setOpStatus(null);
    }
  };

  const runMacroOnFile = async () => {
    if (!preview) return;
    const columnIndex = Number.parseInt(macroColumn, 10);
    if (Number.isNaN(columnIndex) || columnIndex < 0) {
      setError(t("Macro column must be a non-negative number.", "宏列必须是非负数字。"));
      return;
    }
    if (macroOp === "replace" && !macroFind) {
      setError(t("Find value is required for replace.", "替换操作需要查找内容。"));
      return;
    }

    const target = await saveFileDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_macro.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!target || Array.isArray(target)) return;

    setError(null);
    setLoading(true);
    setOpStatus(t("Running macro on file...", "正在运行宏（全文件）..."));
    try {
      const spec: CsvMacroSpec = {
        op: macroOp,
        column: columnIndex,
        find: macroFind || undefined,
        replace: macroReplace || undefined,
        text: macroText || undefined,
      };
      const result = await invokeCmd<CsvMacroResult>("apply_macro_to_file", {
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
      setOpStatus(null);
    }
  };

  const saveToPath = async (target: string): Promise<boolean> => {
    if (!preview) return false;
    setError(null);
    setLoading(true);
    setOpStatus(t("Saving file...", "正在保存文件..."));
    try {
      const patchList = Object.entries(patches).map(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        return { row, col, value };
      });

      await invokeCmd("save_csv_with_patches", {
        path: preview.path,
        targetPath: target,
        delimiter: dialectDelimiter || preview.delimiter,
        patches: patchList,
        rowOps,
        columnOps,
        clearRows,
        clearCols,
        eol: eolMode,
        bom: includeBom,
        encoding: encodingMode,
        quote: dialectQuote,
        escape: dialectEscape,
      });
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setLoading(false);
      setOpStatus(null);
    }
    return true;
  };

  const saveAs = async (): Promise<{ path: string; delimiter: string } | null> => {
    if (!preview) return null;
    const target = await saveFileDialog({
      defaultPath: preview.path.replace(/\.(csv|txt)$/i, "_edited.csv"),
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!target || Array.isArray(target)) return null;
    const saved = await saveToPath(target);
    if (!saved) return null;
    return { path: target, delimiter: dialectDelimiter || preview.delimiter };
  };

  return {
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
  };
}
