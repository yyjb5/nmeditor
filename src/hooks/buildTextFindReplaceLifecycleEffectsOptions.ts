import type useTextFindReplaceLifecycleEffects from "./useTextFindReplaceLifecycleEffects";

type BuildTextFindReplaceLifecycleEffectsOptionsContext = Record<string, any>;

export default function buildTextFindReplaceLifecycleEffectsOptions(
  ctx: BuildTextFindReplaceLifecycleEffectsOptionsContext,
): Parameters<typeof useTextFindReplaceLifecycleEffects>[0] {
  return {
    textReadOnlyPreview: ctx.textReadOnlyPreview,
    textPreviewOffset: ctx.textPreviewOffset,
    textPath: ctx.textPath,
    setTextChunkJumpInput: ctx.setTextChunkJumpInput,
    setTextReplaceValue: ctx.setTextReplaceValue,
    invalidateTextJobPolling: ctx.invalidateTextJobPolling,
    resetTextFindState: ctx.resetTextFindState,
    resetTextReplaceState: ctx.resetTextReplaceState,
  };
}
