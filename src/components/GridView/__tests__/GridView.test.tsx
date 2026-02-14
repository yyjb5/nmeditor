import { createRef } from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GridView from "../index";
import type { GridViewProps } from "../types";

const t = (en: string) => en;

function createBaseProps(): GridViewProps {
  const parentRef = createRef<HTMLDivElement>();
  return {
    headers: ["A", "B"],
    columnCount: 2,
    columnWidths: [120, 140],
    rowHeaderWidth: 52,
    gridTemplateColumns: "52px 120px 140px",
    isRowLoaded: () => true,
    getRowIndex: (virtualIndex) => (virtualIndex === 0 ? 0 : null),
    onColumnResizeStart: vi.fn(),
    onColumnResizeStartAll: vi.fn(),
    onRowHeaderResizeStart: vi.fn(),
    onRowHeightResizeStartAll: vi.fn(),
    onRowHeightResizeStartRow: vi.fn(),
    onHeaderRowHeightResizeStart: vi.fn(),
    onRowHeaderContextMenu: vi.fn(),
    onColumnHeaderContextMenu: vi.fn(),
    onBodyScroll: vi.fn(),
    onGridKeyDown: vi.fn(),
    editingHeader: null,
    setEditingHeader: vi.fn(),
    commitHeaderEditing: vi.fn(),
    cancelHeaderEditing: vi.fn(),
    onHeaderDoubleClick: vi.fn(),
    rowHeight: 28,
    headerHeight: 28,
    getRowHeight: () => 28,
    parentRef,
    rowVirtualizer: {
      getTotalSize: () => 28,
      getVirtualItems: () => [{ key: "row-0", index: 0, start: 0 }],
    } as unknown as GridViewProps["rowVirtualizer"],
    editingCell: null,
    patches: {},
    getCellValue: (row, col) => `r${row}c${col}`,
    startEditing: vi.fn(),
    setEditingCell: vi.fn(),
    commitEditing: vi.fn(),
    cancelEditing: vi.fn(),
    onClearSelection: vi.fn(),
    isRowInSelection: () => false,
    isColInSelection: () => false,
    isCellInSelection: () => false,
    activeCell: { row: 0, col: 0 },
    activeRange: { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
    hiddenCols: new Set<number>(),
    updateSelection: vi.fn(),
    setIsDraggingSelection: vi.fn(),
    isDraggingSelection: false,
    selectionMode: "cell",
    onAutoFillSelection: vi.fn(),
    t,
  };
}

describe("GridView resize handles", () => {
  it("keeps top-left global width handle working after cell click", () => {
    const props = createBaseProps();
    const { container } = render(<GridView {...props} />);

    const cell = container.querySelector(".grid-row .cell:not(.row-header)");
    expect(cell).toBeTruthy();
    fireEvent.mouseDown(cell as HTMLElement, { clientX: 100, clientY: 100 });

    const globalHandle = container.querySelector(".cell.header.row-header .resize-handle");
    expect(globalHandle).toBeTruthy();
    fireEvent.mouseDown(globalHandle as HTMLElement, { clientX: 222 });

    expect(props.onColumnResizeStartAll).toHaveBeenCalledTimes(1);
    expect(props.onColumnResizeStartAll).toHaveBeenCalledWith(222);
  });

  it("falls back to row-header width handle when global callback missing", () => {
    const props = createBaseProps();
    props.onColumnResizeStartAll = undefined;
    const { container } = render(<GridView {...props} />);

    const globalHandle = container.querySelector(".cell.header.row-header .resize-handle");
    expect(globalHandle).toBeTruthy();
    fireEvent.mouseDown(globalHandle as HTMLElement, { clientX: 180 });

    expect(props.onRowHeaderResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onRowHeaderResizeStart).toHaveBeenCalledWith(180);
  });

  it("does not let fill handle block column resize handle", () => {
    const props = createBaseProps();
    const { container } = render(<GridView {...props} />);

    const fillHandle = container.querySelector(".fill-handle");
    expect(fillHandle).toBeTruthy();

    const columnHandle = container.querySelector(".cell.header:not(.row-header) .resize-handle");
    expect(columnHandle).toBeTruthy();
    fireEvent.mouseDown(columnHandle as HTMLElement, { clientX: 260 });

    expect(props.onColumnResizeStart).toHaveBeenCalledTimes(1);
    expect(props.onColumnResizeStart).toHaveBeenCalledWith(0, 260);
  });

  it("supports header quick filter apply and clear", () => {
    const props = createBaseProps();
    props.filteredColumns = new Set([0]);
    props.headerFilterValues = { 0: "old" };
    props.onHeaderFilterApply = vi.fn();
    props.onHeaderFilterClear = vi.fn();
    const { container, getByText } = render(<GridView {...props} />);

    const trigger = container.querySelector(".cell.header:not(.row-header) .header-filter-trigger");
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger as HTMLElement);

    const input = container.querySelector(".header-filter-menu input");
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLElement, { target: { value: "new" } });
    fireEvent.click(getByText("Apply"));
    expect(props.onHeaderFilterApply).toHaveBeenCalledTimes(1);
    expect(props.onHeaderFilterApply).toHaveBeenCalledWith(0, "new");

    fireEvent.click(trigger as HTMLElement);
    fireEvent.click(getByText("Clear"));
    expect(props.onHeaderFilterClear).toHaveBeenCalledTimes(1);
    expect(props.onHeaderFilterClear).toHaveBeenCalledWith(0);
  });

  it("supports header value-list multi-select filter apply", async () => {
    const props = createBaseProps();
    props.headerFilterValues = { 0: '@in-json:["old"]' };
    props.onHeaderFilterApply = vi.fn();
    props.onHeaderFilterListValues = async () => ({
      values: [
        { value: "apple", count: 2 },
        { value: "banana", count: 1 },
      ],
      hasMore: false,
      truncated: false,
      scannedRows: 12,
    });
    const { container, getByText } = render(<GridView {...props} />);

    const trigger = container.querySelector(".cell.header:not(.row-header) .header-filter-trigger");
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger as HTMLElement);

    await waitFor(() => expect(getByText("apple")).toBeTruthy());
    fireEvent.click(getByText("apple"));
    fireEvent.click(getByText("Apply"));

    expect(props.onHeaderFilterApply).toHaveBeenCalledTimes(1);
    expect(props.onHeaderFilterApply).toHaveBeenCalledWith(0, '@in-json:["old","apple"]');
  });

  it("renders sticky classes for first column when freeze is enabled", () => {
    const props = createBaseProps();
    props.freezeFirstCol = true;
    const { container } = render(<GridView {...props} />);

    const rowHeader = container.querySelector(".grid-row .cell.row-header");
    const firstDataCell = container.querySelector(".grid-row .cell:not(.row-header)");
    expect(rowHeader?.className.includes("freeze-left")).toBeTruthy();
    expect(firstDataCell?.className.includes("freeze-col")).toBeTruthy();
  });

  it("renders sticky top row when freeze-first-row is enabled", () => {
    const props = createBaseProps();
    props.freezeFirstRow = true;
    props.frozenFirstRowValues = ["r0c0", "r0c1"];
    const { container } = render(<GridView {...props} />);
    const frozenRow = container.querySelector(".grid-row.freeze-top");
    expect(frozenRow).toBeTruthy();
  });

  it("subtracts frozen top row height from virtual body layout", () => {
    const props = createBaseProps();
    props.freezeFirstRow = true;
    props.frozenFirstRowValues = ["r0c0", "r0c1"];
    props.getRowIndex = (virtualIndex) => virtualIndex;
    props.rowVirtualizer = {
      getTotalSize: () => 56,
      getVirtualItems: () => [
        { key: "row-0", index: 0, start: 0 },
        { key: "row-1", index: 1, start: 28 },
      ],
    } as unknown as GridViewProps["rowVirtualizer"];
    const { container } = render(<GridView {...props} />);

    const virtualBody = container.querySelector(".grid-body > div");
    expect(virtualBody).toBeTruthy();
    expect((virtualBody as HTMLElement).style.height).toBe("28px");

    const renderedRows = container.querySelectorAll(".grid-body .grid-row:not(.freeze-top)");
    expect(renderedRows.length).toBe(1);
    expect((renderedRows[0] as HTMLElement).style.transform).toBe("translateY(0px)");
  });
});
