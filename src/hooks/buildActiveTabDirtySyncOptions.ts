import type useActiveTabDirtySync from "./useActiveTabDirtySync";

type BuildActiveTabDirtySyncOptionsContext = Record<string, any>;

export default function buildActiveTabDirtySyncOptions(
  ctx: BuildActiveTabDirtySyncOptionsContext,
): Parameters<typeof useActiveTabDirtySync>[0] {
  return {
    activeTabId: ctx.activeTabId,
    tabs: ctx.tabs,
    patches: ctx.patches,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    textDirty: ctx.textDirty,
    setTabs: ctx.setTabs,
  };
}
