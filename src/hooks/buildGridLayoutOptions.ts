import type useGridLayout from "./useGridLayout";

type BuildGridLayoutOptionsContext = Record<string, any>;

export default function buildGridLayoutOptions(
  ctx: BuildGridLayoutOptionsContext,
): Parameters<typeof useGridLayout>[0] {
  return {
    layoutStorageKey: ctx.layoutStorageKey,
    columnCount: ctx.columnCount,
    normalizeColumnWidths: ctx.normalizeColumnWidths,
  };
}
