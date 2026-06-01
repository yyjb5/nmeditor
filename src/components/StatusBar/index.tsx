import "./styles.css";
import type { StatusBarProps } from "./types";

export default function StatusBar({
  loading,
  loadingRows,
  fileMode,
  csvGridFocused,
  csvEditing,
  csvSelectionMode,
  hasPreview,
  eof,
  rowsLength,
  visibleCount,
  totalRows,
  patchCount,
  macroAppliedCount,
  findAppliedCount,
  opStatus,
  indexing,
  indexProgress,
  indexCanceled,
  findRunning,
  findProgress,
  findCanceled,
  findMatchedCount,
  findScannedRows,
  findElapsedMs,
  globalViewLoading,
  autoIndexMode,
  forceExternalSort,
  indexingTrigger,
  onCancelIndex,
  onCancelFind,
  onBuildIndex,
  canBuildIndex,
  t,
}: StatusBarProps) {
  const indexPercent = Math.min(Math.max(Math.round(indexProgress * 100), 0), 100);
  const findPercent = Math.min(Math.max(Math.round(findProgress * 100), 0), 100);
  const autoIndexText =
    autoIndexMode === "all"
      ? t("Auto-index: all files", "自动索引：全部文件")
      : t("Auto-index: large files", "自动索引：仅大文件");
  const selectionModeText =
    csvSelectionMode === "row"
      ? t("row", "行")
      : csvSelectionMode === "col"
        ? t("column", "列")
        : t("cell", "单元格");
  const inputModeText =
    fileMode === "text"
      ? t("Mode: text", "模式：文本")
      : fileMode === "csv"
        ? csvEditing
          ? t(`Mode: CSV editing (${selectionModeText})`, `模式：CSV 编辑（${selectionModeText}）`)
          : csvGridFocused
            ? t(`Mode: CSV navigation (${selectionModeText})`, `模式：CSV 导航（${selectionModeText}）`)
            : t("Mode: CSV inactive", "模式：CSV 未聚焦")
        : t("Mode: idle", "模式：空闲");
  const statusText = opStatus
    ? opStatus
    : loading
    ? t("Opening file...", "正在打开文件...")
    : globalViewLoading
      ? t("Applying sort/filter...", "正在应用排序/筛选...")
    : findRunning
      ? t(
        `Finding ${findPercent}%${findMatchedCount !== null ? ` · matched ${findMatchedCount}` : ""}`,
        `查找中 ${findPercent}%${findMatchedCount !== null ? ` · 已匹配 ${findMatchedCount}` : ""}`,
      )
    : indexing
      ? indexingTrigger === "auto"
        ? t(`Auto-indexing ${indexPercent}%`, `自动索引中 ${indexPercent}%`)
        : t(`Indexing ${indexPercent}%`, `索引中 ${indexPercent}%`)
      : loadingRows
        ? t("Loading rows...", "正在加载...")
        : hasPreview
          ? eof
            ? t(`Rows: ${rowsLength} (EOF)`, `行数：${rowsLength} (结束)`)
            : t(`Rows: ${rowsLength}`, `行数：${rowsLength}`)
          : t("Waiting for file", "等待选择文件");
  const totalRowsText =
    totalRows !== undefined && totalRows !== null
      ? totalRows.toLocaleString()
      : eof
        ? rowsLength.toLocaleString()
        : t("unknown", "未知");
  const editRiskText = t(
    `Edits ${patchCount} · Macro ${macroAppliedCount} · Find ${findAppliedCount}`,
    `编辑 ${patchCount} · 宏 ${macroAppliedCount} · 查找 ${findAppliedCount}`,
  );
  const visibleRowsText = t(
    `Visible ${visibleCount} / ${totalRowsText}`,
    `显示 ${visibleCount} / ${totalRowsText}`,
  );

  return (
    <footer className="status-bar">
      <span className="status-section status-primary">{statusText}</span>
      <span className="status-section status-work">
        {findRunning ? (
          <>
            {t("Find task running...", "查找任务运行中...")}
            {onCancelFind ? (
              <button onClick={onCancelFind} style={{ marginLeft: 8 }}>
                {t("Cancel", "取消")}
              </button>
            ) : null}
          </>
        ) : indexing ? (
          <>
            {indexCanceled
              ? t("Index canceled", "索引已取消")
              : indexingTrigger === "auto"
                ? t("Auto building index...", "正在自动构建索引...")
                : t("Building index...", "正在构建索引...")}
            {onCancelIndex ? (
              <button onClick={onCancelIndex} style={{ marginLeft: 8 }}>
                {t("Cancel", "取消")}
              </button>
            ) : null}
          </>
        ) : hasPreview ? (
          <>
            <span>{visibleRowsText}</span>
            <span>{editRiskText}</span>
            {canBuildIndex ? (
              <span>
                {t("Partial load", "部分加载")}
                {onBuildIndex ? (
                  <button onClick={onBuildIndex}>
                    {t("Build index", "构建索引")}
                  </button>
                ) : null}
              </span>
            ) : null}
          </>
        ) : (
          ""
        )}
      </span>
      <span className="status-section status-context">
        {hasPreview ? (
          <>
            <span>{autoIndexText}</span>
            <span>{inputModeText}</span>
            {findCanceled ? (
              <span>
                {t("Find canceled", "查找已取消")}
              </span>
            ) : null}
            {findScannedRows !== null && findElapsedMs !== null ? (
              <span>
                {t(
                  `Last find: scanned ${findScannedRows} rows in ${(findElapsedMs / 1000).toFixed(2)}s`,
                  `上次查找：扫描 ${findScannedRows} 行，耗时 ${(findElapsedMs / 1000).toFixed(2)} 秒`,
                )}
              </span>
            ) : null}
            {forceExternalSort ? (
              <span>
                {t("External sort: forced", "外部排序：已强制")}
              </span>
            ) : null}
          </>
        ) : (
          ""
        )}
      </span>
    </footer>
  );
}
