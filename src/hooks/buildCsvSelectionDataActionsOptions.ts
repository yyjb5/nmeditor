import type useCsvSelectionDataActions from "./useCsvSelectionDataActions";

type BuildCsvSelectionDataActionsOptionsContext = Record<string, any>;

export default function buildCsvSelectionDataActionsOptions(
  ctx: BuildCsvSelectionDataActionsOptionsContext,
): Parameters<typeof useCsvSelectionDataActions>[0] {
  return {
    fileMode: ctx.fileMode,
    rowsLength: ctx.rowsLength,
    selectionRowCount: ctx.selectionRowCount,
    selectionColumnCount: ctx.selectionColumnCount,
    selectionAnchor: ctx.selectionAnchor,
    selectionRanges: ctx.selectionRanges,
    windowStart: ctx.windowStart,
    getActiveRange: ctx.getActiveRange,
    applyPatch: ctx.applyPatch,
    pushUndo: ctx.pushUndo,
    setError: ctx.setError,
    t: ctx.t,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    previewDelimiter: ctx.previewDelimiter,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    hasSortFilter: ctx.hasSortFilter,
    globalViewIdRef: ctx.globalViewIdRef,
    windowSize: ctx.windowSize,
    patches: ctx.patches,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    queueGlobalViewPatchRefresh: ctx.queueGlobalViewPatchRefresh,
    setPatches: ctx.setPatches,
    copySelection: ctx.copySelection,
    getCellValue: ctx.getCellValue,
  };
}
