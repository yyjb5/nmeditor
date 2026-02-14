import type useCsvColumnOrdering from "./useCsvColumnOrdering";

type BuildCsvColumnOrderingOptionsContext = Record<string, any>;

export default function buildCsvColumnOrderingOptions(
  ctx: BuildCsvColumnOrderingOptionsContext,
): Parameters<typeof useCsvColumnOrdering>[0] {
  return {
    displayColumnCount: ctx.displayColumnCount,
    headers: ctx.headers,
    columnOrder: ctx.columnOrder,
    t: ctx.t,
    setColumnOrder: ctx.setColumnOrder,
  };
}
