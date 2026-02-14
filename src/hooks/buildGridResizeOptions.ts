import type useGridResize from "./useGridResize";

type BuildGridResizeOptionsContext = Record<string, any>;

export default function buildGridResizeOptions(
  ctx: BuildGridResizeOptionsContext,
): Parameters<typeof useGridResize>[0] {
  return {
    columnWidths: ctx.columnWidths,
    rowHeaderWidth: ctx.rowHeaderWidth,
    rowHeight: ctx.rowHeight,
    headerHeightOverride: ctx.headerHeightOverride,
    rowHeightOverrides: ctx.rowHeightOverrides,
    setColumnWidths: ctx.setColumnWidths,
    setRowHeaderWidth: ctx.setRowHeaderWidth,
    setRowHeight: ctx.setRowHeight,
    setHeaderHeightOverride: ctx.setHeaderHeightOverride,
    setRowHeightOverrides: ctx.setRowHeightOverrides,
    normalizeColumnWidths: ctx.normalizeColumnWidths,
  };
}
