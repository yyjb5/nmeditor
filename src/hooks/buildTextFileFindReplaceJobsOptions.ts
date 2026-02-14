import type useTextFileFindReplaceJobs from "./useTextFileFindReplaceJobs";

type BuildTextFileFindReplaceJobsOptionsContext = Record<string, any>;

export default function buildTextFileFindReplaceJobsOptions(
  ctx: BuildTextFileFindReplaceJobsOptionsContext,
): Parameters<typeof useTextFileFindReplaceJobs>[0] {
  return {
    textPath: ctx.textPath,
    textReadOnlyPreview: ctx.textReadOnlyPreview,
    textEncoding: ctx.textEncoding,
    textFindQuery: ctx.textFindQuery,
    textFindUseRegex: ctx.textFindUseRegex,
    textFindMatchCase: ctx.textFindMatchCase,
    textFindRunning: ctx.textFindRunning,
    textFindJobId: ctx.textFindJobId,
    textReplaceValue: ctx.textReplaceValue,
    textReplacePreserveCase: ctx.textReplacePreserveCase,
    textReplaceConfirmEach: ctx.textReplaceConfirmEach,
    textReplaceRunning: ctx.textReplaceRunning,
    textReplaceJobId: ctx.textReplaceJobId,
    textDirty: ctx.textDirty,
    textPreviewOffset: ctx.textPreviewOffset,
    loadTextPreviewChunkAtOffset: ctx.loadTextPreviewChunkAtOffset,
    saveTextTo: ctx.saveTextTo,
    setTextChunkJumpInput: ctx.setTextChunkJumpInput,
    setTextFindRunning: ctx.setTextFindRunning,
    setTextFindJobId: ctx.setTextFindJobId,
    setTextFindProgress: ctx.setTextFindProgress,
    setTextFindHits: ctx.setTextFindHits,
    setTextFindHasMore: ctx.setTextFindHasMore,
    setTextFindMatchedCount: ctx.setTextFindMatchedCount,
    setTextFindScannedBytes: ctx.setTextFindScannedBytes,
    setTextFindElapsedMs: ctx.setTextFindElapsedMs,
    setActiveTextFindIndex: ctx.setActiveTextFindIndex,
    setTextReplaceRunning: ctx.setTextReplaceRunning,
    setTextReplaceJobId: ctx.setTextReplaceJobId,
    setTextReplaceProgress: ctx.setTextReplaceProgress,
    setTextReplaceAppliedCount: ctx.setTextReplaceAppliedCount,
    setTextReplaceScannedBytes: ctx.setTextReplaceScannedBytes,
    setTextReplaceElapsedMs: ctx.setTextReplaceElapsedMs,
    setError: ctx.setError,
    resetTextFindState: ctx.resetTextFindState,
    resetTextReplaceState: ctx.resetTextReplaceState,
    t: ctx.t,
  };
}
