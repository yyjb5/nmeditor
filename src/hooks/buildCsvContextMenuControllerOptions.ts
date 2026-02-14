import type useCsvContextMenuController from "./useCsvContextMenuController";

type BuildCsvContextMenuControllerOptionsContext = Record<string, any>;

export default function buildCsvContextMenuControllerOptions(
  ctx: BuildCsvContextMenuControllerOptionsContext,
): Parameters<typeof useCsvContextMenuController>[0] {
  return {
    loading: ctx.loading,
    globalViewLoading: ctx.globalViewLoading,
    hasSortFilter: ctx.hasSortFilter,
    t: ctx.t,
    setError: ctx.setError,
    insertRowWithUndo: ctx.insertRowWithUndo,
    insertRowAtIndex: ctx.insertRowAtIndex,
    deleteRowWithUndo: ctx.deleteRowWithUndo,
    insertColumnWithUndo: ctx.insertColumnWithUndo,
    deleteColumnWithUndo: ctx.deleteColumnWithUndo,
    duplicateColumnAtIndex: ctx.duplicateColumnAtIndex,
    startHeaderEditing: ctx.startHeaderEditing,
    shiftClearedRowsOnInsert: ctx.shiftClearedRowsOnInsert,
    shiftClearedColsOnInsert: ctx.shiftClearedColsOnInsert,
    dataColumnCount: ctx.dataColumnCount,
    getCellValue: ctx.getCellValue,
    getActiveRange: ctx.getActiveRange,
    setClearedRows: ctx.setClearedRows,
    setClearedCols: ctx.setClearedCols,
    setPatches: ctx.setPatches,
    appendContextUndo: ctx.appendContextUndo,
    resetRedoStack: ctx.resetRedoStack,
    headers: ctx.headers,
  };
}
