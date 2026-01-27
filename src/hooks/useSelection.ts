import { useEffect, useState } from "react";

export type CellPoint = {
  row: number;
  col: number;
};

export type SelectionRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type SelectionMode = "cell" | "row" | "col";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeRange = (range: SelectionRange): SelectionRange => ({
  startRow: Math.min(range.startRow, range.endRow),
  endRow: Math.max(range.startRow, range.endRow),
  startCol: Math.min(range.startCol, range.endCol),
  endCol: Math.max(range.startCol, range.endCol),
});

export default function useSelection(rowCount: number, colCount: number) {
  const [selectionRanges, setSelectionRanges] = useState<SelectionRange[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<CellPoint | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("cell");
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  useEffect(() => {
    if (!isDraggingSelection) return;
    const handleMouseUp = () => setIsDraggingSelection(false);
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDraggingSelection]);

  const buildRange = (anchor: CellPoint, focus: CellPoint, mode: SelectionMode) => {
    if (!rowCount || !colCount) return null;
    const startRow = clamp(anchor.row, 0, rowCount - 1);
    const endRow = clamp(focus.row, 0, rowCount - 1);
    const startCol = clamp(anchor.col, 0, colCount - 1);
    const endCol = clamp(focus.col, 0, colCount - 1);

    if (mode === "row") {
      return normalizeRange({
        startRow,
        endRow,
        startCol: 0,
        endCol: colCount - 1,
      });
    }

    if (mode === "col") {
      return normalizeRange({
        startRow: 0,
        endRow: rowCount - 1,
        startCol,
        endCol,
      });
    }

    return normalizeRange({ startRow, endRow, startCol, endCol });
  };

  const updateSelection = (
    point: CellPoint,
    mode: SelectionMode,
    options: { shift: boolean; ctrl: boolean },
  ) => {
    const anchor = options.shift ? selectionAnchor ?? point : point;
    const range = buildRange(anchor, point, mode);
    if (!range) return;

    setSelectionMode(mode);
    setSelectionAnchor(anchor);
    if (options.ctrl) {
      setSelectionRanges((prev) => [...prev, range]);
    } else if (options.shift) {
      setSelectionRanges((prev) => (prev.length ? [...prev.slice(0, -1), range] : [range]));
    } else {
      setSelectionRanges([range]);
    }
  };

  const clearSelection = () => {
    setSelectionRanges([]);
    setSelectionAnchor(null);
    setSelectionMode("cell");
    setIsDraggingSelection(false);
  };

  const getActiveRange = () =>
    selectionRanges.length ? selectionRanges[selectionRanges.length - 1] : null;

  const isCellInSelection = (row: number, col: number) =>
    selectionRanges.some(
      (range) =>
        row >= range.startRow &&
        row <= range.endRow &&
        col >= range.startCol &&
        col <= range.endCol,
    );

  const isRowInSelection = (row: number) =>
    selectionRanges.some((range) => row >= range.startRow && row <= range.endRow);

  const isColInSelection = (col: number) =>
    selectionRanges.some((range) => col >= range.startCol && col <= range.endCol);

  return {
    selectionRanges,
    selectionMode,
    isDraggingSelection,
    setIsDraggingSelection,
    updateSelection,
    clearSelection,
    getActiveRange,
    isCellInSelection,
    isRowInSelection,
    isColInSelection,
  };
}
