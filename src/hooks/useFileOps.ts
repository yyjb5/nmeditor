import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import type { RowOp, ColumnOp } from "./useRowColumnOps";

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
  patches: Record<string, string>;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  getCellValue: (row: number, col: number) => string;
  applyPatch: (row: number, col: number, value: string) => void;
  setError: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  t: (en: string, zh: string) => string;
};

export default function useFileOps({
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
}: UseFileOpsParams) {
  const [macroOp, setMacroOp] = useState<MacroOp>("replace");
  const [macroColumn, setMacroColumn] = useState("0");
  const [macroFind, setMacroFind] = useState("");
  const [macroReplace, setMacroReplace] = useState("");
  const [macroText, setMacroText] = useState("");
  const [macroAppliedCount, setMacroAppliedCount] = useState(0);
  const [macroOutputPath, setMacroOutputPath] = useState<string | null>(null);
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
  const [fullStats, setFullStats] = useState<FullColumnStat[] | null>(null);
  const [fullStatsLoading, setFullStatsLoading] = useState(false);

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
      const result = await invoke<FullColumnStat[]>("compute_column_stats", {
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
    if (useRegex) {
      try {
        regex = new RegExp(findText, matchCase ? "g" : "gi");
      } catch (err) {
        setError(t(`Invalid regex: ${String(err)}`, `正则无效：${String(err)}`));
        return;
      }
    }

    setError(null);
    let applied = 0;

    for (let rowIndex = startRow; rowIndex <= lastRow && rowIndex < rows.length; rowIndex += 1) {
      const columns = columnIndex === null ? headers.map((_, idx) => idx) : [columnIndex];
      columns.forEach((col) => {
        if (col < 0 || col >= headers.length) return;
        const current = getCellValue(rowIndex, col);
        let next = current;
        if (useRegex && regex) {
          next = current.replace(regex, replaceText);
        } else if (matchCase) {
          next = current.split(findText).join(replaceText);
        } else {
          const pattern = new RegExp(findText.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "gi");
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
      setError(t("Find text is required.", "请输入查找内容。"));
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
      setError(t("Macro column must be a non-negative number.", "宏列必须是非负数字。"));
      return;
    }
    if (macroOp === "replace" && !macroFind) {
      setError(t("Find value is required for replace.", "替换操作需要查找内容。"));
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
      const patchList = Object.entries(patches).map(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        return { row, col, value };
      });

      await invoke("save_csv_with_patches", {
        path: preview.path,
        targetPath: target,
        delimiter: dialectDelimiter || preview.delimiter,
        patches: patchList,
        rowOps,
        columnOps,
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

  return {
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
  };
}
