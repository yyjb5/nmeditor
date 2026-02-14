import { useCallback, useMemo } from "react";

export interface UseCsvLayoutBasicsOptions {
  rows: string[][];
  headersLength: number;
  previewPath: string | null;
  activePath: string | null;
  maxUiColumns: number;
  normalizeColumnWidthsRaw: (widths: number[], maxColumns: number) => number[];
}

export default function useCsvLayoutBasics({
  rows,
  headersLength,
  previewPath,
  activePath,
  maxUiColumns,
  normalizeColumnWidthsRaw,
}: UseCsvLayoutBasicsOptions) {
  const dataColumnCount = useMemo(() => {
    const rowMax = rows.reduce((max, row) => Math.max(max, row.length), 0);
    return Math.max(headersLength, rowMax);
  }, [headersLength, rows]);

  const layoutStorageKey = useMemo(() => {
    const path = previewPath ?? activePath;
    if (!path) return "nmeditor.grid.layout.default";
    return `nmeditor.grid.layout.${path}`;
  }, [previewPath, activePath]);

  const normalizeColumnWidths = useCallback(
    (widths: number[]) => normalizeColumnWidthsRaw(widths, Math.min(dataColumnCount, maxUiColumns)),
    [dataColumnCount, maxUiColumns, normalizeColumnWidthsRaw],
  );

  return {
    dataColumnCount,
    layoutStorageKey,
    normalizeColumnWidths,
  };
}
