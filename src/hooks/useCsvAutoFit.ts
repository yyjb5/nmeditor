import { useCallback, useEffect } from "react";

export interface UseCsvAutoFitOptions {
  autoFitColumns: boolean;
  selectionColumnCount: number;
  headers: string[];
  rows: string[][];
  windowStart: number;
  getCellValue: (row: number, col: number) => string;
  setColumnWidths: (value: number[]) => void;
}

export default function useCsvAutoFit({
  autoFitColumns,
  selectionColumnCount,
  headers,
  rows,
  windowStart,
  getCellValue,
  setColumnWidths,
}: UseCsvAutoFitOptions) {
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
  }, [selectionColumnCount, headers, rows, windowStart, getCellValue, setColumnWidths]);

  useEffect(() => {
    if (!autoFitColumns) return;
    computeAutoFit();
  }, [autoFitColumns, computeAutoFit]);

  return {
    computeAutoFit,
  };
}
