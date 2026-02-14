import type useTextFindResultsModel from "./useTextFindResultsModel";

type BuildTextFindResultsModelOptionsContext = Record<string, any>;

export default function buildTextFindResultsModelOptions(
  ctx: BuildTextFindResultsModelOptionsContext,
): Parameters<typeof useTextFindResultsModel>[0] {
  return {
    textFindHits: ctx.textFindHits,
    textFindResultPanelRange: ctx.textFindResultPanelRange,
    textReadOnlyPreview: ctx.textReadOnlyPreview,
    textPreviewBytes: ctx.textPreviewBytes,
    textPreviewOffset: ctx.textPreviewOffset,
    largeTextPreviewBytes: ctx.largeTextPreviewBytes,
    textFindContextRadiusInput: ctx.textFindContextRadiusInput,
    setTextFindContextRadiusInput: ctx.setTextFindContextRadiusInput,
    textPath: ctx.textPath,
    textFindQuery: ctx.textFindQuery,
    textFindUseRegex: ctx.textFindUseRegex,
    textFindMatchCase: ctx.textFindMatchCase,
    activeTextFindIndex: ctx.activeTextFindIndex,
    textEncoding: ctx.textEncoding,
    t: ctx.t,
  };
}
