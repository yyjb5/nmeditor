import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import "./styles.css";
import type { MacroOp, PanelsProps } from "./types";

const IN_FILTER_PREFIX = "@in-json:";
const FIND_RESULTS_BATCH_SIZE = 120;
const FIND_RESULTS_VIRTUAL_ITEM_HEIGHT = 34;
const FIND_RESULTS_VIRTUAL_OVERSCAN = 8;

export default function Panels({
  showMacroPanel,
  showOpsPanel,
  showExportPanel,
  showFindPanel,
  showStatsPanel,
  macroOp,
  macroColumn,
  macroFind,
  macroReplace,
  macroText,
  macroScope,
  macroOutputPath,
  onMacroOpChange,
  onMacroColumnChange,
  onMacroFindChange,
  onMacroReplaceChange,
  onMacroTextChange,
  onMacroScopeChange,
  onRunMacro,
  rowIndexInput,
  columnIndexInput,
  columnNameInput,
  onRowIndexChange,
  onColumnIndexChange,
  onColumnNameChange,
  onInsertRow,
  onDeleteRow,
  onCopySelection,
  onPasteSelection,
  pasteMode,
  onPasteModeChange,
  columnSearch,
  onColumnSearchChange,
  hiddenCols,
  onToggleColumnHidden,
  onShowAllColumns,
  onHideAllColumns,
  onMoveColumnUp,
  onMoveColumnDown,
  importSkipRows,
  onImportSkipRowsChange,
  importFirstRowHeader,
  onImportFirstRowHeaderChange,
  onInsertColumn,
  onDeleteColumn,
  onRenameColumn,
  sortColumnInput,
  sortDirection,
  filterColumnInput,
  filterText,
  onSortColumnChange,
  onSortDirectionChange,
  onFilterColumnChange,
  onFilterTextChange,
  onAddSortRule,
  onAddFilterRule,
  onClearSortFilter,
  sortRules,
  filterRules,
  onRemoveSortRule,
  onRemoveFilterRule,
  encodingMode,
  eolMode,
  includeBom,
  dialectDelimiter,
  dialectQuote,
  dialectEscape,
  onEncodingModeChange,
  onEolModeChange,
  onIncludeBomChange,
  onDialectDelimiterChange,
  onDialectQuoteChange,
  onDialectEscapeChange,
  findText,
  replaceText,
  findScope,
  findColumnInput,
  findStartRow,
  findEndRow,
  useRegex,
  matchCase,
  findOutputPath,
  findMatches,
  activeFindMatchIndex,
  findMatchesSource,
  findMatchesHasMore,
  findRunning,
  findProgress,
  findCanceled,
  findMatchedCount,
  findScannedRows,
  findElapsedMs,
  onFindTextChange,
  onReplaceTextChange,
  onFindScopeChange,
  onFindColumnChange,
  onFindStartRowChange,
  onFindEndRowChange,
  onUseRegexChange,
  onMatchCaseChange,
  onFindMatches,
  onFindPrev,
  onFindNext,
  onFindClear,
  onFindCancel,
  onFindJump,
  onApplyFindReplace,
  columnStats,
  fullStats,
  fullStatsLoading,
  onRunFullStats,
  loading,
  sortFilterActive,
  sortFilterMemoryLimitText,
  onSortFilterMemoryLimitTextChange,
  onSortFilterMemoryLimitCommit,
  forceExternalSort,
  onForceExternalSortChange,
  autoIndexMode,
  onAutoIndexModeChange,
  columnSelectOptions,
  hasPreview,
  t,
}: PanelsProps) {
  const [showAllColumnsList, setShowAllColumnsList] = useState(false);
  const [findResultsVisibleCount, setFindResultsVisibleCount] = useState(FIND_RESULTS_BATCH_SIZE);
  const [findResultsPanelStart, setFindResultsPanelStart] = useState(0);
  const [findResultsScrollTop, setFindResultsScrollTop] = useState(0);
  const [findResultsViewportHeight, setFindResultsViewportHeight] = useState(220);
  const [findHitJumpInput, setFindHitJumpInput] = useState("1");
  const findResultsListRef = useRef<HTMLDivElement | null>(null);
  const columnQuery = columnSearch.trim().toLowerCase();
  const filteredColumns = useMemo(() => {
    if (!columnQuery) return columnSelectOptions;
    return columnSelectOptions.filter(
      (option) => option.label.toLowerCase().includes(columnQuery) || option.value === columnQuery,
    );
  }, [columnQuery, columnSelectOptions]);
  const columnListLimit = 200;
  const showColumnLimitHint =
    !columnQuery && filteredColumns.length > columnListLimit && !showAllColumnsList;
  const visibleColumns = showAllColumnsList || columnQuery
    ? filteredColumns
    : filteredColumns.slice(0, columnListLimit);
  const columnLabelByValue = useMemo(() => {
    const map = new Map<string, string>();
    columnSelectOptions.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [columnSelectOptions]);
  const formatFilterRuleValue = (raw: string) => {
    if (!raw.startsWith(IN_FILTER_PREFIX)) return `"${raw}"`;
    try {
      const parsed = JSON.parse(raw.slice(IN_FILTER_PREFIX.length));
      if (!Array.isArray(parsed)) return `"${raw}"`;
      const values = parsed.filter((item): item is string => typeof item === "string");
      if (!values.length) return t("0 values", "0 个值");
      const preview = values.slice(0, 3).join(", ");
      const suffix = values.length > 3 ? "..." : "";
      return t(
        `${values.length} values (${preview}${suffix})`,
        `${values.length} 个值（${preview}${suffix}）`,
      );
    } catch {
      return `"${raw}"`;
    }
  };
  const firstFindMatch = findMatches[0];
  const visibleFindMatches = findMatches.slice(0, findResultsVisibleCount);
  const findResultsPanelRange = useMemo(() => {
    const total = visibleFindMatches.length;
    if (!total) return { start: 0, end: 0 };
    const maxStart = Math.max(total - FIND_RESULTS_BATCH_SIZE, 0);
    const start = Math.max(0, Math.min(findResultsPanelStart, maxStart));
    return {
      start,
      end: Math.min(total, start + FIND_RESULTS_BATCH_SIZE),
    };
  }, [findResultsPanelStart, visibleFindMatches.length]);
  const visibleFindResultItems = useMemo(
    () =>
      visibleFindMatches
        .slice(findResultsPanelRange.start, findResultsPanelRange.end)
        .map((match, localIndex) => ({
          index: findResultsPanelRange.start + localIndex,
          match,
        })),
    [findResultsPanelRange.end, findResultsPanelRange.start, visibleFindMatches],
  );
  const virtualFindResultRange = useMemo(() => {
    const total = visibleFindResultItems.length;
    if (!total) return { start: 0, end: 0 };
    const start = Math.max(
      0,
      Math.floor(findResultsScrollTop / FIND_RESULTS_VIRTUAL_ITEM_HEIGHT) - FIND_RESULTS_VIRTUAL_OVERSCAN,
    );
    const viewportRows = Math.ceil(findResultsViewportHeight / FIND_RESULTS_VIRTUAL_ITEM_HEIGHT);
    const end = Math.min(
      total,
      start + viewportRows + FIND_RESULTS_VIRTUAL_OVERSCAN * 2,
    );
    return { start, end };
  }, [findResultsScrollTop, findResultsViewportHeight, visibleFindResultItems.length]);
  const virtualFindResultItems = useMemo(
    () => visibleFindResultItems.slice(virtualFindResultRange.start, virtualFindResultRange.end),
    [virtualFindResultRange.end, virtualFindResultRange.start, visibleFindResultItems],
  );
  const virtualFindTopSpacer = virtualFindResultRange.start * FIND_RESULTS_VIRTUAL_ITEM_HEIGHT;
  const virtualFindBottomSpacer = Math.max(
    0,
    (visibleFindResultItems.length - virtualFindResultRange.end) * FIND_RESULTS_VIRTUAL_ITEM_HEIGHT,
  );
  const findResultsPageInfo = useMemo(() => {
    const total = visibleFindMatches.length;
    if (!total) return { currentPage: 0, totalPages: 0 };
    return {
      currentPage: Math.floor(findResultsPanelRange.start / FIND_RESULTS_BATCH_SIZE) + 1,
      totalPages: Math.max(1, Math.ceil(total / FIND_RESULTS_BATCH_SIZE)),
    };
  }, [findResultsPanelRange.start, visibleFindMatches.length]);
  const canLoadMoreFindResults = visibleFindMatches.length < findMatches.length;
  const loadMoreFindResults = () => {
    if (!canLoadMoreFindResults) return;
    setFindResultsVisibleCount((prev) => Math.min(findMatches.length, prev + FIND_RESULTS_BATCH_SIZE));
  };
  const handleFindResultsScroll = (event: UIEvent<HTMLDivElement>) => {
    setFindResultsScrollTop(event.currentTarget.scrollTop);
    setFindResultsViewportHeight(event.currentTarget.clientHeight);
    if (!canLoadMoreFindResults) return;
    const node = event.currentTarget;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 24) {
      loadMoreFindResults();
    }
  };

  useEffect(() => {
    setFindResultsVisibleCount(FIND_RESULTS_BATCH_SIZE);
    setFindResultsPanelStart(0);
    setFindResultsScrollTop(0);
    setFindHitJumpInput("1");
  }, [findMatchesSource, firstFindMatch?.row, firstFindMatch?.col, firstFindMatch?.value]);

  useEffect(() => {
    if (!findMatches.length) return;
    if (activeFindMatchIndex < 0) return;
    setFindHitJumpInput(String(activeFindMatchIndex + 1));
    if (activeFindMatchIndex < findResultsVisibleCount) return;
    const nextVisible =
      Math.ceil((activeFindMatchIndex + 1) / FIND_RESULTS_BATCH_SIZE) * FIND_RESULTS_BATCH_SIZE;
    setFindResultsVisibleCount(Math.min(findMatches.length, nextVisible));
  }, [activeFindMatchIndex, findMatches.length, findResultsVisibleCount]);

  useEffect(() => {
    if (activeFindMatchIndex < 0) return;
    if (activeFindMatchIndex < findResultsPanelRange.start) {
      setFindResultsPanelStart(Math.floor(activeFindMatchIndex / FIND_RESULTS_BATCH_SIZE) * FIND_RESULTS_BATCH_SIZE);
      return;
    }
    if (activeFindMatchIndex >= findResultsPanelRange.end) {
      setFindResultsPanelStart(Math.floor(activeFindMatchIndex / FIND_RESULTS_BATCH_SIZE) * FIND_RESULTS_BATCH_SIZE);
    }
  }, [activeFindMatchIndex, findResultsPanelRange.end, findResultsPanelRange.start]);

  useEffect(() => {
    const node = findResultsListRef.current;
    if (!node) return;
    node.scrollTop = 0;
    setFindResultsScrollTop(0);
    setFindResultsViewportHeight(node.clientHeight || 220);
  }, [findResultsPanelStart]);

  useEffect(() => {
    const node = findResultsListRef.current;
    if (!node) return;
    if (activeFindMatchIndex < findResultsPanelRange.start || activeFindMatchIndex >= findResultsPanelRange.end) {
      return;
    }
    const localIndex = activeFindMatchIndex - findResultsPanelRange.start;
    if (localIndex < 0 || localIndex >= visibleFindResultItems.length) return;
    const targetTop = localIndex * FIND_RESULTS_VIRTUAL_ITEM_HEIGHT;
    const targetBottom = targetTop + FIND_RESULTS_VIRTUAL_ITEM_HEIGHT;
    if (targetTop < node.scrollTop) {
      node.scrollTop = targetTop;
      return;
    }
    if (targetBottom > node.scrollTop + node.clientHeight) {
      node.scrollTop = targetBottom - node.clientHeight;
    }
  }, [
    activeFindMatchIndex,
    findResultsPanelRange.end,
    findResultsPanelRange.start,
    visibleFindResultItems.length,
  ]);

  const jumpToFindHitInput = () => {
    if (!findMatches.length) return;
    const parsed = Number.parseInt(findHitJumpInput.trim(), 10);
    if (!Number.isFinite(parsed)) return;
    const target = Math.max(0, Math.min(findMatches.length - 1, parsed - 1));
    onFindJump(target);
  };

  const jumpToFirstFindHit = () => {
    if (!findMatches.length) return;
    onFindJump(0);
  };

  const jumpToLastFindHit = () => {
    if (!findMatches.length) return;
    onFindJump(findMatches.length - 1);
  };

  const goFindResultFirstPage = () => {
    setFindResultsPanelStart(0);
  };

  const goFindResultPrevPage = () => {
    setFindResultsPanelStart((prev) => Math.max(0, prev - FIND_RESULTS_BATCH_SIZE));
  };

  const goFindResultNextPage = () => {
    if (findResultsPanelRange.end >= visibleFindMatches.length && canLoadMoreFindResults) {
      loadMoreFindResults();
      setFindResultsPanelStart((prev) => prev + FIND_RESULTS_BATCH_SIZE);
      return;
    }
    setFindResultsPanelStart((prev) => {
      const maxStart = Math.max(visibleFindMatches.length - FIND_RESULTS_BATCH_SIZE, 0);
      return Math.min(maxStart, prev + FIND_RESULTS_BATCH_SIZE);
    });
  };

  const goFindResultLastPage = () => {
    const maxStart = Math.max(visibleFindMatches.length - FIND_RESULTS_BATCH_SIZE, 0);
    setFindResultsPanelStart(maxStart);
  };

  return (
    <>
      {showMacroPanel ? (
        <div className="macro-panel">
          <div className="macro-title">{t("Macro / Batch", "宏 / 批处理")}</div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Operation", "操作")}</span>
              <select value={macroOp} onChange={(e) => onMacroOpChange(e.target.value as MacroOp)}>
                <option value="replace">{t("Find & Replace", "查找替换")}</option>
                <option value="uppercase">{t("Uppercase", "转大写")}</option>
                <option value="lowercase">{t("Lowercase", "转小写")}</option>
                <option value="trim">{t("Trim", "去空格")}</option>
                <option value="prefix">{t("Add Prefix", "添加前缀")}</option>
                <option value="suffix">{t("Add Suffix", "添加后缀")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Column (0-based)", "列（从0开始）")}</span>
              <input value={macroColumn} onChange={(e) => onMacroColumnChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <label className="field">
              <span>{t("Scope", "范围")}</span>
              <select
                value={macroScope}
                onChange={(e) => onMacroScopeChange(e.target.value as "loaded" | "file")}
                data-testid="macro-scope-select"
              >
                <option value="loaded">{t("Loaded rows", "已加载行")}</option>
                <option value="file">{t("Full file", "全文件")}</option>
              </select>
            </label>
            {macroOp === "replace" ? (
              <>
                <label className="field">
                  <span>{t("Find", "查找")}</span>
                  <input value={macroFind} onChange={(e) => onMacroFindChange(e.target.value)} placeholder={t("old", "旧值")} />
                </label>
                <label className="field">
                  <span>{t("Replace", "替换")}</span>
                  <input value={macroReplace} onChange={(e) => onMacroReplaceChange(e.target.value)} placeholder={t("new", "新值")} />
                </label>
              </>
            ) : macroOp === "prefix" || macroOp === "suffix" ? (
              <label className="field">
                <span>{t("Text", "文本")}</span>
                <input value={macroText} onChange={(e) => onMacroTextChange(e.target.value)} placeholder={t("value", "值")} />
              </label>
            ) : null}
            <button onClick={onRunMacro} disabled={!hasPreview || loading}>
              {macroScope === "file" ? t("Run on full file", "运行（全文件）") : t("Run on loaded rows", "运行（已加载行）")}
            </button>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Import skip rows", "导入跳过行")}</span>
              <input
                value={importSkipRows}
                onChange={(e) => onImportSkipRowsChange(e.target.value)}
                placeholder={t("0", "0")}
                inputMode="numeric"
              />
            </label>
            <label className="field checkbox">
              <span>{t("First row as header", "首行作为列名")}</span>
              <input
                type="checkbox"
                checked={importFirstRowHeader}
                onChange={(e) => onImportFirstRowHeaderChange(e.target.checked)}
              />
            </label>
            <span className="macro-hint">
              {t("Applies when opening a new file.", "仅对新打开的文件生效。")}
            </span>
          </div>
          <div className="macro-hint">
            {macroScope === "file"
              ? t("Full file runs will export to a new file.", "全文件运行将导出到新文件。")
              : t("Loaded rows only. Switch scope to full file for all rows.", "仅对已加载行生效。如需全文件请选择全文件。")}
          </div>
          {macroOutputPath ? (
            <div className="macro-output">
              {t("Saved", "已保存")}: {macroOutputPath}
            </div>
          ) : null}
        </div>
      ) : null}

      {showOpsPanel ? (
        <div className="ops-panel">
          <div className="macro-title">{t("Column / Sort / Filter (full file)", "列 / 排序 / 筛选（全文件）")}</div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Row index", "行索引")}</span>
              <input value={rowIndexInput} onChange={(e) => onRowIndexChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <button onClick={onInsertRow} disabled={loading || sortFilterActive}>
              {t("Insert row", "插入行")}
            </button>
            <button onClick={onDeleteRow} disabled={loading || sortFilterActive}>
              {t("Delete row", "删除行")}
            </button>
            <button onClick={onCopySelection} disabled={loading}>
              {t("Copy selection", "复制选择")}
            </button>
            <button onClick={onPasteSelection} disabled={loading}>
              {t("Paste selection", "粘贴选择")}
            </button>
            <label className="field">
              <span>{t("Paste mode", "粘贴模式")}</span>
              <select value={pasteMode} onChange={(e) => onPasteModeChange(e.target.value as "auto" | "strict" | "delimiter")}>
                <option value="auto">{t("Auto", "自动")}</option>
                <option value="strict">{t("Strict CSV", "严格CSV")}</option>
                <option value="delimiter">{t("Delimiter only", "仅分隔符")}</option>
              </select>
            </label>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Column search", "列搜索")}</span>
              <input
                value={columnSearch}
                onChange={(e) => onColumnSearchChange(e.target.value)}
                placeholder={t("Name or index", "名称或索引")}
              />
            </label>
            <button onClick={onShowAllColumns} disabled={!hasPreview}>
              {t("Show all", "全部显示")}
            </button>
            <button onClick={onHideAllColumns} disabled={!hasPreview}>
              {t("Hide all", "全部隐藏")}
            </button>
          </div>
          <div className="column-list">
            {visibleColumns.map((option) => {
                const index = Number.parseInt(option.value, 10);
                const isHidden = hiddenCols.includes(index);
                return (
                  <label key={option.value} className="column-item">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleColumnHidden(index)}
                    />
                    <span>{option.label}</span>
                    <div className="column-actions">
                      <button type="button" onClick={() => onMoveColumnUp(index)}>
                        ↑
                      </button>
                      <button type="button" onClick={() => onMoveColumnDown(index)}>
                        ↓
                      </button>
                    </div>
                  </label>
                );
              })}
          </div>
          {showColumnLimitHint ? (
            <div className="macro-hint">
              {t(
                `Showing first ${columnListLimit} columns. Use search to filter or show all.`,
                `仅显示前 ${columnListLimit} 列，可搜索过滤或显示全部。`,
              )}
              <button
                type="button"
                onClick={() => setShowAllColumnsList(true)}
                style={{ marginLeft: 8 }}
              >
                {t("Show all", "显示全部")}
              </button>
            </div>
          ) : null}
          <div className="shortcuts-panel">
            <div className="macro-title">{t("Shortcuts", "快捷键")}</div>
            <div className="shortcut-list">
              <div><span>Ctrl/Cmd + Z</span><span>{t("Undo", "撤销")}</span></div>
              <div><span>Ctrl/Cmd + Y</span><span>{t("Redo", "重做")}</span></div>
              <div><span>Enter / F2</span><span>{t("Edit cell", "编辑单元格")}</span></div>
              <div><span>Esc</span><span>{t("Cancel edit", "取消编辑")}</span></div>
              <div><span>Arrow keys</span><span>{t("Move active cell", "移动活动单元格")}</span></div>
              <div><span>Tab / Shift+Tab</span><span>{t("Next/previous cell", "下一个/上一个单元格")}</span></div>
              <div><span>Home / End</span><span>{t("Jump to row start/end", "跳到行首/行尾")}</span></div>
              <div><span>Ctrl/Cmd + Home/End</span><span>{t("Jump to grid corners", "跳到表格角落")}</span></div>
              <div><span>PageUp / PageDown</span><span>{t("Jump by viewport", "按视口翻页跳转")}</span></div>
              <div><span>Delete / Backspace</span><span>{t("Clear selected cells", "清空所选单元格")}</span></div>
              <div><span>Ctrl/Cmd + C</span><span>{t("Copy", "复制")}</span></div>
              <div><span>Ctrl/Cmd + X</span><span>{t("Cut", "剪切")}</span></div>
              <div><span>Ctrl/Cmd + V</span><span>{t("Paste", "粘贴")}</span></div>
              <div><span>Ctrl/Cmd + A</span><span>{t("Select all", "全选")}</span></div>
            </div>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Column index", "列索引")}</span>
              <input value={columnIndexInput} onChange={(e) => onColumnIndexChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <label className="field">
              <span>{t("Column name", "列名")}</span>
              <input value={columnNameInput} onChange={(e) => onColumnNameChange(e.target.value)} placeholder={t("Name", "名称")} />
            </label>
            <button onClick={onInsertColumn} disabled={!hasPreview || loading || sortFilterActive}>
              {t("Insert", "插入")}
            </button>
            <button onClick={onDeleteColumn} disabled={!hasPreview || loading || sortFilterActive}>
              {t("Delete", "删除")}
            </button>
            <button onClick={onRenameColumn} disabled={!hasPreview || loading || sortFilterActive}>
              {t("Rename", "重命名")}
            </button>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Sort/Filter memory limit (MB)", "排序/筛选内存上限 (MB)")}</span>
              <input
                inputMode="numeric"
                value={sortFilterMemoryLimitText}
                onChange={(e) => onSortFilterMemoryLimitTextChange(e.target.value)}
                onBlur={() => {
                  const parsed = Number.parseInt(sortFilterMemoryLimitText, 10);
                  const clamped = Number.isNaN(parsed)
                    ? 300
                    : Math.min(4096, Math.max(50, parsed));
                  onSortFilterMemoryLimitCommit(clamped);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  const parsed = Number.parseInt(sortFilterMemoryLimitText, 10);
                  const clamped = Number.isNaN(parsed)
                    ? 300
                    : Math.min(4096, Math.max(50, parsed));
                  onSortFilterMemoryLimitCommit(clamped);
                }}
              />
            </label>
            <label className="field checkbox">
              <span>{t("Force external sort", "强制外部排序")}</span>
              <input
                type="checkbox"
                checked={forceExternalSort}
                onChange={(e) => onForceExternalSortChange(e.target.checked)}
              />
            </label>
            <label className="field">
              <span>{t("Auto index", "自动索引")}</span>
              <select
                value={autoIndexMode}
                onChange={(e) => onAutoIndexModeChange(e.target.value as "large_only" | "all")}
              >
                <option value="large_only">{t("Large files only", "仅大文件")}</option>
                <option value="all">{t("All files", "全部文件")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Sort column", "排序列")}</span>
              <select value={sortColumnInput} onChange={(e) => onSortColumnChange(e.target.value)}>
                <option value="">{t("Select column", "选择列")}</option>
                {columnSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Direction", "方向")}</span>
              <select value={sortDirection} onChange={(e) => onSortDirectionChange(e.target.value as "asc" | "desc")}>
                <option value="asc">{t("Ascending", "升序")}</option>
                <option value="desc">{t("Descending", "降序")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Filter column", "筛选列")}</span>
              <select value={filterColumnInput} onChange={(e) => onFilterColumnChange(e.target.value)}>
                <option value="">{t("Select column", "选择列")}</option>
                {columnSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Filter text", "筛选文本")}</span>
              <input value={filterText} onChange={(e) => onFilterTextChange(e.target.value)} placeholder={t("contains...", "包含...")} />
            </label>
            <button onClick={onAddSortRule} disabled={loading || !sortColumnInput}>
              {t("Add sort", "添加排序")}
            </button>
            <button
              onClick={onAddFilterRule}
              disabled={loading || !filterColumnInput || !filterText}
            >
              {t("Add filter", "添加筛选")}
            </button>
            <button
              onClick={onClearSortFilter}
              disabled={loading || (!sortRules.length && !filterRules.length)}
            >
              {t("Clear", "清除")}
            </button>
          </div>
          {sortRules.length || filterRules.length ? (
            <div className="rules-list">
              {sortRules.map((rule, idx) => (
                <div key={`sort-${idx}`} className="rule-item">
                  <span>
                    {t("Sort col", "排序列")} {rule.column} ({rule.direction === "asc" ? t("asc", "升序") : t("desc", "降序")})
                  </span>
                  <button onClick={() => onRemoveSortRule(idx)}>×</button>
                </div>
              ))}
              {filterRules.map((rule, idx) => (
                <div key={`filter-${idx}`} className="rule-item">
                  <span>
                    {t("Filter col", "筛选列")} {columnLabelByValue.get(rule.column) ?? rule.column} {t("contains", "包含")} {formatFilterRuleValue(rule.value)}
                  </span>
                  <button onClick={() => onRemoveFilterRule(idx)}>×</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showExportPanel ? (
        <div className="ops-panel">
          <div className="macro-title">{t("Export Options", "导出选项")}</div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Encoding", "编码")}</span>
              <select value={encodingMode} onChange={(e) => onEncodingModeChange(e.target.value as "UTF-8" | "UTF-16LE")}>
                <option value="UTF-8">UTF-8</option>
                <option value="UTF-16LE">UTF-16 LE</option>
              </select>
            </label>
            <label className="field">
              <span>{t("EOL", "换行")}</span>
              <select value={eolMode} onChange={(e) => onEolModeChange(e.target.value as "CRLF" | "LF")}>
                <option value="CRLF">{t("Windows (CRLF)", "Windows (CRLF)")}</option>
                <option value="LF">{t("Unix (LF)", "Unix (LF)")}</option>
              </select>
            </label>
            <label className="field checkbox">
              <span>{t("UTF-8 BOM", "UTF-8 BOM")}</span>
              <input type="checkbox" checked={includeBom} onChange={(e) => onIncludeBomChange(e.target.checked)} />
            </label>
            <label className="field">
              <span>{t("Delimiter", "分隔符")}</span>
              <input value={dialectDelimiter} onChange={(e) => onDialectDelimiterChange(e.target.value)} placeholder="," />
            </label>
            <label className="field">
              <span>{t("Quote", "引号")}</span>
              <input value={dialectQuote} onChange={(e) => onDialectQuoteChange(e.target.value)} placeholder={'"'} />
            </label>
            <label className="field">
              <span>{t("Escape", "转义")}</span>
              <input value={dialectEscape} onChange={(e) => onDialectEscapeChange(e.target.value)} placeholder={'"'} />
            </label>
          </div>
        </div>
      ) : null}

      {showFindPanel ? (
        <div className="find-panel">
          <div className="macro-title">{t("Find / Replace", "查找 / 替换")}</div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Find", "查找")}</span>
              <input value={findText} onChange={(e) => onFindTextChange(e.target.value)} />
            </label>
            <label className="field">
              <span>{t("Replace", "替换")}</span>
              <input value={replaceText} onChange={(e) => onReplaceTextChange(e.target.value)} />
            </label>
            <label className="field">
              <span>{t("Scope", "范围")}</span>
              <select
                value={findScope}
                onChange={(e) => onFindScopeChange(e.target.value as "loaded" | "file")}
                data-testid="find-scope-select"
              >
                <option value="loaded">{t("Loaded rows", "已加载行")}</option>
                <option value="file">{t("Full file", "全文件")}</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Column (optional)", "列（可选）")}</span>
              <input value={findColumnInput} onChange={(e) => onFindColumnChange(e.target.value)} placeholder={t("all", "全部")} />
            </label>
            <label className="field">
              <span>{t("Start row", "起始行")}</span>
              <input value={findStartRow} onChange={(e) => onFindStartRowChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <label className="field">
              <span>{t("End row", "结束行")}</span>
              <input value={findEndRow} onChange={(e) => onFindEndRowChange(e.target.value)} placeholder={t("last", "最后")} />
            </label>
            <label className="field checkbox">
              <span>{t("Regex", "正则")}</span>
              <input type="checkbox" checked={useRegex} onChange={(e) => onUseRegexChange(e.target.checked)} />
            </label>
            <label className="field checkbox">
              <span>{t("Match case", "区分大小写")}</span>
              <input type="checkbox" checked={matchCase} onChange={(e) => onMatchCaseChange(e.target.checked)} />
            </label>
            <button onClick={onApplyFindReplace} disabled={!hasPreview || loading}>
              {findScope === "file" ? t("Apply on full file", "应用到全文件") : t("Apply find/replace", "应用查找/替换")}
            </button>
          </div>
          <div className="macro-hint">
            {findScope === "file"
              ? t("Full file runs will export to a new file.", "全文件运行将导出到新文件。")
              : t("Loaded rows only. Switch scope to full file for all rows.", "仅对已加载行生效。如需全文件请选择全文件。")}
          </div>
          <div className="macro-row">
            <button
              onClick={onFindMatches}
              disabled={!hasPreview || loading}
            >
              {t("Find matches", "查找结果")}
            </button>
            <button onClick={onFindCancel} disabled={!findRunning}>
              {t("Cancel find", "取消查找")}
            </button>
            <button onClick={onFindPrev} disabled={!findMatches.length}>
              {t("Prev match", "上一条")}
            </button>
            <button onClick={onFindNext} disabled={!findMatches.length}>
              {t("Next match", "下一条")}
            </button>
            <button onClick={jumpToFirstFindHit} disabled={!findMatches.length}>
              {t("First match", "第一条")}
            </button>
            <button onClick={jumpToLastFindHit} disabled={!findMatches.length}>
              {t("Last match", "最后一条")}
            </button>
            <button onClick={onFindClear} disabled={!findMatches.length}>
              {t("Clear matches", "清空结果")}
            </button>
            <span className="macro-hint">
              {findRunning
                ? t(
                  `Finding... ${Math.round(findProgress * 100)}%${findMatchedCount !== null ? ` · matched ${findMatchedCount}` : ""}`,
                  `查找中... ${Math.round(findProgress * 100)}%${findMatchedCount !== null ? ` · 已匹配 ${findMatchedCount}` : ""}`,
                )
                : findMatches.length
                  ? t(
                    `${activeFindMatchIndex + 1}/${findMatches.length}${findMatchesHasMore ? "+" : ""} matches (${findMatchesSource === "file" ? "full file" : findMatchesSource === "view" ? "sorted/filtered view" : "loaded"})`,
                    `匹配 ${activeFindMatchIndex + 1}/${findMatches.length}${findMatchesHasMore ? "+" : ""}（${findMatchesSource === "file" ? "全文件" : findMatchesSource === "view" ? "排序/筛选结果" : "已加载"}）`,
                  )
                  : findCanceled
                    ? t("Last find task was canceled.", "上一次查找任务已取消。")
                    : t("No match list", "暂无结果列表")}
            </span>
            {findScannedRows !== null && findElapsedMs !== null ? (
              <span className="macro-hint">
                {t(
                  `Scanned ${findScannedRows} rows in ${(findElapsedMs / 1000).toFixed(2)}s`,
                  `扫描 ${findScannedRows} 行，耗时 ${(findElapsedMs / 1000).toFixed(2)} 秒`,
                )}
              </span>
            ) : null}
          </div>
          {findMatches.length ? (
            <div className="find-results-footer">
              <button
                type="button"
                onClick={goFindResultFirstPage}
                disabled={findResultsPanelStart <= 0}
              >
                {t("First page", "首页")}
              </button>
              <button
                type="button"
                onClick={goFindResultPrevPage}
                disabled={findResultsPanelStart <= 0}
              >
                {t("Prev page", "上一页")}
              </button>
              <button
                type="button"
                onClick={goFindResultNextPage}
                disabled={
                  !findMatches.length ||
                  (findResultsPanelRange.end >= visibleFindMatches.length && !canLoadMoreFindResults)
                }
              >
                {t("Next page", "下一页")}
              </button>
              <button
                type="button"
                onClick={goFindResultLastPage}
                disabled={findResultsPanelRange.end >= visibleFindMatches.length}
              >
                {t("Last page", "末页")}
              </button>
              <span className="macro-hint">
                {t(
                  `page ${findResultsPageInfo.currentPage}/${findResultsPageInfo.totalPages}`,
                  `页 ${findResultsPageInfo.currentPage}/${findResultsPageInfo.totalPages}`,
                )}
              </span>
              <label className="field find-hit-jump">
                <span>{t("Hit #", "命中序号")}</span>
                <input
                  value={findHitJumpInput}
                  onChange={(event) => setFindHitJumpInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      jumpToFindHitInput();
                    }
                  }}
                  inputMode="numeric"
                />
              </label>
              <button type="button" onClick={jumpToFindHitInput} disabled={!findMatches.length}>
                {t("Go", "跳转")}
              </button>
            </div>
          ) : null}
          {findMatches.length ? (
            <div
              ref={findResultsListRef}
              className="find-results-list"
              onScroll={handleFindResultsScroll}
            >
              {virtualFindTopSpacer > 0 ? (
                <div
                  className="find-results-spacer"
                  style={{ height: `${virtualFindTopSpacer}px` }}
                  aria-hidden="true"
                />
              ) : null}
              {virtualFindResultItems.map(({ index, match }) => (
                <button
                  key={`${match.row}:${match.col}:${index}`}
                  type="button"
                  className={`find-result-item${index === activeFindMatchIndex ? " active" : ""}`}
                  onClick={() => onFindJump(index)}
                >
                  <span className="find-result-pos">
                    {t("R", "行")}
                    {match.row + 1}
                    {" · "}
                    {t("C", "列")}
                    {match.col + 1}
                  </span>
                  <span className="find-result-text">{match.value}</span>
                </button>
              ))}
              {virtualFindBottomSpacer > 0 ? (
                <div
                  className="find-results-spacer"
                  style={{ height: `${virtualFindBottomSpacer}px` }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          ) : null}
          {findMatches.length ? (
            <>
              {canLoadMoreFindResults ? (
                <div className="find-results-footer">
                  <span className="macro-hint">
                    {t(
                      `Showing ${findResultsPanelRange.start + 1}-${findResultsPanelRange.end} / ${visibleFindMatches.length} loaded matches.`,
                      `显示 ${findResultsPanelRange.start + 1}-${findResultsPanelRange.end} / ${visibleFindMatches.length} 条已加载结果。`,
                    )}
                  </span>
                  <button type="button" onClick={loadMoreFindResults}>
                    {t("Load more hits", "加载更多命中")}
                  </button>
                </div>
              ) : visibleFindMatches.length > FIND_RESULTS_BATCH_SIZE ? (
                <div className="macro-hint">
                  {t(
                    `Showing ${findResultsPanelRange.start + 1}-${findResultsPanelRange.end} / ${visibleFindMatches.length} matches.`,
                    `显示 ${findResultsPanelRange.start + 1}-${findResultsPanelRange.end} / ${visibleFindMatches.length} 条结果。`,
                  )}
                </div>
              ) : findMatchesHasMore ? (
                <div className="macro-hint">
                  {findMatchesHasMore
                    ? t(
                      "Result list reached the match cap. Narrow your query to continue.",
                      "结果列表达到命中上限，请缩小范围后继续。",
                    )
                    : null}
                </div>
              ) : null}
            </>
          ) : null}
          {findOutputPath ? (
            <div className="macro-output">
              {t("Saved", "已保存")}: {findOutputPath}
            </div>
          ) : null}
        </div>
      ) : null}

      {showStatsPanel ? (
        <div className="stats-panel">
          <div className="stats-header">
            <div className="macro-title">{t("Column Stats", "列统计")}</div>
            <button onClick={onRunFullStats} disabled={!hasPreview || fullStatsLoading}>
              {fullStatsLoading ? t("Computing...", "计算中...") : t("Compute full file", "统计全文件")}
            </button>
          </div>
          {columnStats.length ? (
            <>
              <div className="stats-subtitle">{t("Loaded rows", "已加载行")}</div>
              <div className="stats-table">
                <div className="stats-row stats-header">
                  <div>{t("Column", "列")}</div>
                  <div>{t("Non-empty", "非空")}</div>
                  <div>{t("Distinct", "去重")}</div>
                  <div>{t("Type", "类型")}</div>
                </div>
                {columnStats.map((stat, idx) => (
                  <div key={`${stat.name}-${idx}`} className="stats-row">
                    <div>{stat.name}</div>
                    <div>{stat.nonEmpty}</div>
                    <div>{stat.distinct}</div>
                    <div>{stat.inferred}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="stats-empty">{t("Load rows to see column statistics.", "加载行后查看列统计。")}</div>
          )}
          {fullStats ? (
            <>
              <div className="stats-subtitle">{t("Full file", "全文件")}</div>
              <div className="stats-table">
                <div className="stats-row stats-header">
                  <div>{t("Column", "列")}</div>
                  <div>{t("Non-empty", "非空")}</div>
                  <div>{t("Distinct", "去重")}</div>
                  <div>{t("Type", "类型")}</div>
                </div>
                {fullStats.map((stat, idx) => (
                  <div key={`${stat.name}-${idx}`} className="stats-row">
                    <div>{stat.name}</div>
                    <div>{stat.non_empty}</div>
                    <div>
                      {stat.distinct}
                      {stat.distinct_truncated ? "+" : ""}
                    </div>
                    <div>{stat.inferred}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
