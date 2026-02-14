import type useCsvFindMatches from "./useCsvFindMatches";

type BuildCsvFindMatchesOptionsContext = Record<string, any>;

export default function buildCsvFindMatchesOptions(
  ctx: BuildCsvFindMatchesOptionsContext,
): Parameters<typeof useCsvFindMatches>[0] {
  return {
    findScope: ctx.findScope,
    findText: ctx.findText,
    findColumnInput: ctx.findColumnInput,
    findStartRow: ctx.findStartRow,
    findEndRow: ctx.findEndRow,
    useRegex: ctx.useRegex,
    matchCase: ctx.matchCase,
    findRunning: ctx.findRunning,
    findJobId: ctx.findJobId,
    hasSortFilter: ctx.hasSortFilter,
    getGlobalViewId: ctx.getGlobalViewId,
    preview: ctx.preview,
    dialectDelimiter: ctx.dialectDelimiter,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
    selectionColumnCount: ctx.selectionColumnCount,
    getCellValue: ctx.getCellValue,
    focusFindMatch: ctx.focusFindMatch,
    setFindJobId: ctx.setFindJobId,
    setFindRunning: ctx.setFindRunning,
    setFindProgress: ctx.setFindProgress,
    setFindCanceled: ctx.setFindCanceled,
    setFindMatchedCount: ctx.setFindMatchedCount,
    setFindScannedRows: ctx.setFindScannedRows,
    setFindElapsedMs: ctx.setFindElapsedMs,
    setFindMatches: ctx.setFindMatches,
    setFindMatchesSource: ctx.setFindMatchesSource,
    setFindMatchesHasMore: ctx.setFindMatchesHasMore,
    setActiveFindMatchIndex: ctx.setActiveFindMatchIndex,
    setError: ctx.setError,
    t: ctx.t,
  };
}
