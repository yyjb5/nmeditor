import { useMemo } from "react";

export interface UseCsvGridDerivedStateOptions {
  dataColumnCount: number;
  maxUiColumns: number;
  headers: string[];
  windowStart: number;
  rowsLength: number;
  fileMode: "none" | "csv" | "text";
  hasSortFilter: boolean;
  globalViewTotal: number | null;
}

export default function useCsvGridDerivedState({
  dataColumnCount,
  maxUiColumns,
  headers,
  windowStart,
  rowsLength,
  fileMode,
  hasSortFilter,
  globalViewTotal,
}: UseCsvGridDerivedStateOptions) {
  const displayColumnCount = Math.min(dataColumnCount, maxUiColumns);
  const columnCount = Math.max(displayColumnCount, 3);
  const selectionColumnCount = columnCount;

  const gridHeaders = useMemo(
    () => headers.slice(0, selectionColumnCount),
    [headers, selectionColumnCount],
  );

  const streamRowCount = useMemo(
    () => Math.max(windowStart + rowsLength, rowsLength),
    [windowStart, rowsLength],
  );

  const selectionRowCount =
    fileMode === "csv"
      ? hasSortFilter
        ? (globalViewTotal ?? rowsLength)
        : streamRowCount
      : rowsLength;

  return {
    displayColumnCount,
    selectionColumnCount,
    gridHeaders,
    streamRowCount,
    selectionRowCount,
  };
}
