import type useCsvGridKeyboard from "./useCsvGridKeyboard";

type BuildCsvGridKeyboardOptionsContext = Record<string, any>;

export default function buildCsvGridKeyboardOptions(
  ctx: BuildCsvGridKeyboardOptionsContext,
): Parameters<typeof useCsvGridKeyboard>[0] {
  return {
    fileMode: ctx.fileMode,
    editingCell: ctx.editingCell,
    selectionRowCount: ctx.selectionRowCount,
    selectionColumnCount: ctx.selectionColumnCount,
    rowsLength: ctx.rowsLength,
    windowStart: ctx.windowStart,
    windowSize: ctx.windowSize,
    rowHeight: ctx.rowHeight,
    parentRef: ctx.parentRef,
    rowVirtualizer: ctx.rowVirtualizer,
    requestWindow: ctx.requestWindow,
    selectAll: ctx.selectAll,
    copySelectionSmart: ctx.copySelectionSmart,
    pasteSelection: ctx.pasteSelection,
    clearActiveRangeFromFile: ctx.clearActiveRangeFromFile,
    clearSelectedCellsInLoadedWindow: ctx.clearSelectedCellsInLoadedWindow,
    selectionContainsUnloadedRows: ctx.selectionContainsUnloadedRows,
    resolveSelectionFocusCell: ctx.resolveSelectionFocusCell,
    updateSelection: ctx.updateSelection,
    startEditing: ctx.startEditing,
  };
}
