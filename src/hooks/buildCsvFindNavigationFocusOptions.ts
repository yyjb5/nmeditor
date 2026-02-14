import type useCsvFindNavigationFocus from "./useCsvFindNavigationFocus";

type BuildCsvFindNavigationFocusOptionsContext = Record<string, any>;

export default function buildCsvFindNavigationFocusOptions(
  ctx: BuildCsvFindNavigationFocusOptionsContext,
): Parameters<typeof useCsvFindNavigationFocus>[0] {
  return {
    findMatches: ctx.findMatches,
    findMatchesSource: ctx.findMatchesSource,
    activeFindMatchIndex: ctx.activeFindMatchIndex,
    setActiveFindMatchIndex: ctx.setActiveFindMatchIndex,
    setIsDraggingSelection: ctx.setIsDraggingSelection,
    updateSelection: ctx.updateSelection,
    windowStart: ctx.windowStart,
    rowsLength: ctx.rowsLength,
    rowVirtualizer: ctx.rowVirtualizer,
    hasSortFilter: ctx.hasSortFilter,
    setError: ctx.setError,
    t: ctx.t,
    globalViewIdRef: ctx.globalViewIdRef,
    previewPath: ctx.previewPath,
    previewDelimiter: ctx.previewDelimiter,
    dialectDelimiter: ctx.dialectDelimiter,
    effectiveTotalRows: ctx.effectiveTotalRows,
    windowSize: ctx.windowSize,
    requestIdRef: ctx.requestIdRef,
    loadWindow: ctx.loadWindow,
  };
}
