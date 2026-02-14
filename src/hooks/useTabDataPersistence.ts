import { useCallback, type Dispatch, type SetStateAction } from "react";
import { TAB_ROW_SNAPSHOT_LIMIT } from "../constants";
import type { TabFileData, TextEncoding, UndoOp } from "../types";
import type { ColumnOp, RowOp } from "./useRowColumnOps";

type UseTabDataPersistenceParams = {
  tabDataMap: Map<string, TabFileData>;
  setTabDataMap: Dispatch<SetStateAction<Map<string, TabFileData>>>;
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
  hiddenCols: Set<number>;
  totalRows: number | null;
  preview: { path: string; delimiter: string } | null;
  activePath: string | null;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  columnOrder: number[];
  textContent: string;
  textDirty: boolean;
  textPath: string | null;
  textEncoding: TextEncoding;
  textReadOnlyPreview: boolean;
  textPreviewOffset: number;
  textPreviewHasPrev: boolean;
  textPreviewHasNext: boolean;
  textPreviewBytes: number | null;
  textTotalBytes: number | null;
  textPreviewReplaceOffset: number;
  textPreviewReplaceBytes: number;
  setFileMode: Dispatch<SetStateAction<"none" | "csv" | "text">>;
  setDelimiter: Dispatch<SetStateAction<string>>;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  setUndoStack: Dispatch<SetStateAction<UndoOp[]>>;
  setRedoStack: Dispatch<SetStateAction<UndoOp[]>>;
  setRowOps: Dispatch<SetStateAction<RowOp[]>>;
  setColumnOps: Dispatch<SetStateAction<ColumnOp[]>>;
  setClearedRows: Dispatch<SetStateAction<Set<number>>>;
  setClearedCols: Dispatch<SetStateAction<Set<number>>>;
  setHiddenCols: Dispatch<SetStateAction<Set<number>>>;
  setColumnOrder: Dispatch<SetStateAction<number[]>>;
  setColumnWidths: Dispatch<SetStateAction<number[]>>;
  setRowHeaderWidth: Dispatch<SetStateAction<number>>;
  setRowHeight: Dispatch<SetStateAction<number>>;
  setHeaderHeightOverride: Dispatch<SetStateAction<number | null>>;
  setRowHeightOverrides: Dispatch<SetStateAction<Record<number, number>>>;
  setAutoFitColumns: Dispatch<SetStateAction<boolean>>;
  setTotalRows: Dispatch<SetStateAction<number | null>>;
  setRows: Dispatch<SetStateAction<string[][]>>;
  setHeaders: Dispatch<SetStateAction<string[]>>;
  setWindowStart: Dispatch<SetStateAction<number>>;
  setWindowSize: Dispatch<SetStateAction<number>>;
  setEof: Dispatch<SetStateAction<boolean>>;
  closeSession: () => Promise<void>;
  openCsvPath: (path: string, delimiter?: string) => Promise<{ path: string; delimiter: string } | null>;
  requestWindow: (start: number, pathOverride?: string, delimiterOverride?: string) => Promise<void>;
  resetWindowCaches: () => void;
  setTextPath: Dispatch<SetStateAction<string | null>>;
  setTextContentState: Dispatch<SetStateAction<string>>;
  setTextDirty: Dispatch<SetStateAction<boolean>>;
  setTextEncoding: Dispatch<SetStateAction<TextEncoding>>;
  setTextReadOnlyPreview: Dispatch<SetStateAction<boolean>>;
  setTextPreviewOffset: Dispatch<SetStateAction<number>>;
  setTextPreviewHasPrev: Dispatch<SetStateAction<boolean>>;
  setTextPreviewHasNext: Dispatch<SetStateAction<boolean>>;
  setTextPreviewBytes: Dispatch<SetStateAction<number | null>>;
  setTextTotalBytes: Dispatch<SetStateAction<number | null>>;
  setTextPreviewReplaceOffset: Dispatch<SetStateAction<number>>;
  setTextPreviewReplaceBytes: Dispatch<SetStateAction<number>>;
};

