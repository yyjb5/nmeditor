import type usePanelDrawer from "./usePanelDrawer";

type BuildPanelDrawerOptionsContext = Record<string, any>;

export default function buildPanelDrawerOptions(
  ctx: BuildPanelDrawerOptionsContext,
): Parameters<typeof usePanelDrawer>[0] {
  return {
    showMacroPanel: ctx.showMacroPanel,
    showOpsPanel: ctx.showOpsPanel,
    showExportPanel: ctx.showExportPanel,
    showFindPanel: ctx.showFindPanel,
    showStatsPanel: ctx.showStatsPanel,
  };
}
