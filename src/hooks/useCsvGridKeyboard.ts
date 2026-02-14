import { useCallback, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from "react";
import type { CellPoint, SelectionMode } from "./useSelection";

type Direction = "up" | "down" | "left" | "right";

type GridVirtualizer = {
  scrollToIndex: (
    index: number,
    options?: { align?: "auto" | "start" | "center" | "end" },
  ) => void;
};

export interface UseCsvGridKeyboardOptions {
  fileMode: "none" | "csv" | "text";
  editingCell: { row: number; col: number } | null;
  selectionRowCount: number;
  selectionColumnCount: number;
  rowsLength: number;
  windowStart: number;
  windowSize: number;
  rowHeight: number;
  parentRef: MutableRefObject<HTMLDivElement | null>;
  rowVirtualizer: GridVirtualizer;
  requestWindow: (start: number, path?: string, delimiterValue?: string) => Promise<void>;
  selectAll: () => void;
  copySelectionSmart: () => Promise<boolean>;
  pasteSelection: () => void | Promise<void>;
  clearActiveRangeFromFile: () => Promise<boolean>;
  clearSelectedCellsInLoadedWindow: () => boolean;
  selectionContainsUnloadedRows: () => boolean;
  resolveSelectionFocusCell: (direction?: Direction) => CellPoint | null;
  updateSelection: (
    point: CellPoint,
    mode: SelectionMode,
    options: { shift: boolean; ctrl: boolean },
  ) => void;
  startEditing: (row: number, col: number) => void;
}

export default function useCsvGridKeyboard({
  fileMode,
  editingCell,
  selectionRowCount,
  selectionColumnCount,
  rowsLength,
  windowStart,
  windowSize,
  rowHeight,
  parentRef,
  rowVirtualizer,
  requestWindow,
  selectAll,
  copySelectionSmart,
  pasteSelection,
  clearActiveRangeFromFile,
  clearSelectedCellsInLoadedWindow,
  selectionContainsUnloadedRows,
  resolveSelectionFocusCell,
  updateSelection,
  startEditing,
}: UseCsvGridKeyboardOptions) {
  const ensureActiveRowVisible = useCallback(
    (targetRow: number) => {
      if (!rowsLength) {
        void requestWindow(Math.max(targetRow, 0));
        return;
      }
      const localRow = targetRow - windowStart;
      if (localRow >= 0 && localRow < rowsLength) {
        rowVirtualizer.scrollToIndex(localRow, { align: "auto" });
        return;
      }
      const anchorSize = Math.max(rowsLength, windowSize, 1);
      const half = Math.floor(anchorSize / 2);
      const maxStart = Math.max(selectionRowCount - anchorSize, 0);
      const nextStart = Math.max(0, Math.min(targetRow - half, maxStart));
      void requestWindow(nextStart);
    },
    [requestWindow, rowVirtualizer, rowsLength, selectionRowCount, windowSize, windowStart],
  );

  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (fileMode !== "csv" || editingCell) return;
      if (selectionRowCount <= 0 || selectionColumnCount <= 0) return;

      const key = event.key;
      const normalized = key.toLowerCase();
      const hasShortcutModifier = event.ctrlKey || event.metaKey;

      if (hasShortcutModifier && !event.altKey) {
        if (normalized === "a") {
          event.preventDefault();
          selectAll();
          ensureActiveRowVisible(0);
          return;
        }
        if (normalized === "c") {
          event.preventDefault();
          void copySelectionSmart();
          return;
        }
        if (normalized === "v") {
          event.preventDefault();
          void pasteSelection();
          return;
        }
        if (normalized === "x") {
          event.preventDefault();
          void (async () => {
            const copied = await copySelectionSmart();
            if (!copied) return;
            if (selectionContainsUnloadedRows()) {
              await clearActiveRangeFromFile();
              return;
            }
            clearSelectedCellsInLoadedWindow();
          })();
          return;
        }
      }

      if ((key === "Delete" || key === "Backspace") && !hasShortcutModifier && !event.altKey) {
        event.preventDefault();
        clearSelectedCellsInLoadedWindow();
        return;
      }

      if (key === "Enter" || key === "F2") {
        event.preventDefault();
        const focus = resolveSelectionFocusCell();
        if (!focus) return;
        const localRow = focus.row - windowStart;
        if (localRow < 0 || localRow >= rowsLength) {
          ensureActiveRowVisible(focus.row);
          return;
        }
        startEditing(focus.row, focus.col);
        return;
      }

      if (key === "Home" || key === "End" || key === "PageUp" || key === "PageDown") {
        event.preventDefault();
        const direction =
          key === "Home"
            ? "left"
            : key === "End"
              ? "right"
              : key === "PageUp"
                ? "up"
                : "down";
        const source = event.shiftKey
          ? resolveSelectionFocusCell(direction)
          : resolveSelectionFocusCell();
        if (!source) return;

        const lastRow = Math.max(selectionRowCount - 1, 0);
        const lastCol = Math.max(selectionColumnCount - 1, 0);
        let nextRow = source.row;
        let nextCol = source.col;

        if (key === "Home") {
          nextCol = 0;
          if (hasShortcutModifier) nextRow = 0;
        } else if (key === "End") {
          nextCol = lastCol;
          if (hasShortcutModifier) nextRow = lastRow;
        } else {
          const viewportRows = parentRef.current
            ? Math.max(1, Math.floor(parentRef.current.clientHeight / Math.max(rowHeight, 1)) - 1)
            : Math.max(Math.floor(rowsLength / 2), 1);
          nextRow += key === "PageUp" ? -viewportRows : viewportRows;
        }

        nextRow = Math.max(0, Math.min(lastRow, nextRow));
        nextCol = Math.max(0, Math.min(lastCol, nextCol));
        updateSelection({ row: nextRow, col: nextCol }, "cell", { shift: event.shiftKey, ctrl: false });
        ensureActiveRowVisible(nextRow);
        return;
      }

      let deltaRow = 0;
      let deltaCol = 0;
      let direction: Direction | null = null;

      if (key === "ArrowUp") {
        deltaRow = -1;
        direction = "up";
      } else if (key === "ArrowDown") {
        deltaRow = 1;
        direction = "down";
      } else if (key === "ArrowLeft") {
        deltaCol = -1;
        direction = "left";
      } else if (key === "ArrowRight") {
        deltaCol = 1;
        direction = "right";
      } else if (key === "Tab") {
        deltaCol = event.shiftKey ? -1 : 1;
        direction = event.shiftKey ? "left" : "right";
      } else {
        return;
      }

      event.preventDefault();
      const source =
        event.shiftKey && direction
          ? resolveSelectionFocusCell(direction)
          : resolveSelectionFocusCell();
      if (!source) return;

      let nextRow = source.row + deltaRow;
      let nextCol = source.col + deltaCol;

      if (key === "Tab") {
        if (nextCol < 0) {
          nextCol = selectionColumnCount - 1;
          nextRow -= 1;
        } else if (nextCol >= selectionColumnCount) {
          nextCol = 0;
          nextRow += 1;
        }
      }

      nextRow = Math.max(0, Math.min(selectionRowCount - 1, nextRow));
      nextCol = Math.max(0, Math.min(selectionColumnCount - 1, nextCol));
      updateSelection({ row: nextRow, col: nextCol }, "cell", { shift: event.shiftKey, ctrl: false });
      ensureActiveRowVisible(nextRow);
    },
    [
      clearSelectedCellsInLoadedWindow,
      clearActiveRangeFromFile,
      copySelectionSmart,
      editingCell,
      ensureActiveRowVisible,
      fileMode,
      parentRef,
      pasteSelection,
      rowHeight,
      selectAll,
      selectionContainsUnloadedRows,
      resolveSelectionFocusCell,
      rowsLength,
      selectionColumnCount,
      selectionRowCount,
      startEditing,
      updateSelection,
      windowStart,
    ],
  );

  return {
    handleGridKeyDown,
  };
}
