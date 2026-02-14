import type useGridTemplateColumns from "./useGridTemplateColumns";

type BuildGridTemplateColumnsOptionsContext = Record<string, any>;

export default function buildGridTemplateColumnsOptions(
  ctx: BuildGridTemplateColumnsOptionsContext,
): Parameters<typeof useGridTemplateColumns>[0] {
  return {
    columnWidths: ctx.columnWidths,
    hiddenCols: ctx.hiddenCols,
    rowHeaderWidth: ctx.rowHeaderWidth,
    normalizeColumnWidths: ctx.normalizeColumnWidths,
  };
}
