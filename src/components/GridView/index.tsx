import { useCallback, useRef } from "react";
import "./styles.css";
import type { GridViewProps } from "./types";

export default function GridView({
  headers,
  gridTemplateColumns,
  isRowLoaded,
  getRowIndex,
  onColumnResizeStart,
  onColumnResizeStartAll,
  onRowHeaderResizeStart,
  onRowHeightResizeStartAll,
  onRowHeightResizeStartRow,
  onHeaderRowHeightResizeStart,
  headerHeight,
  getRowHeight,
  parentRef,
  rowVirtualizer,
  editingCell,
  patches,
  getCellValue,
  startEditing,
  setEditingCell,
  commitEditing,
  cancelEditing,
  onClearSelection,
  isRowInSelection,
  isColInSelection,
  isCellInSelection,
  updateSelection,
  setIsDraggingSelection,
  isDraggingSelection,
  selectionMode,
  t,
}: GridViewProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const handleBodyScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
  }, []);
  const columns = headers.length
    ? headers
    : [t("Column 1", "列 1"), t("Column 2", "列 2"), t("Column 3", "列 3")];

  return (
    <div className="grid-shell">
      <div
        className="grid-header"
        style={{ gridTemplateColumns, height: `${headerHeight}px` }}
        ref={headerRef}
      >
        <div
          className="cell header row-header"
          onMouseDown={(event) => {
            event.preventDefault();
            onClearSelection();
            setIsDraggingSelection(false);
          }}
          title={t("Clear selection", "清除选择")}
        >
          #
          <span
            className="resize-handle"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (onColumnResizeStartAll) {
                onColumnResizeStartAll(event.clientX);
              } else {
                onRowHeaderResizeStart(event.clientX);
              }
            }}
          />
          <span
            className="resize-handle-row"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRowHeightResizeStartAll(event.clientY);
            }}
          />
        </div>
        {columns.map((col, idx) => (
          <div
            key={idx}
            className={`cell header${isColInSelection(idx) ? " selected" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              updateSelection(
                { row: 0, col: idx },
                "col",
                { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey },
              );
              setIsDraggingSelection(true);
            }}
            onMouseEnter={() => {
              if (!isDraggingSelection || selectionMode !== "col") return;
              updateSelection({ row: 0, col: idx }, "col", { shift: true, ctrl: false });
            }}
          >
            {col}
            <span
              className="resize-handle"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onColumnResizeStart(idx, event.clientX);
              }}
            />
            <span
              className="resize-handle-row"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onHeaderRowHeightResizeStart(event.clientY);
              }}
            />
          </div>
        ))}
      </div>

      <div className="grid-body" ref={parentRef} onScroll={handleBodyScroll}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowIndex = getRowIndex(virtualRow.index);
            if (rowIndex === null || rowIndex === undefined) {
              return null;
            }
            const rowLoaded = isRowLoaded(rowIndex);
            return (
              <div
                key={virtualRow.key}
                className="grid-row"
                ref={rowVirtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns,
                  height: `${getRowHeight(rowIndex)}px`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                }}
              >
                <div
                  className={`cell row-header${isRowInSelection(rowIndex) ? " selected" : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    updateSelection(
                      { row: rowIndex, col: 0 },
                      "row",
                      { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey },
                    );
                    setIsDraggingSelection(true);
                  }}
                  onMouseEnter={() => {
                    if (!isDraggingSelection || selectionMode !== "row") return;
                    updateSelection({ row: rowIndex, col: 0 }, "row", { shift: true, ctrl: false });
                  }}
                >
                  {rowIndex + 1}
                  <span
                    className="resize-handle"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRowHeaderResizeStart(event.clientX);
                    }}
                  />
                  <span
                    className="resize-handle-row"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRowHeightResizeStartRow(rowIndex, event.clientY);
                    }}
                  />
                </div>
                {(headers.length ? headers : new Array(3).fill("")).map((_, colIdx) => {
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIdx;
                  const key = `${rowIndex}:${colIdx}`;
                  const isPatched = patches[key] !== undefined;
                  const isSelected = isCellInSelection(rowIndex, colIdx);
                  return (
                    <div
                      key={colIdx}
                      className={`cell${isEditing ? " editing" : ""}${isPatched ? " edited" : ""}${isSelected ? " selected" : ""}`}
                      onDoubleClick={() => {
                        if (rowLoaded) startEditing(rowIndex, colIdx);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        updateSelection(
                          { row: rowIndex, col: colIdx },
                          "cell",
                          { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey },
                        );
                        setIsDraggingSelection(true);
                      }}
                      onMouseEnter={() => {
                        if (!isDraggingSelection || selectionMode !== "cell") return;
                        updateSelection({ row: rowIndex, col: colIdx }, "cell", { shift: true, ctrl: false });
                      }}
                    >
                      <span
                        className="resize-handle"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onColumnResizeStart(colIdx, event.clientX);
                        }}
                      />
                      <span
                        className="resize-handle-row"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onRowHeightResizeStartRow(rowIndex, event.clientY);
                        }}
                      />
                      {isEditing ? (
                        <input
                          value={editingCell?.value ?? ""}
                          onChange={(event) =>
                            setEditingCell((current) =>
                              current ? { ...current, value: event.target.value } : current,
                            )
                          }
                          onBlur={commitEditing}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitEditing();
                            }
                            if (event.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        rowLoaded ? getCellValue(rowIndex, colIdx) : ""
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
