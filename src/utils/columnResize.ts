export const DEFAULT_COLUMN_WIDTH = 140;
export const MIN_COLUMN_WIDTH = 60;
export const MIN_ROW_HEADER_WIDTH = 36;

export function normalizeColumnWidths(
  widths: number[],
  columnCount: number,
): number[] {
  return Array.from({ length: columnCount }, (_, idx) => {
    const value = Number(widths[idx]);
    return Number.isFinite(value)
      ? Math.max(MIN_COLUMN_WIDTH, value)
      : DEFAULT_COLUMN_WIDTH;
  });
}

export function applyGlobalColumnResize(
  startWidths: number[],
  startRowHeaderWidth: number,
  delta: number,
): { columnWidths: number[]; rowHeaderWidth: number } {
  return {
    rowHeaderWidth: Math.max(MIN_ROW_HEADER_WIDTH, startRowHeaderWidth + delta),
    columnWidths: startWidths.map((width) => Math.max(MIN_COLUMN_WIDTH, width + delta)),
  };
}
