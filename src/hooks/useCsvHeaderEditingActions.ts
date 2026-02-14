import { useCallback } from "react";
import type { ContextUndoOp } from "../utils/csvContextActions";

export interface UseCsvHeaderEditingActionsOptions {
  loading: boolean;
  globalViewLoading: boolean;
  hasSortFilter: boolean;
  headers: string[];
  startHeaderEditingModel: (colIndex: number, value: string) => void;
  commitHeaderEditingModel: () => void;
  cancelHeaderEditingModel: () => void;
  pushUndo: (op: ContextUndoOp) => void;
}

export default function useCsvHeaderEditingActions({
  loading,
  globalViewLoading,
  hasSortFilter,
  headers,
  startHeaderEditingModel,
  commitHeaderEditingModel,
  cancelHeaderEditingModel,
  pushUndo,
}: UseCsvHeaderEditingActionsOptions) {
  const startHeaderEditing = useCallback(
    (colIndex: number) => {
      if (loading || globalViewLoading || hasSortFilter) return;
      startHeaderEditingModel(colIndex, headers[colIndex] ?? "");
    },
    [loading, globalViewLoading, hasSortFilter, headers, startHeaderEditingModel],
  );

  const commitHeaderEditing = commitHeaderEditingModel;
  const cancelHeaderEditing = cancelHeaderEditingModel;

  const appendContextUndo = useCallback(
    (op: ContextUndoOp) => {
      pushUndo(op);
    },
    [pushUndo],
  );

  const resetRedoStack = useCallback(() => {
    // pushUndo clears redo stack automatically
  }, []);

  return {
    startHeaderEditing,
    commitHeaderEditing,
    cancelHeaderEditing,
    appendContextUndo,
    resetRedoStack,
  };
}
