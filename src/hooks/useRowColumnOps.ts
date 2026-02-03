import { useCallback, useState } from "react";
import type { SelectionRange } from "./useSelection";

export type RowOp =
  | { type: "insert"; index: number; values: string[] }
  | { type: "delete"; index: number };

export type ColumnOp =
  | { type: "insert"; index: number; name: string }
  | { type: "delete"; index: number }
  | { type: "rename"; index: number; name: string };

export type RowColumnOpsParams = {
  headers: string[];
  rows: string[][];
  rowIndexInput: string;
  columnIndexInput: string;
  columnNameInput: string;
  getColumnCount: () => number;
  getCellValue: (row: number, col: number) => string;
  applyPatch: (row: number, col: number, value: string) => void;
  getCurrentDelimiter: () => string;
  getActiveRange: () => SelectionRange | null;
  clearSelection: () => void;
  setHeaders: (updater: (current: string[]) => string[]) => void;
  setRows: (updater: (current: string[][]) => string[][]) => void;
  setPatches: (updater: (current: Record<string, string>) => Record<string, string>) => void;
  setError: (value: string | null) => void;
  resetTransientEdits: () => void;
  t: (en: string, zh: string) => string;
};

export default function useRowColumnOps({
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
}: RowColumnOpsParams) {
  const [rowOps, setRowOps] = useState<RowOp[]>([]);
  const [columnOps, setColumnOps] = useState<ColumnOp[]>([]);

  const resetOps = useCallback(() => {
    setRowOps([]);
    setColumnOps([]);
  }, []);

  const parseColumnIndex = (value: string, allowEnd: boolean) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    if (allowEnd && parsed > headers.length) return null;
    if (!allowEnd && parsed >= headers.length) return null;
    return parsed;
  };

  const parseRowIndex = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  };

  const resolveRowTarget = (allowEnd: boolean) => {
    const inputIndex = parseRowIndex(rowIndexInput);
    if (inputIndex !== null) return inputIndex;
    const range = getActiveRange();
    if (range) {
      return Math.min(range.startRow, range.endRow);
    }
    return allowEnd ? rows.length : null;
  };

  const shiftPatchesForRowInsert = (index: number) => {
    setPatches((current) => {
      const updated: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        const nextRow = row >= index ? row + 1 : row;
        updated[`${nextRow}:${col}`] = value;
      });
      return updated;
    });
  };

  const shiftPatchesForRowDelete = (index: number) => {
    setPatches((current) => {
      const updated: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        if (row === index) return;
        const nextRow = row > index ? row - 1 : row;
        updated[`${nextRow}:${col}`] = value;
      });
      return updated;
    });
  };

  const shiftPatchesForColInsert = (index: number) => {
    setPatches((current) => {
      const updated: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        const nextCol = col >= index ? col + 1 : col;
        updated[`${row}:${nextCol}`] = value;
      });
      return updated;
    });
  };

  const shiftPatchesForColDelete = (index: number) => {
    setPatches((current) => {
      const updated: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        const [row, col] = key.split(":").map(Number);
        if (col === index) return;
        const nextCol = col > index ? col - 1 : col;
        updated[`${row}:${nextCol}`] = value;
      });
      return updated;
    });
  };

  const normalizeRowValuesForOps = (values: string[]) => {
    let normalized = [...values];
    for (let idx = columnOps.length - 1; idx >= 0; idx -= 1) {
      const op = columnOps[idx];
      if (op.type === "insert") {
        if (op.index >= 0 && op.index < normalized.length) {
          normalized.splice(op.index, 1);
        }
      }
      if (op.type === "delete") {
        if (op.index <= normalized.length) {
          normalized.splice(op.index, 0, "");
        } else {
          normalized.push("");
        }
      }
    }
    return normalized;
  };

  const insertRowAt = (target: number, values?: string[]) => {
    const columnCount = getColumnCount();
    const nextRow = new Array(columnCount)
      .fill("")
      .map((_, idx) => values?.[idx] ?? "");
    const opValues = normalizeRowValuesForOps(nextRow);
    setRowOps((current) => [...current, { type: "insert", index: target, values: opValues }]);
    setRows((current) => {
      if (target > current.length) return current;
      const updated = [...current];
      updated.splice(target, 0, nextRow);
      return updated;
    });
    shiftPatchesForRowInsert(target);
    resetTransientEdits();
    clearSelection();
  };

  const insertRow = () => {
    const target = resolveRowTarget(true);
    if (target === null) {
      setError(t("Row index is invalid.", "行索引无效。"));
      return;
    }
    insertRowAt(target);
  };

  const deleteRow = () => {
    const target = resolveRowTarget(false);
    if (target === null) {
      setError(t("Select a row to delete.", "请选择要删除的行。"));
      return;
    }
    setRowOps((current) => [...current, { type: "delete", index: target }]);
    setRows((current) => (target < current.length ? current.filter((_, idx) => idx !== target) : current));
    shiftPatchesForRowDelete(target);
    resetTransientEdits();
    clearSelection();
  };

  const insertColumnAt = (index: number, name: string) => {
    setColumnOps((current) => [...current, { type: "insert", index, name }]);
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
    shiftPatchesForColInsert(index);
  };

  const insertColumn = () => {
    const index = parseColumnIndex(columnIndexInput, true);
    if (index === null) {
      setError(t("Column index is invalid for insert.", "插入时列索引无效。"));
      return;
    }
    const name = columnNameInput.trim() || t(`Column ${headers.length + 1}`, `列 ${headers.length + 1}`);
    setError(null);
    insertColumnAt(index, name);
    resetTransientEdits();
    clearSelection();
  };

  const deleteColumn = () => {
    const index = parseColumnIndex(columnIndexInput, false);
    if (index === null) {
      setError(t("Column index is invalid for delete.", "删除时列索引无效。"));
      return;
    }
    setError(null);
    setColumnOps((current) => [...current, { type: "delete", index }]);
    setHeaders((current) => current.filter((_, idx) => idx !== index));
    setRows((current) => current.map((row) => row.filter((_, idx) => idx !== index)));
    shiftPatchesForColDelete(index);
    resetTransientEdits();
    clearSelection();
  };

  const renameColumn = () => {
    const index = parseColumnIndex(columnIndexInput, false);
    if (index === null) {
      setError(t("Column index is invalid for rename.", "重命名时列索引无效。"));
      return;
    }
    const name = columnNameInput.trim();
    if (!name) {
      setError(t("Column name is required for rename.", "重命名需要列名。"));
      return;
    }
    setError(null);
    setColumnOps((current) => [...current, { type: "rename", index, name }]);
    setHeaders((current) => current.map((value, idx) => (idx === index ? name : value)));
  };

  const ensureRowIndex = (targetRow: number) => {
    if (targetRow < rows.length) return;
    const columnCount = getColumnCount();
    for (let idx = rows.length; idx <= targetRow; idx += 1) {
      insertRowAt(idx, new Array(columnCount).fill(""));
    }
  };

  const ensureColumnIndex = (targetCol: number) => {
    if (targetCol < headers.length) return;
    for (let idx = headers.length; idx <= targetCol; idx += 1) {
      const name = t(`Column ${idx + 1}`, `列 ${idx + 1}`);
      insertColumnAt(idx, name);
    }
  };

  const copySelection = async () => {
    const range = getActiveRange();
    if (!range) {
      setError(t("Select cells to copy.", "请选择要复制的区域。"));
      return;
    }
    const delimiterChar = getCurrentDelimiter();
    const lines: string[] = [];
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      const values: string[] = [];
      for (let col = range.startCol; col <= range.endCol; col += 1) {
        values.push(getCellValue(row, col));
      }
      lines.push(values.join(delimiterChar));
    }
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  const pasteSelection = async () => {
    const range = getActiveRange();
    if (!range) {
      setError(t("Select a start cell to paste.", "请选择起始单元格进行粘贴。"));
      return;
    }
    const text = await navigator.clipboard.readText();
    if (!text) return;
    const delimiterChar = text.includes("\t") ? "\t" : getCurrentDelimiter();
    const lines = text.split(/\r?\n/).filter((line) => line.length || line === "");
    lines.forEach((line, rowOffset) => {
      const cells = line.split(delimiterChar);
      cells.forEach((value, colOffset) => {
        const targetRow = range.startRow + rowOffset;
        const targetCol = range.startCol + colOffset;
        ensureRowIndex(targetRow);
        ensureColumnIndex(targetCol);
        applyPatch(targetRow, targetCol, value);
      });
    });
  };

  return {
    rowOps,
    columnOps,
    setRowOps,
    setColumnOps,
    resetOps,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    renameColumn,
    copySelection,
    pasteSelection,
  };
}
