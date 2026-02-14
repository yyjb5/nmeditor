import type useTabPathActions from "./useTabPathActions";

type BuildTabPathActionsOptionsContext = Record<string, any>;

export default function buildTabPathActionsOptions(
  ctx: BuildTabPathActionsOptionsContext,
): Parameters<typeof useTabPathActions>[0] {
  return {
    activeTabId: ctx.activeTabId,
    setTabs: ctx.setTabs,
  };
}
