import type {
  Dispatch,
  RefObject,
  SetStateAction,
  MouseEvent as ReactMouseEvent,
  UIEvent,
} from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

export type CellPoint = { row: number; col: number };
export type SelectionMode = "cell" | "row" | "col";

export type EditingCell = { row: number; col: number; value: string } | null;

export type GridViewProps = {
  headers: string[];
  columnCount: number;
  columnWidths: number[];
  rowHeaderWidth: number;
  gridTemplateColumns: string;
  isRowLoaded: (rowIndex: number) => boolean;
  getRowIndex: (virtualIndex: number) => number | null;
  onColumnResizeStart: (index: number, clientX: number) => void;
  onColumnResizeStartAll?: (clientX: number) => void;
  onRowHeaderResizeStart: (clientX: number) => void;
  onRowHeightResizeStartAll: (clientY: number) => void;
  onRowHeightResizeStartRow: (rowIndex: number, clientY: number) => void;
  onHeaderRowHeightResizeStart: (clientY: number) => void;
  onRowHeaderContextMenu: (rowIndex: number, event: ReactMouseEvent) => void;
  onColumnHeaderContextMenu: (colIndex: number, event: ReactMouseEvent) => void;
  onBodyScroll?: (event: UIEvent<HTMLDivElement>) => void;
  editingHeader: { index: number; value: string } | null;
  setEditingHeader: Dispatch<SetStateAction<{ index: number; value: string } | null>>;
  commitHeaderEditing: () => void;
  cancelHeaderEditing: () => void;
  onHeaderDoubleClick: (colIndex: number) => void;
  rowHeight: number;
  headerHeight: number;
  getRowHeight: (rowIndex: number) => number;
  parentRef: RefObject<HTMLDivElement | null>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  editingCell: EditingCell;
  patches: Record<string, string>;
  getCellValue: (row: number, col: number) => string;
  startEditing: (row: number, col: number) => void;
  setEditingCell: Dispatch<SetStateAction<EditingCell>>;
  commitEditing: () => void;
  cancelEditing: () => void;
  onClearSelection: () => void;
  isRowInSelection: (row: number) => boolean;
  isColInSelection: (col: number) => boolean;
  isCellInSelection: (row: number, col: number) => boolean;
  activeCell: CellPoint | null;
  hiddenCols: Set<number>;
  updateSelection: (
    point: CellPoint,
    mode: SelectionMode,
    options: { shift: boolean; ctrl: boolean },
  ) => void;
  setIsDraggingSelection: (value: boolean) => void;
  isDraggingSelection: boolean;
  selectionMode: SelectionMode;
  t: (en: string, zh: string) => string;
};
