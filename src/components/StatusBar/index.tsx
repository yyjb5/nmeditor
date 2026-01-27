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
  t,
}: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>
        {loading
          ? t("Opening file...", "正在打开文件...")
          : loadingRows
            ? t("Loading rows...", "正在加载...")
            : hasPreview
              ? eof
                ? t(`Rows: ${rowsLength} (EOF)`, `行数：${rowsLength} (结束)`)
                : t(`Rows: ${rowsLength}`, `行数：${rowsLength}`)
              : t("Waiting for file", "等待选择文件")}
      </span>
      <span>
        {hasPreview
          ? t(
              `Visible ${visibleCount} · Edits ${patchCount} · Macro ${macroAppliedCount} · Find ${findAppliedCount}`,
              `显示 ${visibleCount} · 编辑 ${patchCount} · 宏 ${macroAppliedCount} · 查找 ${findAppliedCount}`,
            )
          : ""}
      </span>
    </footer>
  );
}
