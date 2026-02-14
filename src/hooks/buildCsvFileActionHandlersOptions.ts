import type useCsvFileActionHandlers from "./useCsvFileActionHandlers";

type BuildCsvFileActionHandlersOptionsContext = Record<string, any>;

export default function buildCsvFileActionHandlersOptions(
  ctx: BuildCsvFileActionHandlersOptionsContext,
): Parameters<typeof useCsvFileActionHandlers>[0] {
  return {
    macroScope: ctx.macroScope,
    runMacroOnFile: ctx.runMacroOnFile,
    runMacro: ctx.runMacro,
    findScope: ctx.findScope,
    runFindReplaceOnFile: ctx.runFindReplaceOnFile,
    applyFindReplace: ctx.applyFindReplace,
    clearModelEdits: ctx.clearModelEdits,
    resetFileOps: ctx.resetFileOps,
    setError: ctx.setError,
    previewPath: ctx.previewPath,
    clearDraftForPath: ctx.clearDraftForPath,
    hasSortFilter: ctx.hasSortFilter,
    setGlobalViewPatchTick: ctx.setGlobalViewPatchTick,
  };
}
