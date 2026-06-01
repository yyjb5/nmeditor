import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { GridViewProps } from "./types";

const IN_FILTER_PREFIX = "@in-json:";
const HEADER_FILTER_PAGE_SIZE = 120;

function decodeInFilterValue(value: string): string[] | null {
  if (!value.startsWith(IN_FILTER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(IN_FILTER_PREFIX.length));
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function encodeInFilterValue(values: string[]): string {
  return `${IN_FILTER_PREFIX}${JSON.stringify(values)}`;
}

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
  onGridKeyDown,
  onGridFocusChange,
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
  activeRange,
  hiddenCols,
  updateSelection,
  setIsDraggingSelection,
  isDraggingSelection,
  selectionMode,
  onAutoFillSelection,
  freezeFirstCol,
  freezeFirstRow,
  frozenFirstRowValues,
  filteredColumns,
  totalRows,
  windowStart = 0,
  loadedRowCount,
  delimiter,
  delimiterApplied,
  eof,
  indexRunning,
  globalViewLoading,
  sortRuleCount = 0,
  filterRuleCount = 0,
  patchCount,
  headerFilterValues,
  onHeaderFilterApply,
  onHeaderFilterClear,
  onHeaderFilterListValues,
  filterBusy,
  t,
}: GridViewProps) {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const headerFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const fillDragRef = useRef<{
    source: NonNullable<GridViewProps["activeRange"]>;
    target: { row: number; col: number };
  } | null>(null);
  const [horizontalState, setHorizontalState] = useState({ scrollLeft: 0, viewportWidth: 0 });
  const [fillDrag, setFillDrag] = useState<{
    source: NonNullable<GridViewProps["activeRange"]>;
    target: { row: number; col: number };
  } | null>(null);
  const [headerFilterMenu, setHeaderFilterMenu] = useState<{
    col: number;
    value: string;
    mode: "contains" | "values";
    selectedValues: string[];
    valueQuery: string;
    valueOffset: number;
  } | null>(null);
  const [headerFilterListState, setHeaderFilterListState] = useState<{
    values: Array<{ value: string; count: number }>;
    hasMore: boolean;
    truncated: boolean;
    scannedRows: number;
    loading: boolean;
    error: string | null;
  }>({
    values: [],
    hasMore: false,
    truncated: false,
    scannedRows: 0,
    loading: false,
    error: null,
  });
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

  useEffect(() => {
    fillDragRef.current = fillDrag;
  }, [fillDrag]);

  useEffect(() => {
    if (!headerFilterMenu) return;
    const handleWindowMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && headerFilterMenuRef.current?.contains(target)) {
        return;
      }
      setHeaderFilterMenu(null);
    };
    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => window.removeEventListener("mousedown", handleWindowMouseDown);
  }, [headerFilterMenu]);

  useEffect(() => {
    if (!fillDrag) return;
    const handleMouseUp = () => {
      const current = fillDragRef.current;
      setFillDrag(null);
      if (!current || !onAutoFillSelection) return;
      const unchanged =
        current.source.endRow === current.target.row &&
        current.source.endCol === current.target.col;
      if (unchanged) return;
      onAutoFillSelection(current.source, current.target);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [fillDrag, onAutoFillSelection]);

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
    if (freezeFirstCol && !hiddenCols.has(0) && !indices.includes(0)) {
      indices.unshift(0);
    }
    if (indices.length) return indices;
    for (let idx = 0; idx < columnCount; idx += 1) {
      if (!hiddenCols.has(idx)) return [idx];
    }
    return [];
  }, [columnCount, columnWidths, freezeFirstCol, hiddenCols, horizontalState, rowHeaderWidth]);
  const activeLabel = activeCell
    ? `${t("R", "行")}${activeCell.row + 1} ${t("C", "列")}${activeCell.col + 1}`
    : null;
  const activeValue =
    activeCell ? getCellValue(activeCell.row, activeCell.col) : "";
  const effectiveLoadedRows = loadedRowCount ?? rowVirtualizer.getVirtualItems().length;
  const loadedStart = effectiveLoadedRows > 0 ? windowStart + 1 : 0;
  const loadedEnd = effectiveLoadedRows > 0 ? windowStart + effectiveLoadedRows : 0;
  const totalRowsLabel =
    totalRows !== undefined && totalRows !== null
      ? totalRows.toLocaleString()
      : eof
        ? loadedEnd.toLocaleString()
        : t("unknown", "未知");
  const loadedRowsLabel = effectiveLoadedRows
    ? `${loadedStart.toLocaleString()}-${loadedEnd.toLocaleString()}`
    : "0";
  const delimiterLabel = delimiterApplied ?? delimiter ?? ",";
  const activeRuleCount = sortRuleCount + filterRuleCount;
  const effectivePatchCount = patchCount ?? Object.keys(patches).length;

  const openHeaderFilterMenu = useCallback(
    (col: number) => {
      const baseValue = headerFilterValues?.[col] ?? "";
      const selectedValues = decodeInFilterValue(baseValue);
      setHeaderFilterMenu((current) =>
        current?.col === col
          ? null
          : {
              col,
              value: selectedValues ? "" : baseValue,
              mode: selectedValues ? "values" : "contains",
              selectedValues: selectedValues ?? [],
              valueQuery: "",
              valueOffset: 0,
            },
      );
    },
    [headerFilterValues],
  );

  useEffect(() => {
    if (!headerFilterMenu || headerFilterMenu.mode !== "values") {
      setHeaderFilterListState({
        values: [],
        hasMore: false,
        truncated: false,
        scannedRows: 0,
        loading: false,
        error: null,
      });
      return;
    }
    if (!onHeaderFilterListValues) {
      return;
    }
    let canceled = false;
    setHeaderFilterListState((current) => ({
      ...current,
      values: headerFilterMenu.valueOffset === 0 ? [] : current.values,
      loading: true,
      error: null,
    }));
    void onHeaderFilterListValues(
      headerFilterMenu.col,
      headerFilterMenu.valueQuery,
      HEADER_FILTER_PAGE_SIZE,
      headerFilterMenu.valueOffset,
    )
      .then((result) => {
        if (canceled) return;
        setHeaderFilterListState((current) => {
          const appended =
            headerFilterMenu.valueOffset === 0
              ? result.values
              : [
                  ...current.values,
                  ...result.values.filter(
                    (item) => !current.values.some((existing) => existing.value === item.value),
                  ),
                ];
          return {
            values: appended,
            hasMore: result.hasMore,
            truncated: result.truncated,
            scannedRows: result.scannedRows,
            loading: false,
            error: null,
          };
        });
      })
      .catch((err) => {
        if (canceled) return;
        setHeaderFilterListState((current) => ({
          ...current,
          loading: false,
          error: String(err),
        }));
      });
    return () => {
      canceled = true;
    };
  }, [headerFilterMenu, onHeaderFilterListValues]);

  const toggleHeaderFilterValue = useCallback((value: string) => {
    setHeaderFilterMenu((current) => {
      if (!current) return current;
      const next = new Set(current.selectedValues);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...current, selectedValues: Array.from(next) };
    });
  }, []);

  const applyHeaderFilter = useCallback(() => {
    if (!headerFilterMenu || !onHeaderFilterApply) return;
    if (headerFilterMenu.mode === "values") {
      if (!headerFilterMenu.selectedValues.length) return;
      onHeaderFilterApply(
        headerFilterMenu.col,
        encodeInFilterValue(headerFilterMenu.selectedValues),
      );
    } else {
      onHeaderFilterApply(headerFilterMenu.col, headerFilterMenu.value);
    }
    setHeaderFilterMenu(null);
  }, [headerFilterMenu, onHeaderFilterApply]);

  const clearHeaderFilter = useCallback(() => {
    if (!headerFilterMenu || !onHeaderFilterClear) return;
    onHeaderFilterClear(headerFilterMenu.col);
    setHeaderFilterMenu(null);
  }, [headerFilterMenu, onHeaderFilterClear]);

  const frozenRowIndex = 0;
  const frozenRowHeight = freezeFirstRow ? getRowHeight(frozenRowIndex) : 0;
  const virtualBodyHeight = Math.max(rowVirtualizer.getTotalSize() - frozenRowHeight, 0);
  const frozenRowLoaded = Boolean(frozenFirstRowValues) || isRowLoaded(frozenRowIndex);

  return (
    <div className={`grid-shell${fillDrag ? " fill-dragging" : ""}`}>
      <div className="grid-info">
        <div className="grid-info-group primary">
          <span className="grid-info-label">{t("Window", "窗口")}</span>
          <span className="grid-info-pos">
            {loadedRowsLabel}
            {" / "}
            {totalRowsLabel}
          </span>
        </div>
        <div className="grid-info-group">
          <span className="grid-info-label">{t("Columns", "列")}</span>
          <span className="grid-info-pos">{columnCount.toLocaleString()}</span>
        </div>
        <div className="grid-info-group">
          <span className="grid-info-label">{t("Delimiter", "分隔符")}</span>
          <span className="grid-info-pos">{delimiterLabel}</span>
        </div>
        {activeRuleCount ? (
          <div className="grid-info-group active">
            <span className="grid-info-label">{t("View rules", "视图规则")}</span>
            <span className="grid-info-pos">
              {t(
                `${sortRuleCount} sort · ${filterRuleCount} filter`,
                `${sortRuleCount} 排序 · ${filterRuleCount} 筛选`,
              )}
            </span>
          </div>
        ) : null}
        {effectivePatchCount ? (
          <div className="grid-info-group dirty">
            <span className="grid-info-label">{t("Unsaved", "未保存")}</span>
            <span className="grid-info-pos">{effectivePatchCount.toLocaleString()}</span>
          </div>
        ) : null}
        {indexRunning || globalViewLoading ? (
          <div className="grid-info-group active">
            <span className="grid-info-label">
              {globalViewLoading ? t("Applying", "正在应用") : t("Index", "索引")}
            </span>
            <span className="grid-info-pos">
              {globalViewLoading ? t("sort/filter", "排序/筛选") : t("running", "运行中")}
            </span>
          </div>
        ) : null}
        {activeLabel ? (
          <div className="grid-info-group cell-context">
            <span className="grid-info-label">{t("Cell", "单元格")}</span>
            <span className="grid-info-pos">{activeLabel}</span>
            <span className="grid-info-value">{activeValue}</span>
          </div>
        ) : null}
      </div>
      <div
        className="grid-header"
        style={{ gridTemplateColumns, height: `${headerHeight}px` }}
        ref={headerRef}
      >
        <div
          className={`cell header row-header${freezeFirstCol ? " freeze-left" : ""}`}
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
          const hasFilter = filteredColumns?.has(idx) ?? false;
          const menuOpen = headerFilterMenu?.col === idx;
          const freezeThisColumn = Boolean(freezeFirstCol && idx === 0 && !hiddenCols.has(idx));
          return (
          <div
            key={idx}
            className={`cell header${isColInSelection(idx) ? " selected" : ""}${hiddenCols.has(idx) ? " hidden-col" : ""}${freezeThisColumn ? " freeze-col" : ""}`}
            style={{
              gridColumn: `${idx + 2}`,
              left: freezeThisColumn ? `${rowHeaderWidth}px` : undefined,
            }}
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
                  event.stopPropagation();
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
              <>
                <span className="header-label">{col}</span>
                {onHeaderFilterApply ? (
                  <button
                    type="button"
                    className={`header-filter-trigger${hasFilter ? " active" : ""}`}
                    title={
                      hasFilter
                        ? t("Edit column filter", "编辑列筛选")
                        : t("Add column filter", "添加列筛选")
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openHeaderFilterMenu(idx);
                    }}
                  >
                    F
                  </button>
                ) : null}
                {menuOpen ? (
                  <div
                    ref={headerFilterMenuRef}
                    className="header-filter-menu"
                    onMouseDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <div className="header-filter-title">
                      {t("Column filter", "列筛选")} {idx + 1}
                    </div>
                    <div className="header-filter-mode">
                      <button
                        type="button"
                        className={headerFilterMenu?.mode === "contains" ? "active" : ""}
                        onClick={() =>
                          setHeaderFilterMenu((current) =>
                            current ? { ...current, mode: "contains", valueOffset: 0 } : current,
                          )
                        }
                      >
                        {t("Contains", "包含")}
                      </button>
                      <button
                        type="button"
                        className={headerFilterMenu?.mode === "values" ? "active" : ""}
                        onClick={() =>
                          setHeaderFilterMenu((current) =>
                            current ? { ...current, mode: "values", valueOffset: 0 } : current,
                          )
                        }
                      >
                        {t("Values", "值列表")}
                      </button>
                    </div>
                    {headerFilterMenu?.mode === "contains" ? (
                      <input
                        value={headerFilterMenu?.value ?? ""}
                        placeholder={t("contains...", "包含...")}
                        autoFocus
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setHeaderFilterMenu((current) =>
                            current ? { ...current, value: nextValue } : current,
                          );
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            applyHeaderFilter();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setHeaderFilterMenu(null);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <input
                          value={headerFilterMenu?.valueQuery ?? ""}
                          placeholder={t("search values...", "搜索值...")}
                          autoFocus
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setHeaderFilterMenu((current) =>
                              current
                                ? { ...current, valueQuery: nextValue, valueOffset: 0 }
                                : current,
                            );
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setHeaderFilterMenu(null);
                            }
                          }}
                        />
                        <div className="header-filter-hint">
                          {t("Values from full file/view", "值来源于全文件或全局视图")}
                        </div>
                        <div className="header-filter-values">
                          {headerFilterListState.values.length ? (
                            headerFilterListState.values.map((item) => {
                              const checked = headerFilterMenu?.selectedValues.includes(item.value);
                              return (
                                <label key={item.value} className="header-filter-value-item">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleHeaderFilterValue(item.value)}
                                  />
                                  <span className="header-filter-value-text">{item.value}</span>
                                  <span className="header-filter-value-count">{item.count}</span>
                                </label>
                              );
                            })
                          ) : (
                            <div className="header-filter-empty">
                              {headerFilterListState.loading
                                ? t("Loading values...", "正在加载值...")
                                : t("No values", "暂无可选值")}
                            </div>
                          )}
                        </div>
                        <div className="header-filter-hint">
                          {t(
                            `Scanned ${headerFilterListState.scannedRows} rows`,
                            `已扫描 ${headerFilterListState.scannedRows} 行`,
                          )}
                          {headerFilterListState.truncated
                            ? t(" · list truncated", " · 列表已截断")
                            : ""}
                        </div>
                        {headerFilterListState.error ? (
                          <div className="header-filter-empty">{headerFilterListState.error}</div>
                        ) : null}
                        {headerFilterListState.hasMore ? (
                          <button
                            type="button"
                            className="header-filter-load-more"
                            disabled={headerFilterListState.loading}
                            onClick={() =>
                              setHeaderFilterMenu((current) =>
                                current
                                  ? {
                                      ...current,
                                      valueOffset: current.valueOffset + HEADER_FILTER_PAGE_SIZE,
                                    }
                                  : current,
                              )
                            }
                          >
                            {headerFilterListState.loading
                              ? t("Loading...", "加载中...")
                              : t("Load more", "加载更多")}
                          </button>
                        ) : null}
                      </>
                    )}
                    <div className="header-filter-actions">
                      <button
                        type="button"
                        disabled={
                          filterBusy ||
                          (headerFilterMenu?.mode === "values"
                            ? !(headerFilterMenu?.selectedValues.length ?? 0)
                            : !(headerFilterMenu?.value.trim() ?? ""))
                        }
                        onClick={applyHeaderFilter}
                      >
                        {t("Apply", "应用")}
                      </button>
                      <button
                        type="button"
                        disabled={filterBusy || !hasFilter}
                        onClick={clearHeaderFilter}
                      >
                        {t("Clear", "清除")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
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

      <div
        className="grid-body"
        ref={parentRef}
        onScroll={handleBodyScroll}
        onKeyDown={onGridKeyDown}
        onFocus={(event) => {
          const previous = event.relatedTarget as Node | null;
          if (previous && event.currentTarget.contains(previous)) return;
          onGridFocusChange?.(true);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          onGridFocusChange?.(false);
        }}
        onMouseDownCapture={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest(".resize-handle, .resize-handle-row, .fill-handle")) {
            return;
          }
          parentRef.current?.focus();
        }}
        tabIndex={0}
      >
        {freezeFirstRow ? (
          <div
            className="grid-row freeze-top"
            style={{
              gridTemplateColumns,
              height: `${getRowHeight(frozenRowIndex)}px`,
            }}
          >
            <div
              className={`cell row-header${isRowInSelection(frozenRowIndex) ? " selected" : ""}${freezeFirstCol ? " freeze-left" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                updateSelection(
                  { row: frozenRowIndex, col: 0 },
                  "row",
                  { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey },
                );
                setIsDraggingSelection(true);
              }}
              onMouseEnter={() => {
                if (!isDraggingSelection || selectionMode !== "row") return;
                updateSelection({ row: frozenRowIndex, col: 0 }, "row", { shift: true, ctrl: false });
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                onRowHeaderContextMenu(frozenRowIndex, event);
              }}
            >
              {frozenRowIndex + 1}
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
                  onRowHeightResizeStartRow(frozenRowIndex, event.clientY);
                }}
              />
            </div>
            {visibleColumnIndices.map((colIdx) => {
              const isEditing = editingCell?.row === frozenRowIndex && editingCell?.col === colIdx;
              const key = `${frozenRowIndex}:${colIdx}`;
              const isPatched = patches[key] !== undefined;
              const isSelected = isCellInSelection(frozenRowIndex, colIdx);
              const isActive = activeCell?.row === frozenRowIndex && activeCell?.col === colIdx;
              const isHidden = hiddenCols.has(colIdx);
              const isFillHandleHost =
                !isHidden &&
                !isEditing &&
                selectionMode === "cell" &&
                Boolean(activeRange) &&
                activeRange?.endRow === frozenRowIndex &&
                activeRange?.endCol === colIdx;
              return (
                <div
                  key={`frozen-${colIdx}`}
                  className={`cell${isEditing ? " editing" : ""}${isPatched ? " edited" : ""}${isSelected ? " selected" : ""}${isActive ? " active" : ""}${isHidden ? " hidden-col" : ""}${freezeFirstCol && colIdx === 0 && !isHidden ? " freeze-col" : ""}`}
                  style={{
                    gridColumn: `${colIdx + 2}`,
                    left:
                      freezeFirstCol && colIdx === 0 && !isHidden
                        ? `${rowHeaderWidth}px`
                        : undefined,
                  }}
                  onDoubleClick={() => {
                    if (isRowLoaded(frozenRowIndex) && !isHidden) startEditing(frozenRowIndex, colIdx);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    updateSelection(
                      { row: frozenRowIndex, col: colIdx },
                      "cell",
                      { shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey },
                    );
                    setIsDraggingSelection(true);
                  }}
                  onMouseEnter={() => {
                    if (fillDrag) {
                      setFillDrag((current) =>
                        current
                          ? { ...current, target: { row: frozenRowIndex, col: colIdx } }
                          : current,
                      );
                      return;
                    }
                    if (!isDraggingSelection || selectionMode !== "cell") return;
                    updateSelection({ row: frozenRowIndex, col: colIdx }, "cell", { shift: true, ctrl: false });
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
                      onRowHeightResizeStartRow(frozenRowIndex, event.clientY);
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
                        event.stopPropagation();
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
                    isRowLoaded(frozenRowIndex)
                      ? getCellValue(frozenRowIndex, colIdx)
                      : frozenRowLoaded
                        ? (frozenFirstRowValues?.[colIdx] ?? "")
                        : ""
                  )}
                  {isFillHandleHost ? (
                    <span
                      className="fill-handle"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!activeRange) return;
                        const source = {
                          startRow: activeRange.startRow,
                          endRow: activeRange.endRow,
                          startCol: activeRange.startCol,
                          endCol: activeRange.endCol,
                        };
                        setFillDrag({ source, target: { row: source.endRow, col: source.endCol } });
                      }}
                      title={t("Drag to autofill", "拖拽自动填充")}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
        <div style={{ height: `${virtualBodyHeight}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowIndex = getRowIndex(virtualRow.index);
            if (rowIndex === null || rowIndex === undefined) {
              return null;
            }
            if (freezeFirstRow && rowIndex === frozenRowIndex) {
              return null;
            }
            const rowTop =
              freezeFirstRow && rowIndex > frozenRowIndex
                ? Math.max(virtualRow.start - frozenRowHeight, 0)
                : virtualRow.start;
            const rowLoaded = isRowLoaded(rowIndex);
            return (
              <div
                key={virtualRow.key}
                className="grid-row"
                style={{
                  transform: `translateY(${rowTop}px)`,
                  gridTemplateColumns,
                  height: `${getRowHeight(rowIndex)}px`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                }}
              >
                <div
                  className={`cell row-header${isRowInSelection(rowIndex) ? " selected" : ""}${freezeFirstCol ? " freeze-left" : ""}`}
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
                  const isFillHandleHost =
                    !isHidden &&
                    !isEditing &&
                    selectionMode === "cell" &&
                    Boolean(activeRange) &&
                    activeRange?.endRow === rowIndex &&
                    activeRange?.endCol === colIdx;
                  return (
                    <div
                      key={colIdx}
                      className={`cell${isEditing ? " editing" : ""}${isPatched ? " edited" : ""}${isSelected ? " selected" : ""}${isActive ? " active" : ""}${isHidden ? " hidden-col" : ""}${freezeFirstCol && colIdx === 0 && !isHidden ? " freeze-col" : ""}`}
                      style={{
                        gridColumn: `${colIdx + 2}`,
                        left:
                          freezeFirstCol && colIdx === 0 && !isHidden
                            ? `${rowHeaderWidth}px`
                            : undefined,
                      }}
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
                        if (fillDrag) {
                          setFillDrag((current) =>
                            current
                              ? { ...current, target: { row: rowIndex, col: colIdx } }
                              : current,
                          );
                          return;
                        }
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
                            event.stopPropagation();
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
                      {isFillHandleHost ? (
                        <span
                          className="fill-handle"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!activeRange) return;
                            const source = {
                              startRow: activeRange.startRow,
                              endRow: activeRange.endRow,
                              startCol: activeRange.startCol,
                              endCol: activeRange.endCol,
                            };
                            setFillDrag({ source, target: { row: source.endRow, col: source.endCol } });
                          }}
                          title={t("Drag to autofill", "拖拽自动填充")}
                        />
                      ) : null}
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
