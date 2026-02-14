import { useMemo } from "react";

export interface UseGridTemplateColumnsOptions {
  columnWidths: number[];
  hiddenCols: Set<number>;
  rowHeaderWidth: number;
  normalizeColumnWidths: (widths: number[]) => number[];
}

export default function useGridTemplateColumns({
  columnWidths,
  hiddenCols,
  rowHeaderWidth,
  normalizeColumnWidths,
}: UseGridTemplateColumnsOptions) {
  const gridTemplateColumns = useMemo(() => {
    const widths = normalizeColumnWidths(columnWidths);
    const columnDefs = widths.map((width, index) =>
      hiddenCols.has(index) ? "0px" : `${width}px`,
    );
    return `${rowHeaderWidth}px ${columnDefs.join(" ")}`;
  }, [columnWidths, hiddenCols, normalizeColumnWidths, rowHeaderWidth]);

  return {
    gridTemplateColumns,
  };
}
