import type useFileOps from "./useFileOps";

type BuildFileOpsOptionsContext = Record<string, any>;

export default function buildFileOpsOptions(
  ctx: BuildFileOpsOptionsContext,
): Parameters<typeof useFileOps>[0] {
  return {
    preview: ctx.preview,
    headers: ctx.headers,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
    patches: ctx.patches,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearRows: ctx.clearRows,
    clearCols: ctx.clearCols,
    getCellValue: ctx.getCellValue,
    applyPatch: ctx.applyPatch,
    pushUndo: ctx.pushUndo,
    setError: ctx.setError,
    setLoading: ctx.setLoading,
    t: ctx.t,
  };
}