export default function useTabDataPersistence({
  tabDataMap,
  setTabDataMap,
  rows,
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
  hiddenCols,
  totalRows,
  preview,
  activePath,
  rowOps,
  columnOps,
  clearedRows,
  clearedCols,
  columnOrder,
  textContent,
  textDirty,
  textPath,
  textEncoding,
  textReadOnlyPreview,
  textPreviewOffset,
  textPreviewHasPrev,
  textPreviewHasNext,
  textPreviewBytes,
  textTotalBytes,
  textPreviewReplaceOffset,
  textPreviewReplaceBytes,
  setFileMode,
  setDelimiter,
  setPatches,
  setUndoStack,
  setRedoStack,
  setRowOps,
  setColumnOps,
  setClearedRows,
  setClearedCols,
  setHiddenCols,
  setColumnOrder,
  setColumnWidths,
  setRowHeaderWidth,
  setRowHeight,
  setHeaderHeightOverride,
  setRowHeightOverrides,
  setAutoFitColumns,
  setTotalRows,
  setRows,
  setHeaders,
  setWindowStart,
  setWindowSize,
  setEof,
  closeSession,
  openCsvPath,
  requestWindow,
  resetWindowCaches,
  setTextPath,
  setTextContentState,
  setTextDirty,
  setTextEncoding,
  setTextReadOnlyPreview,
  setTextPreviewOffset,
  setTextPreviewHasPrev,
  setTextPreviewHasNext,
  setTextPreviewBytes,
  setTextTotalBytes,
  setTextPreviewReplaceOffset,
  setTextPreviewReplaceBytes,
}: UseTabDataPersistenceParams) {
  const saveCurrentTabData = useCallback(
    (tabId: string, type: "csv" | "text") => {
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
        return;
      }

      const textData: TabFileData["textData"] = {
        content: textContent,
        dirty: textDirty,
        path: textPath || "",
        encoding: textEncoding,
        readOnlyPreview: textReadOnlyPreview,
        previewOffset: textPreviewOffset,
        previewHasPrev: textPreviewHasPrev,
        previewHasNext: textPreviewHasNext,
        previewBytes: textPreviewBytes,
        totalBytes: textTotalBytes,
        previewReplaceOffset: textPreviewReplaceOffset,
        previewReplaceBytes: textPreviewReplaceBytes,
      };
      setTabDataMap((prev) => {
        const next = new Map(prev);
        next.set(tabId, { fileType: "text", textData });
        return next;
      });
    },
    [
      activePath,
      autoFitColumns,
      clearedCols,
      clearedRows,
      columnOps,
      columnOrder,
      columnWidths,
      delimiter,
      delimiterApplied,
      eof,
      headerHeightOverride,
      headers,
      hiddenCols,
      patches,
      preview,
      redoStack,
      rowHeaderWidth,
      rowHeight,
      rowHeightOverrides,
      rowOps,
      rows,
      setTabDataMap,
      textContent,
      textDirty,
      textEncoding,
      textPath,
      textPreviewBytes,
      textPreviewHasNext,
      textPreviewHasPrev,
      textPreviewOffset,
      textPreviewReplaceBytes,
      textPreviewReplaceOffset,
      textReadOnlyPreview,
      textTotalBytes,
      totalRows,
      undoStack,
      windowSize,
      windowStart,
    ],
  );

  const loadTabData = useCallback(
    async (tabId: string) => {
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
        return;
      }

      if (data.fileType === "text" && data.textData) {
        const txt = data.textData;
        setFileMode("text");
        setTextPath(txt.path || null);
        setTextContentState(txt.content);
        setTextDirty(txt.dirty);
        if (txt.encoding) {
          setTextEncoding(txt.encoding);
        }
        setTextReadOnlyPreview(Boolean(txt.readOnlyPreview));
        setTextPreviewOffset(typeof txt.previewOffset === "number" ? txt.previewOffset : 0);
        setTextPreviewHasPrev(Boolean(txt.previewHasPrev));
        setTextPreviewHasNext(Boolean(txt.previewHasNext));
        setTextPreviewBytes(typeof txt.previewBytes === "number" ? txt.previewBytes : null);
        setTextTotalBytes(typeof txt.totalBytes === "number" ? txt.totalBytes : null);
        setTextPreviewReplaceOffset(
          typeof txt.previewReplaceOffset === "number" ? txt.previewReplaceOffset : 0,
        );
        setTextPreviewReplaceBytes(
          typeof txt.previewReplaceBytes === "number" ? txt.previewReplaceBytes : 0,
        );
      }
    },
    [
      closeSession,
      openCsvPath,
      requestWindow,
      resetWindowCaches,
      setAutoFitColumns,
      setClearedCols,
      setClearedRows,
      setColumnOps,
      setColumnOrder,
      setColumnWidths,
      setDelimiter,
      setEof,
      setFileMode,
      setHeaderHeightOverride,
      setHeaders,
      setHiddenCols,
      setPatches,
      setRedoStack,
      setRowHeaderWidth,
      setRowHeight,
      setRowHeightOverrides,
      setRowOps,
      setRows,
      setTextContentState,
      setTextDirty,
      setTextEncoding,
      setTextPath,
      setTextPreviewBytes,
      setTextPreviewHasNext,
      setTextPreviewHasPrev,
      setTextPreviewOffset,
      setTextPreviewReplaceBytes,
      setTextPreviewReplaceOffset,
      setTextReadOnlyPreview,
      setTextTotalBytes,
      setTotalRows,
      setUndoStack,
      setWindowSize,
      setWindowStart,
      tabDataMap,
    ],
  );

  return {
    saveCurrentTabData,
    loadTabData,
  };
}
