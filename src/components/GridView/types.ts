import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
  MouseEvent as ReactMouseEvent,
  UIEvent,
} from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

export type CellPoint = { row: number; col: number };
export type SelectionMode = "cell" | "row" | "col";
export type SelectionRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

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
  onGridKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onGridFocusChange?: (focused: boolean) => void;
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
  activeRange: SelectionRange | null;
  hiddenCols: Set<number>;
  updateSelection: (
    point: CellPoint,
    mode: SelectionMode,
    options: { shift: boolean; ctrl: boolean },
  ) => void;
  setIsDraggingSelection: (value: boolean) => void;
  isDraggingSelection: boolean;
  selectionMode: SelectionMode;
  onAutoFillSelection?: (source: SelectionRange, target: CellPoint) => void;
  freezeFirstCol?: boolean;
  freezeFirstRow?: boolean;
  frozenFirstRowValues?: string[] | null;
  filteredColumns?: Set<number>;
  totalRows?: number | null;
  windowStart?: number;
  loadedRowCount?: number;
  delimiter?: string;
  delimiterApplied?: string | null;
  eof?: boolean;
  indexRunning?: boolean;
  globalViewLoading?: boolean;
  sortRuleCount?: number;
  filterRuleCount?: number;
  patchCount?: number;
  headerFilterValues?: Record<number, string>;
  onHeaderFilterApply?: (column: number, value: string) => void;
  onHeaderFilterClear?: (column: number) => void;
  onHeaderFilterListValues?: (
    column: number,
    query: string,
    limit: number,
    offset: number,
  ) => Promise<{
    values: Array<{ value: string; count: number }>;
    hasMore: boolean;
    truncated: boolean;
    scannedRows: number;
  }>;
  filterBusy?: boolean;
  t: (en: string, zh: string) => string;
};
