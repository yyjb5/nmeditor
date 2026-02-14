import type usePendingImportRules from "./usePendingImportRules";

type BuildPendingImportRulesOptionsContext = Record<string, any>;

export default function buildPendingImportRulesOptions(
  ctx: BuildPendingImportRulesOptionsContext,
): Parameters<typeof usePendingImportRules>[0] {
  return {
    pendingImportRef: ctx.pendingImportRef,
    fileMode: ctx.fileMode,
    loading: ctx.loading,
    rows: ctx.rows,
    totalRows: ctx.totalRows,
    setRowOps: ctx.setRowOps,
    setClearedRows: ctx.setClearedRows,
    setClearedCols: ctx.setClearedCols,
    setTotalRows: ctx.setTotalRows,
    setHeaders: ctx.setHeaders,
    setRows: ctx.setRows,
    setWindowStart: ctx.setWindowStart,
  };
}
