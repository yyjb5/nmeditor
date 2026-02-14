import { useCallback } from "react";

type SelectionRange = {
  startRow: number;
  endRow: number;
};

type UseCsvStructureActionsParams = {
  rowIndexInput: string;
  columnIndexInput: string;
  columnNameInput: string;
  rowsLength: number;
  headersLength: number;
  getActiveRange: () => SelectionRange | null;
  insertRow: () => void;
  insertRowWithUndo: (index: number) => void;
  deleteRow: () => void;
  deleteRowWithUndo: (index: number) => void;
  insertColumn: () => void;
  insertColumnWithUndo: (index: number, name?: string) => void;
  deleteColumn: () => void;
  deleteColumnWithUndo: (index: number) => void;
  renameColumn: () => void;
  renameColumnWithUndo: (index: number, name: string) => void;
};

export default function useCsvStructureActions({
  rowIndexInput,
  columnIndexInput,
  columnNameInput,
  rowsLength,
  headersLength,
  getActiveRange,
  insertRow,
  insertRowWithUndo,
  deleteRow,
  deleteRowWithUndo,
  insertColumn,
  insertColumnWithUndo,
  deleteColumn,
  deleteColumnWithUndo,
  renameColumn,
  renameColumnWithUndo,
}: UseCsvStructureActionsParams) {
  const resolveRowTarget = useCallback(
    (allowEnd: boolean) => {
      if (rowIndexInput.trim() !== "") {
        const parsed = Number.parseInt(rowIndexInput, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
      const range = getActiveRange();
      if (range) {
        return Math.min(range.startRow, range.endRow);
      }
      return allowEnd ? rowsLength : null;
    },
    [getActiveRange, rowIndexInput, rowsLength],
  );

  const parseColumnIndex = useCallback(
    (allowEnd: boolean) => {
      if (columnIndexInput.trim() === "") return null;
      const parsed = Number.parseInt(columnIndexInput, 10);
      if (Number.isNaN(parsed) || parsed < 0) return null;
      if (allowEnd && parsed > headersLength) return null;
      if (!allowEnd && parsed >= headersLength) return null;
      return parsed;
    },
    [columnIndexInput, headersLength],
  );

  const handleInsertRow = useCallback(() => {
    const target = resolveRowTarget(true);
    if (target === null) {
      insertRow();
      return;
    }
    insertRowWithUndo(target);
  }, [insertRow, insertRowWithUndo, resolveRowTarget]);

  const handleDeleteRow = useCallback(() => {
    const target = resolveRowTarget(false);
    if (target === null) {
      deleteRow();
      return;
    }
    deleteRowWithUndo(target);
  }, [deleteRow, deleteRowWithUndo, resolveRowTarget]);

  const handleInsertColumn = useCallback(() => {
    const index = parseColumnIndex(true);
    if (index === null) {
      insertColumn();
      return;
    }
    insertColumnWithUndo(index, columnNameInput);
  }, [columnNameInput, insertColumn, insertColumnWithUndo, parseColumnIndex]);

  const handleDeleteColumn = useCallback(() => {
    const index = parseColumnIndex(false);
    if (index === null) {
      deleteColumn();
      return;
    }
    deleteColumnWithUndo(index);
  }, [deleteColumn, deleteColumnWithUndo, parseColumnIndex]);

  const handleRenameColumn = useCallback(() => {
    const index = parseColumnIndex(false);
    if (index === null) {
      renameColumn();
      return;
    }
    renameColumnWithUndo(index, columnNameInput);
  }, [columnNameInput, parseColumnIndex, renameColumn, renameColumnWithUndo]);

  return {
    handleInsertRow,
    handleDeleteRow,
    handleInsertColumn,
    handleDeleteColumn,
    handleRenameColumn,
  };
}
