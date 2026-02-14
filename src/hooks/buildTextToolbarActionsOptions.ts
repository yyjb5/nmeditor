import type useTextToolbarActions from "./useTextToolbarActions";

type BuildTextToolbarActionsOptionsContext = Record<string, any>;

export default function buildTextToolbarActionsOptions(
  ctx: BuildTextToolbarActionsOptionsContext,
): Parameters<typeof useTextToolbarActions>[0] {
  return {
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
  };
}
