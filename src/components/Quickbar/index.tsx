import "./styles.css";
import type { QuickbarProps } from "./types";

export default function Quickbar({
  locale,
  delimiter,
  delimiterApplied,
  delimiterPresets,
  loading,
  loadingRows,
  eof,
  hasPreview,
  onLocaleChange,
  onDelimiterChange,
  onApplyDelimiter,
  onLoadMore,
  onUndo,
  onRedo,
  onFindReplaceLoaded,
  onMacroLoaded,
  canUndo,
  canRedo,
  t,
}: QuickbarProps) {
  return (
    <div className="quickbar">
      <select
        aria-label="Language"
        value={locale}
        onChange={(e) => onLocaleChange(e.target.value as "en" | "zh")}
      >
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
      <select
        aria-label={t("Delimiter", "分隔符")}
        value={delimiter}
        onChange={(e) => onDelimiterChange(e.target.value)}
        disabled={loading}
      >
        {delimiterPresets.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {locale === "zh"
              ? preset.label
                  .replace("Comma", "逗号")
                  .replace("Semicolon", "分号")
                  .replace("Tab", "制表符")
                  .replace("Pipe", "竖线")
              : preset.label}
          </option>
        ))}
      </select>
      <button
        onClick={onApplyDelimiter}
        disabled={loading || !hasPreview || delimiterApplied === delimiter}
      >
        {t("Apply delimiter", "应用分隔符")}
      </button>
      <button onClick={onLoadMore} disabled={loading || loadingRows || !hasPreview || eof}>
        {loadingRows
          ? t("Loading rows...", "正在加载...")
          : eof
            ? t("All rows loaded", "已加载全部")
            : t("Load more", "加载更多")}
      </button>
      <button onClick={onUndo} disabled={!canUndo}>
        {t("Undo", "撤销")}
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        {t("Redo", "重做")}
      </button>
      <button onClick={onFindReplaceLoaded} disabled={!hasPreview || loading}>
        {t("Find/Replace (loaded)", "查找替换(已加载)")}
      </button>
      <button onClick={onMacroLoaded} disabled={!hasPreview || loading}>
        {t("Macro (loaded)", "宏(已加载)")}
      </button>
    </div>
  );
}
