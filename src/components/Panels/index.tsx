import "./styles.css";
import type { MacroOp, PanelsProps } from "./types";

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
  macroOutputPath,
  onMacroOpChange,
  onMacroColumnChange,
  onMacroFindChange,
  onMacroReplaceChange,
  onMacroTextChange,
  onRunMacro,
  onRunMacroOnFile,
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
  findColumnInput,
  findStartRow,
  findEndRow,
  useRegex,
  matchCase,
  findOutputPath,
  onFindTextChange,
  onReplaceTextChange,
  onFindColumnChange,
  onFindStartRowChange,
  onFindEndRowChange,
  onUseRegexChange,
  onMatchCaseChange,
  onApplyFindReplace,
  onApplyFindReplaceOnFile,
  columnStats,
  fullStats,
  fullStatsLoading,
  onRunFullStats,
  loading,
  hasPreview,
  t,
}: PanelsProps) {
  return (
    <>
      {showMacroPanel ? (
        <div className="macro-panel">
          <div className="macro-title">{t("Macro / Batch (loaded rows)", "宏 / 批处理（已加载行）")}</div>
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
              {t("Run on loaded rows", "运行（已加载行）")}
            </button>
            <button onClick={onRunMacroOnFile} disabled={!hasPreview || loading}>
              {t("Run on full file", "运行（全文件）")}
            </button>
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
          <div className="macro-title">{t("Column / Sort / Filter", "列 / 排序 / 筛选")}</div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Row index", "行索引")}</span>
              <input value={rowIndexInput} onChange={(e) => onRowIndexChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <button onClick={onInsertRow} disabled={loading}>
              {t("Insert row", "插入行")}
            </button>
            <button onClick={onDeleteRow} disabled={loading}>
              {t("Delete row", "删除行")}
            </button>
            <button onClick={onCopySelection} disabled={loading}>
              {t("Copy selection", "复制选择")}
            </button>
            <button onClick={onPasteSelection} disabled={loading}>
              {t("Paste selection", "粘贴选择")}
            </button>
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
            <button onClick={onInsertColumn} disabled={!hasPreview || loading}>
              {t("Insert", "插入")}
            </button>
            <button onClick={onDeleteColumn} disabled={!hasPreview || loading}>
              {t("Delete", "删除")}
            </button>
            <button onClick={onRenameColumn} disabled={!hasPreview || loading}>
              {t("Rename", "重命名")}
            </button>
          </div>
          <div className="macro-row">
            <label className="field">
              <span>{t("Sort column", "排序列")}</span>
              <input value={sortColumnInput} onChange={(e) => onSortColumnChange(e.target.value)} placeholder={t("0", "0")} />
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
              <input value={filterColumnInput} onChange={(e) => onFilterColumnChange(e.target.value)} placeholder={t("0", "0")} />
            </label>
            <label className="field">
              <span>{t("Filter text", "筛选文本")}</span>
              <input value={filterText} onChange={(e) => onFilterTextChange(e.target.value)} placeholder={t("contains...", "包含...")} />
            </label>
            <button onClick={onAddSortRule} disabled={!sortColumnInput}>
              {t("Add sort", "添加排序")}
            </button>
            <button onClick={onAddFilterRule} disabled={!filterColumnInput || !filterText}>
              {t("Add filter", "添加筛选")}
            </button>
            <button onClick={onClearSortFilter} disabled={!sortRules.length && !filterRules.length}>
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
                    {t("Filter col", "筛选列")} {rule.column} {t("contains", "包含")} "{rule.value}"
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
          <div className="macro-title">{t("Find / Replace (loaded rows)", "查找 / 替换（已加载行）")}</div>
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
              {t("Apply find/replace", "应用查找/替换")}
            </button>
            <button onClick={onApplyFindReplaceOnFile} disabled={!hasPreview || loading}>
              {t("Apply on full file", "应用到全文件")}
            </button>
          </div>
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
