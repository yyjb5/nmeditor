import type { TextModeStatusBarProps } from "./types";
import "./styles.css";

export default function TextModeStatusBar({
  t,
  textLoading,
  textPath,
  textContent,
  textReplaceRunning,
  textReplaceProgress,
  textReplaceScannedBytes,
  textReplaceAppliedCount,
  textReplaceElapsedMs,
  textFindRunning,
  textFindProgress,
  textFindScannedBytes,
  textFindMatchedCount,
  textFindHasMore,
  textFindElapsedMs,
  formatByteSize,
}: TextModeStatusBarProps) {
  return (
    <footer className="status-bar text-mode-status-bar">
      <span>
        {textLoading
          ? t("Loading text...", "加载文本�?..")
          : textPath
            ? t("Text mode", "文本模式")
            : t("Waiting for file", "等待选择文件")}
      </span>
      <span>
        {textPath
          ? t(
              `Length ${textContent.length} · Lines ${textContent.split(/\r?\n/).length}`,
              `长度 ${textContent.length} · 行数 ${textContent.split(/\r?\n/).length}`,
            )
          : ""}
      </span>
      <span>
        {textReplaceRunning
          ? t(
              `Replace ${Math.round(textReplaceProgress * 100)}% · scanned ${formatByteSize(textReplaceScannedBytes)}`,
              `替换 ${Math.round(textReplaceProgress * 100)}% · 已扫�?${formatByteSize(textReplaceScannedBytes)}`,
            )
          : textReplaceAppliedCount !== null
            ? t(
                `Replaced ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                `替换 ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
              )
            : textFindRunning
              ? t(
                  `Find ${Math.round(textFindProgress * 100)}% · scanned ${formatByteSize(textFindScannedBytes)}`,
                  `查找 ${Math.round(textFindProgress * 100)}% · 已扫�?${formatByteSize(textFindScannedBytes)}`,
                )
              : textFindMatchedCount !== null
                ? t(
                    `Hits ${textFindMatchedCount}${textFindHasMore ? "+" : ""} · ${textFindElapsedMs ?? 0}ms`,
                    `命中 ${textFindMatchedCount}${textFindHasMore ? "+" : ""} · ${textFindElapsedMs ?? 0}ms`,
                  )
                : ""}
      </span>
    </footer>
  );
}
