import type usePendingInitialTabSave from "./usePendingInitialTabSave";

type BuildPendingInitialTabSaveOptionsContext = Record<string, any>;

export default function buildPendingInitialTabSaveOptions(
  ctx: BuildPendingInitialTabSaveOptionsContext,
): Parameters<typeof usePendingInitialTabSave>[0] {
  return {
    pendingInitialSaveRef: ctx.pendingInitialSaveRef,
    activeTabId: ctx.activeTabId,
    fileMode: ctx.fileMode,
    loading: ctx.loading,
    textLoading: ctx.textLoading,
    saveCurrentTabData: ctx.saveCurrentTabData,
  };
}
