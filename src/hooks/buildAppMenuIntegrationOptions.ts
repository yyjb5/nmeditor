import type useAppMenuIntegration from "./useAppMenuIntegration";

type BuildAppMenuIntegrationOptionsContext = Record<string, any>;

export default function buildAppMenuIntegrationOptions(
  ctx: BuildAppMenuIntegrationOptionsContext,
): Parameters<typeof useAppMenuIntegration>[0] {
  return {
    locale: ctx.locale,
    t: ctx.t,
    fileMode: ctx.fileMode,
    handleOpen: ctx.handleOpen,
    saveCurrent: ctx.saveCurrent,
    saveAsCurrent: ctx.saveAsCurrent,
    runMacroOnFile: ctx.runMacroOnFile,
    runFindReplaceOnFile: ctx.runFindReplaceOnFile,
    undo: ctx.undo,
    redo: ctx.redo,
    clearEdits: ctx.clearEdits,
    loadNextWindow: ctx.loadNextWindow,
    runFullStats: ctx.runFullStats,
    applyFindReplace: ctx.applyFindReplace,
    runMacro: ctx.runMacro,
    setShowQuickbar: ctx.setShowQuickbar,
    setShowFindBar: ctx.setShowFindBar,
    setShowMacroPanel: ctx.setShowMacroPanel,
    setShowOpsPanel: ctx.setShowOpsPanel,
    setShowExportPanel: ctx.setShowExportPanel,
    setShowFindPanel: ctx.setShowFindPanel,
    setShowStatsPanel: ctx.setShowStatsPanel,
  };
}
