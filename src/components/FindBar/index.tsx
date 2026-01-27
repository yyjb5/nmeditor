import "./styles.css";
import type { FindBarProps } from "./types";

export default function FindBar({
  findText,
  replaceText,
  useRegex,
  matchCase,
  onFindChange,
  onReplaceChange,
  onToggleRegex,
  onToggleMatchCase,
  onApply,
  onApplyFile,
  disabled,
  t,
}: FindBarProps) {
  return (
    <div className="find-bar">
      <label className="field">
        <span>{t("Find", "查找")}</span>
        <input value={findText} onChange={(e) => onFindChange(e.target.value)} />
      </label>
      <label className="field">
        <span>{t("Replace", "替换")}</span>
        <input value={replaceText} onChange={(e) => onReplaceChange(e.target.value)} />
      </label>
      <label className="field checkbox">
        <span>{t("Regex", "正则")}</span>
        <input type="checkbox" checked={useRegex} onChange={(e) => onToggleRegex(e.target.checked)} />
      </label>
      <label className="field checkbox">
        <span>{t("Match case", "区分大小写")}</span>
        <input
          type="checkbox"
          checked={matchCase}
          onChange={(e) => onToggleMatchCase(e.target.checked)}
        />
      </label>
      <button onClick={onApply} disabled={disabled}>
        {t("Apply", "应用")}
      </button>
      <button onClick={onApplyFile} disabled={disabled}>
        {t("Apply file", "应用到文件")}
      </button>
    </div>
  );
}
