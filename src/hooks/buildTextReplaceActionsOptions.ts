import type useTextReplaceActions from "./useTextReplaceActions";

type BuildTextReplaceActionsOptionsContext = Record<string, any>;

export default function buildTextReplaceActionsOptions(
  ctx: BuildTextReplaceActionsOptionsContext,
): Parameters<typeof useTextReplaceActions>[0] {
  return {
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
    resetTextFindState: ctx.resetTextFindState,
    setError: ctx.setError,
    t: ctx.t,
  };
}
