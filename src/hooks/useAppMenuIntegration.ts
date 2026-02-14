import { useCallback, useEffect } from "react";
import useMenuEventBridge, { type MenuEventBridgeHandlers } from "./useMenuEventBridge";
import { invokeCmd, messageDialog } from "../tauriBridge";

type UseAppMenuIntegrationParams = Omit<MenuEventBridgeHandlers, "showAboutDialog"> & {
  locale: string;
  t: (en: string, zh: string) => string;
};

export default function useAppMenuIntegration({
  locale,
  t,
  fileMode,
  handleOpen,
  saveCurrent,
  saveAsCurrent,
  runMacroOnFile,
  runFindReplaceOnFile,
  undo,
  redo,
  clearEdits,
  loadNextWindow,
  runFullStats,
  applyFindReplace,
  runMacro,
  setShowQuickbar,
  setShowFindBar,
  setShowMacroPanel,
  setShowOpsPanel,
  setShowExportPanel,
  setShowFindPanel,
  setShowStatsPanel,
}: UseAppMenuIntegrationParams) {
  useEffect(() => {
    window.localStorage.setItem("nmeditor.locale", locale);
    void invokeCmd("set_menu_locale", { locale });
  }, [locale]);

  const showAboutDialog = useCallback(async () => {
    await messageDialog(t("nmeditor �?Streamed CSV editor.", "nmeditor �?流式CSV编辑器�?"), {
      title: t("About", "关于"),
      kind: "info",
    });
  }, [t]);

  useMenuEventBridge({
    fileMode,
    handleOpen,
    saveCurrent,
    saveAsCurrent,
    runMacroOnFile,
    runFindReplaceOnFile,
    undo,
    redo,
    clearEdits,
    loadNextWindow,
    runFullStats,
    applyFindReplace,
    runMacro,
    setShowQuickbar,
    setShowFindBar,
    setShowMacroPanel,
    setShowOpsPanel,
    setShowExportPanel,
    setShowFindPanel,
    setShowStatsPanel,
    showAboutDialog,
  });
}
