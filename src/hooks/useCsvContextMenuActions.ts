import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import { runCsvContextAction, type ContextUndoOp } from "../utils/csvContextActions";
import type { CsvContextMenuState } from "../components/CsvContextMenu/types";
import type { SelectionRange } from "./useSelection";

export interface UseCsvContextMenuActionsOptions {
  loading: boolean;
  globalViewLoading: boolean;
  hasSortFilter: boolean;
  setContextMenu: Dispatch<SetStateAction<CsvContextMenuState | null>>;
  contextMenu: CsvContextMenuState | null;
  t: (en: string, zh: string) => string;
  setError: (value: string | null) => void;
  insertRowWithUndo: (index: number) => void;
  insertRowAtIndex: (index: number, values: string[]) => void;
  deleteRowWithUndo: (index: number) => void;
  insertColumnWithUndo: (index: number) => void;
  deleteColumnWithUndo: (index: number) => void;
  duplicateColumnAtIndex: (index: number) => void;
  startHeaderEditing: (colIndex: number) => void;
  shiftClearedRowsOnInsert: (index: number) => void;
  shiftClearedColsOnInsert: (index: number) => void;
  dataColumnCount: number;
  getCellValue: (row: number, col: number) => string;
  getActiveRange: () => SelectionRange | null;
  setClearedRows: Dispatch<SetStateAction<Set<number>>>;
  setClearedCols: Dispatch<SetStateAction<Set<number>>>;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  appendContextUndo: (op: ContextUndoOp) => void;
  resetRedoStack: () => void;
  headers: string[];
}

export default function useCsvContextMenuActions({
  loading,
  globalViewLoading,
  hasSortFilter,
  setContextMenu,
  contextMenu,
  t,
  setError,
  insertRowWithUndo,
  insertRowAtIndex,
  deleteRowWithUndo,
  insertColumnWithUndo,
  deleteColumnWithUndo,
  duplicateColumnAtIndex,
  startHeaderEditing,
  shiftClearedRowsOnInsert,
  shiftClearedColsOnInsert,
  dataColumnCount,
  getCellValue,
  getActiveRange,
  setClearedRows,
  setClearedCols,
  setPatches,
  appendContextUndo,
  resetRedoStack,
  headers,
}: UseCsvContextMenuActionsOptions) {
  const handleRowHeaderContextMenu = useCallback((rowIndex: number, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (loading || globalViewLoading || hasSortFilter) return;
    setContextMenu({ type: "row", index: rowIndex, x: event.clientX, y: event.clientY });
  }, [globalViewLoading, hasSortFilter, loading, setContextMenu]);

  const handleColumnHeaderContextMenu = useCallback((colIndex: number, event: ReactMouseEvent) => {
    event.stopPropagation();
    if (loading || globalViewLoading || hasSortFilter) return;
    setContextMenu({ type: "col", index: colIndex, x: event.clientX, y: event.clientY });
  }, [globalViewLoading, hasSortFilter, loading, setContextMenu]);

  const runContextAction = useCallback(async (action: string) => {
    await runCsvContextAction({
      action,
      contextMenu,
      hasSortFilter,
      t,
      setError,
      setContextMenu,
      insertRowWithUndo,
      insertRowAtIndex,
      deleteRowWithUndo,
      insertColumnWithUndo,
      deleteColumnWithUndo,
      duplicateColumnAtIndex,
      startHeaderEditing,
      shiftClearedRowsOnInsert,
      shiftClearedColsOnInsert,
      dataColumnCount,
      getCellValue,
      getActiveRange,
      setClearedRows,
      setClearedCols,
      setPatches,
      appendUndo: appendContextUndo,
      resetRedo: resetRedoStack,
      headers,
    });
  }, [
    appendContextUndo,
    contextMenu,
    dataColumnCount,
    deleteColumnWithUndo,
    deleteRowWithUndo,
    duplicateColumnAtIndex,
    getActiveRange,
    getCellValue,
    hasSortFilter,
    headers,
    insertColumnWithUndo,
    insertRowAtIndex,
    insertRowWithUndo,
    resetRedoStack,
    setClearedCols,
    setClearedRows,
    setContextMenu,
    setError,
    setPatches,
    shiftClearedColsOnInsert,
    shiftClearedRowsOnInsert,
    startHeaderEditing,
    t,
  ]);

  return {
    handleRowHeaderContextMenu,
    handleColumnHeaderContextMenu,
    runContextAction,
  };
}
