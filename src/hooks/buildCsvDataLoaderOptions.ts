import type useCsvDataLoader from "./useCsvDataLoader";

type BuildCsvDataLoaderOptionsContext = Record<string, any>;

export default function buildCsvDataLoaderOptions(
  ctx: BuildCsvDataLoaderOptionsContext,
): Parameters<typeof useCsvDataLoader>[0] {
  return {
    activePath: ctx.activePath,
    preview: ctx.preview,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    rows: ctx.rows,
    setRows: ctx.setRows,
    setEof: ctx.setEof,
    applyColumnOpsToRows: ctx.applyColumnOpsToRows,
    bumpDiagnostics: ctx.bumpDiagnostics,
    globalViewIdRef: ctx.globalViewIdRef,
    setError: ctx.setError,
    setLastIndexTrigger: ctx.setLastIndexTrigger,
    windowStart: ctx.windowStart,
    setWindowStart: ctx.setWindowStart,
    setRowIndexMap: ctx.setRowIndexMap,
  };
}
