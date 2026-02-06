import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { GridViewProps } from "./types";

export default function GridView({
  headers,
  columnCount,
  columnWidths,
  rowHeaderWidth,
  gridTemplateColumns,
  isRowLoaded,
  getRowIndex,
  onColumnResizeStart,
  onColumnResizeStartAll,
  onRowHeaderResizeStart,
  onRowHeightResizeStartAll,
  onRowHeightResizeStartRow,
  onHeaderRowHeightResizeStart,
  onBodyScroll,
  onRowHeaderContextMenu,
  onColumnHeaderContextMenu,
  editingHeader,
  setEditingHeader,
  commitHeaderEditing,
  cancelHeaderEditing,
  onHeaderDoubleClick,
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
  activeCell,
  hiddenCols,
  updateSelection,
  setIsDraggingSelection,
  isDraggingSelection,
  selectionMode,
  t,
}: GridViewProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [horizontalState, setHorizontalState] = useState({ scrollLeft: 0, viewportWidth: 0 });
  const handleBodyScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollLeft, clientWidth } = event.currentTarget;
      setHorizontalState((current) => {
        if (current.scrollLeft === scrollLeft && current.viewportWidth === clientWidth) {
          return current;
        }
        return { scrollLeft, viewportWidth: clientWidth };
      });
      if (headerRef.current) {
        headerRef.current.scrollLeft = scrollLeft;
      }
      if (onBodyScroll) {
        onBodyScroll(event);
      }
    },
    [onBodyScroll],
  );

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const update = () => {
      setHorizontalState({
        scrollLeft: element.scrollLeft,
        viewportWidth: element.clientWidth,
      });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => observer.disconnect();
  }, [parentRef]);

  const columns = useMemo(() => {
    if (!headers.length) {
      return new Array(columnCount).fill(null).map((_, idx) =>
        t(`Column ${idx + 1}`, `列 ${idx + 1}`),
      );
    }
    if (headers.length >= columnCount) {
      return headers.slice(0, columnCount);
    }
    const next = [...headers];
    for (let idx = headers.length; idx < columnCount; idx += 1) {
      next.push(t(`Column ${idx + 1}`, `列 ${idx + 1}`));
    }
    return next;
  }, [headers, columnCount, t]);
  const visibleColumnIndices = useMemo(() => {
    const overscanPx = 480;
    const contentScrollLeft = Math.max(0, horizontalState.scrollLeft - rowHeaderWidth);
    const viewportWidth = Math.max(horizontalState.viewportWidth, 320);
    const minX = Math.max(0, contentScrollLeft - overscanPx);
    const maxX = contentScrollLeft + viewportWidth + overscanPx;

    const indices: number[] = [];
    let offset = 0;
    for (let idx = 0; idx < columnCount; idx += 1) {
      const width = hiddenCols.has(idx) ? 0 : Math.max(columnWidths[idx] ?? 140, 0);
      const end = offset + width;
      if (width > 0 && end >= minX && offset <= maxX) {
        indices.push(idx);
      }
      offset = end;
    }
    if (indices.length) return indices;
    for (let idx = 0; idx < columnCount; idx += 1) {
      if (!hiddenCols.has(idx)) return [idx];
    }
    return [];
  }, [columnCount, columnWidths, hiddenCols, horizontalState, rowHeaderWidth]);
  const activeLabel = activeCell
    ? `${t("R", "行")}${activeCell.row + 1} ${t("C", "列")}${activeCell.col + 1}`
    : null;
  const activeValue =
    activeCell ? getCellValue(activeCell.row, activeCell.col) : "";

  return (
    <div className="grid-shell">
      {activeLabel ? (
        <div className="grid-info">
          <span className="grid-info-label">{t("Active cell", "活动单元格")}</span>
          <span className="grid-info-pos">{activeLabel}</span>
          <span className="grid-info-value">{activeValue}</span>
        </div>
      ) : null}
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
        {visibleColumnIndices.map((idx) => {
          const col = columns[idx] ?? "";
          return (
          <div
            key={idx}
            className={`cell header${isColInSelection(idx) ? " selected" : ""}${hiddenCols.has(idx) ? " hidden-col" : ""}`}
            style={{ gridColumn: `${idx + 2}` }}
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
            onContextMenu={(event) => {
              event.preventDefault();
              onColumnHeaderContextMenu(idx, event);
            }}
            onDoubleClick={() => onHeaderDoubleClick(idx)}
          >
            {hiddenCols.has(idx) ? null : editingHeader?.index === idx ? (
              <input
                value={editingHeader.value}
                onChange={(event) =>
                  setEditingHeader((current) =>
                    current ? { ...current, value: event.target.value } : current,
                  )
                }
                onBlur={commitHeaderEditing}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitHeaderEditing();
                  }
                  if (event.key === "Escape") {
                    cancelHeaderEditing();
                  }
                }}
                autoFocus
              />
            ) : (
              col
            )}
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
        );
        })}
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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onRowHeaderContextMenu(rowIndex, event);
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
                {visibleColumnIndices.map((colIdx) => {
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIdx;
                  const key = `${rowIndex}:${colIdx}`;
                  const isPatched = patches[key] !== undefined;
                  const isSelected = isCellInSelection(rowIndex, colIdx);
                  const isActive =
                    activeCell?.row === rowIndex && activeCell?.col === colIdx;
                  const isHidden = hiddenCols.has(colIdx);
                  return (
                    <div
                      key={colIdx}
                      className={`cell${isEditing ? " editing" : ""}${isPatched ? " edited" : ""}${isSelected ? " selected" : ""}${isActive ? " active" : ""}${isHidden ? " hidden-col" : ""}`}
                      style={{ gridColumn: `${colIdx + 2}` }}
                      onDoubleClick={() => {
                        if (rowLoaded && !isHidden) startEditing(rowIndex, colIdx);
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
                      {isHidden ? null : isEditing ? (
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
