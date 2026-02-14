import type useCsvSaveActions from "./useCsvSaveActions";

type BuildCsvSaveActionsOptionsContext = Record<string, any>;

export default function buildCsvSaveActionsOptions(
  ctx: BuildCsvSaveActionsOptionsContext,
): Parameters<typeof useCsvSaveActions>[0] {
  return {
    fileMode: ctx.fileMode,
    saveTextAs: ctx.saveTextAs,
    saveAs: ctx.saveAs,
    clearDraftForPath: ctx.clearDraftForPath,
    previewPath: ctx.previewPath,
    updateActiveTabPath: ctx.updateActiveTabPath,
    resetSessionState: ctx.resetSessionState,
    closeSession: ctx.closeSession,
    openCsvPath: ctx.openCsvPath,
    setFileMode: ctx.setFileMode,
    requestWindow: ctx.requestWindow,
    setFileSizeBytes: ctx.setFileSizeBytes,
    shouldAutoBuildIndex: ctx.shouldAutoBuildIndex,
    refreshTotalRows: ctx.refreshTotalRows,
    activeTabId: ctx.activeTabId,
    saveCurrentTabData: ctx.saveCurrentTabData,
    applyDelimiter: ctx.applyDelimiter,
    fileSizeBytes: ctx.fileSizeBytes,
  };
}
