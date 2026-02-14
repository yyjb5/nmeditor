import type useCsvGridDerivedState from "./useCsvGridDerivedState";

type BuildCsvGridDerivedStateOptionsContext = Record<string, any>;

export default function buildCsvGridDerivedStateOptions(
  ctx: BuildCsvGridDerivedStateOptionsContext,
): Parameters<typeof useCsvGridDerivedState>[0] {
  return {
    dataColumnCount: ctx.dataColumnCount,
    maxUiColumns: ctx.maxUiColumns,
    headers: ctx.headers,
    windowStart: ctx.windowStart,
    rowsLength: ctx.rowsLength,
    fileMode: ctx.fileMode,
    hasSortFilter: ctx.hasSortFilter,
    globalViewTotal: ctx.globalViewTotal,
  };
}
