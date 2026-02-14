import useTextFileFindReplaceJobs from "./useTextFileFindReplaceJobs";
import useTextFindNavigation from "./useTextFindNavigation";
import useTextFindReplaceLifecycleEffects from "./useTextFindReplaceLifecycleEffects";
import useTextFindReplaceResetState from "./useTextFindReplaceResetState";
import useTextReplaceActions from "./useTextReplaceActions";
import useTextToolbarActions from "./useTextToolbarActions";
import buildTextFileFindReplaceJobsOptions from "./buildTextFileFindReplaceJobsOptions";
import buildTextFindNavigationOptions from "./buildTextFindNavigationOptions";
import buildTextFindReplaceLifecycleEffectsOptions from "./buildTextFindReplaceLifecycleEffectsOptions";
import buildTextFindReplaceResetStateOptions from "./buildTextFindReplaceResetStateOptions";
import buildTextReplaceActionsOptions from "./buildTextReplaceActionsOptions";
import buildTextToolbarActionsOptions from "./buildTextToolbarActionsOptions";

type UseTextSearchReplaceActionsContext = Record<string, any>;

export default function useTextSearchReplaceActions(ctx: UseTextSearchReplaceActionsContext) {
  const { saveTextAs, jumpToTextChunk } = useTextToolbarActions(buildTextToolbarActionsOptions({
    textPath: ctx.textPath,
    saveTextTo: ctx.saveTextTo,
    updateActiveTabPath: ctx.updateActiveTabPath,
    textReadOnlyPreview: ctx.textReadOnlyPreview,
    textTotalBytes: ctx.textTotalBytes,
    textChunkJumpInput: ctx.textChunkJumpInput,
    setTextChunkJumpInput: ctx.setTextChunkJumpInput,
    loadTextPreviewChunkAtOffset: ctx.loadTextPreviewChunkAtOffset,
    setError: ctx.setError,
    t: ctx.t,
  }));

  const { resetTextFindState, resetTextReplaceState } = useTextFindReplaceResetState(
    buildTextFindReplaceResetStateOptions({
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
    }),
  );

  const {
    invalidateTextJobPolling,
    cancelTextFindJobInternal,
    cancelTextReplaceJobInternal,
    runTextFind,
    runTextReplaceInFile,
  } = useTextFileFindReplaceJobs(buildTextFileFindReplaceJobsOptions({
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
    resetTextFindState,
    resetTextReplaceState,
    t: ctx.t,
  }));

  const {
    runTextReplaceInChunk,
    runTextReplaceInSelection,
    runTextReplaceNext,
    runTextReplaceConfirmNext,
    textReplaceHasPendingConfirm,
  } =
    useTextReplaceActions(buildTextReplaceActionsOptions({
      textReadOnlyPreview: ctx.textReadOnlyPreview,
      textReplaceRunning: ctx.textReplaceRunning,
      textFindQuery: ctx.textFindQuery,
      textContent: ctx.textContent,
      textReplaceValue: ctx.textReplaceValue,
      textFindUseRegex: ctx.textFindUseRegex,
      textFindMatchCase: ctx.textFindMatchCase,
      textReplacePreserveCase: ctx.textReplacePreserveCase,
      textReplaceConfirmEach: ctx.textReplaceConfirmEach,
      textAreaRef: ctx.textAreaRef,
      setTextContent: ctx.setTextContent,
      resetTextFindState,
      setError: ctx.setError,
      t: ctx.t,
    }));

  const {
    jumpToTextFindHit,
    jumpToTextFindHitFromInput,
    jumpToTextFindHitFromOffsetInput,
    jumpTextFindNext,
    jumpTextFindPrev,
    jumpTextFindResultPage,
    jumpTextFindResultPageFirst,
    jumpTextFindResultPageLast,
    loadMoreTextFindResultPages,
    handleTextFindResultsScroll,
  } = useTextFindNavigation(buildTextFindNavigationOptions({
    textFindHits: ctx.textFindHits,
    textFindHitJumpInput: ctx.textFindHitJumpInput,
    setTextFindHitJumpInput: ctx.setTextFindHitJumpInput,
    textFindOffsetJumpInput: ctx.textFindOffsetJumpInput,
    textFindResultPanelRange: ctx.textFindResultPanelRange,
    textFindResultPanelCanLoadMore: ctx.textFindResultPanelCanLoadMore,
    textFindHasMoreRenderedGroups: ctx.textFindHasMoreRenderedGroups,
    loadMoreTextFindRenderedGroups: ctx.loadMoreTextFindRenderedGroups,
    setTextFindResultPanelStart: ctx.setTextFindResultPanelStart,
    setTextFindResultPanelPageSpan: ctx.setTextFindResultPanelPageSpan,
    activeTextFindIndex: ctx.activeTextFindIndex,
    setActiveTextFindIndex: ctx.setActiveTextFindIndex,
    loadTextPreviewChunkAtOffset: ctx.loadTextPreviewChunkAtOffset,
    setTextChunkJumpInput: ctx.setTextChunkJumpInput,
    setError: ctx.setError,
    t: ctx.t,
    textFindResultsPanelLimit: ctx.textFindResultsPanelLimit,
  }));

  useTextFindReplaceLifecycleEffects(buildTextFindReplaceLifecycleEffectsOptions({
    textReadOnlyPreview: ctx.textReadOnlyPreview,
    textPreviewOffset: ctx.textPreviewOffset,
    textPath: ctx.textPath,
    setTextChunkJumpInput: ctx.setTextChunkJumpInput,
    setTextReplaceValue: ctx.setTextReplaceValue,
    invalidateTextJobPolling,
    resetTextFindState,
    resetTextReplaceState,
  }));

  return {
    saveTextAs,
    jumpToTextChunk,
    cancelTextFindJobInternal,
    cancelTextReplaceJobInternal,
    runTextFind,
    runTextReplaceInFile,
    runTextReplaceInChunk,
    runTextReplaceInSelection,
    runTextReplaceNext,
    runTextReplaceConfirmNext,
    textReplaceHasPendingConfirm,
    jumpToTextFindHit,
    jumpToTextFindHitFromInput,
    jumpToTextFindHitFromOffsetInput,
    jumpTextFindNext,
    jumpTextFindPrev,
    jumpTextFindResultPage,
    jumpTextFindResultPageFirst,
    jumpTextFindResultPageLast,
    loadMoreTextFindResultPages,
    handleTextFindResultsScroll,
  };
}
