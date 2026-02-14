import type useTextFindReplaceResetState from "./useTextFindReplaceResetState";

type BuildTextFindReplaceResetStateOptionsContext = Record<string, any>;

export default function buildTextFindReplaceResetStateOptions(
  ctx: BuildTextFindReplaceResetStateOptionsContext,
): Parameters<typeof useTextFindReplaceResetState>[0] {
  return {
    resetTextFindResultsModel: ctx.resetTextFindResultsModel,
    setTextFindRunning: ctx.setTextFindRunning,
    setTextFindJobId: ctx.setTextFindJobId,
    setTextFindProgress: ctx.setTextFindProgress,
    setTextFindHits: ctx.setTextFindHits,
    setTextFindResultPanelStart: ctx.setTextFindResultPanelStart,
    setTextFindResultPanelPageSpan: ctx.setTextFindResultPanelPageSpan,
    setActiveTextFindIndex: ctx.setActiveTextFindIndex,
    setTextFindHasMore: ctx.setTextFindHasMore,
    setTextFindMatchedCount: ctx.setTextFindMatchedCount,
    setTextFindScannedBytes: ctx.setTextFindScannedBytes,
    setTextFindElapsedMs: ctx.setTextFindElapsedMs,
    setTextReplaceRunning: ctx.setTextReplaceRunning,
    setTextReplaceJobId: ctx.setTextReplaceJobId,
    setTextReplaceProgress: ctx.setTextReplaceProgress,
    setTextReplaceAppliedCount: ctx.setTextReplaceAppliedCount,
    setTextReplaceScannedBytes: ctx.setTextReplaceScannedBytes,
    setTextReplaceElapsedMs: ctx.setTextReplaceElapsedMs,
  };
}
