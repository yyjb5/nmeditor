import "./styles.css";
import type { StatusBarProps } from "./types";

export default function StatusBar({
  loading,
  loadingRows,
  hasPreview,
  eof,
  rowsLength,
  visibleCount,
  patchCount,
  macroAppliedCount,
  findAppliedCount,
  indexing,
  indexProgress,
  indexCanceled,
  onCancelIndex,
  t,
}: StatusBarProps) {
  const indexPercent = Math.min(Math.max(Math.round(indexProgress * 100), 0), 100);
  const statusText = loading
    ? t("Opening file...", "正在打开文件...")
    : indexing
      ? t(`Indexing ${indexPercent}%`, `索引中 ${indexPercent}%`)
      : loadingRows
        ? t("Loading rows...", "正在加载...")
        : hasPreview
          ? eof
            ? t(`Rows: ${rowsLength} (EOF)`, `行数：${rowsLength} (结束)`)
            : t(`Rows: ${rowsLength}`, `行数：${rowsLength}`)
          : t("Waiting for file", "等待选择文件");

  return (
    <footer className="status-bar">
      <span>{statusText}</span>
      <span>
        {indexing ? (
          <>
            {indexCanceled
              ? t("Index canceled", "索引已取消")
              : t("Building index...", "正在构建索引...")}
            {onCancelIndex ? (
              <button onClick={onCancelIndex} style={{ marginLeft: 8 }}>
                {t("Cancel", "取消")}
              </button>
            ) : null}
          </>
        ) : hasPreview
          ? t(
              `Visible ${visibleCount} · Edits ${patchCount} · Macro ${macroAppliedCount} · Find ${findAppliedCount}`,
              `显示 ${visibleCount} · 编辑 ${patchCount} · 宏 ${macroAppliedCount} · 查找 ${findAppliedCount}`,
            )
          : ""}
      </span>
    </footer>
  );
}
