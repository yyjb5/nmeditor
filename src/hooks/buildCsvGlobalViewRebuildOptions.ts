import type useCsvGlobalViewRebuild from "./useCsvGlobalViewRebuild";

type BuildCsvGlobalViewRebuildOptionsContext = Record<string, any>;

export default function buildCsvGlobalViewRebuildOptions(
  ctx: BuildCsvGlobalViewRebuildOptionsContext,
): Parameters<typeof useCsvGlobalViewRebuild>[0] {
  return {
    fileMode: ctx.fileMode,
    hasSortFilter: ctx.hasSortFilter,
    sortRules: ctx.sortRules,
    filterRules: ctx.filterRules,
    globalViewPatchTick: ctx.globalViewPatchTick,
    patches: ctx.patches,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    previewPath: ctx.previewPath,
    delimiterApplied: ctx.delimiterApplied,
    delimiter: ctx.delimiter,
    sortFilterMemoryLimitMb: ctx.sortFilterMemoryLimitMb,
    forceExternalSort: ctx.forceExternalSort,
    globalViewIdRef: ctx.globalViewIdRef,
    globalViewBuildRef: ctx.globalViewBuildRef,
    globalViewRebuildTimerRef: ctx.globalViewRebuildTimerRef,
    globalViewBuildRunningRef: ctx.globalViewBuildRunningRef,
    globalViewBuildPendingRef: ctx.globalViewBuildPendingRef,
    requestWindow: ctx.requestWindow,
    resetWindowCaches: ctx.resetWindowCaches,
    releaseGlobalView: ctx.releaseGlobalView,
    setGlobalViewTotal: ctx.setGlobalViewTotal,
    setGlobalViewLoading: ctx.setGlobalViewLoading,
    setRowIndexMap: ctx.setRowIndexMap,
    setError: ctx.setError,
    t: ctx.t,
  };
}
