import type useCsvStructureActions from "./useCsvStructureActions";

type BuildCsvStructureActionsOptionsContext = Record<string, any>;

export default function buildCsvStructureActionsOptions(
  ctx: BuildCsvStructureActionsOptionsContext,
): Parameters<typeof useCsvStructureActions>[0] {
  return {
    rowIndexInput: ctx.rowIndexInput,
    columnIndexInput: ctx.columnIndexInput,
    columnNameInput: ctx.columnNameInput,
    rowsLength: ctx.rowsLength,
    headersLength: ctx.headersLength,
    getActiveRange: ctx.getActiveRange,
    insertRow: ctx.insertRow,
    insertRowWithUndo: ctx.insertRowWithUndo,
    deleteRow: ctx.deleteRow,
    deleteRowWithUndo: ctx.deleteRowWithUndo,
    insertColumn: ctx.insertColumn,
    insertColumnWithUndo: ctx.insertColumnWithUndo,
    deleteColumn: ctx.deleteColumn,
    deleteColumnWithUndo: ctx.deleteColumnWithUndo,
    renameColumn: ctx.renameColumn,
    renameColumnWithUndo: ctx.renameColumnWithUndo,
  };
}
