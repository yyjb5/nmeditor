import type useTextFindNavigation from "./useTextFindNavigation";

type BuildTextFindNavigationOptionsContext = Record<string, any>;

export default function buildTextFindNavigationOptions(
  ctx: BuildTextFindNavigationOptionsContext,
): Parameters<typeof useTextFindNavigation>[0] {
  return {
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
  };
}
