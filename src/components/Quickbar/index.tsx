import "./styles.css";
import type { QuickbarProps } from "./types";

export default function Quickbar({
  locale,
  delimiter,
  delimiterApplied,
  delimiterPresets,
  loading,
  hasPreview,
  onLocaleChange,
  onDelimiterChange,
  onApplyDelimiter,
  autoFitEnabled,
  onToggleAutoFit,
  onAutoFitNow,
  onUndo,
  onRedo,
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
      <label className="field checkbox">
        <span>{t("Auto-fit", "自适应")}</span>
        <input
          type="checkbox"
          checked={autoFitEnabled}
          onChange={(e) => onToggleAutoFit(e.target.checked)}
        />
      </label>
      <button onClick={onAutoFitNow} disabled={!hasPreview || loading}>
        {t("Auto-fit now", "立即自适应")}
      </button>
      <button onClick={onUndo} disabled={!canUndo}>
        {t("Undo", "撤销")}
      </button>
      <button onClick={onRedo} disabled={!canRedo}>
        {t("Redo", "重做")}
      </button>
    </div>
  );
}
