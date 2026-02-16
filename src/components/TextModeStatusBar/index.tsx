import { useMemo } from "react";
import type { TextModeStatusBarProps } from "./types";
import { analyzeTextWhitespace, detectTextEolMode } from "../../utils/textEol";
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
  const whitespaceStats = useMemo(
    () => analyzeTextWhitespace(textContent),
    [textContent],
  );
  const eolMode = useMemo(() => detectTextEolMode(textContent), [textContent]);
  const eolLabel = useMemo(() => {
    if (eolMode === "CRLF") return "CRLF";
    if (eolMode === "LF") return "LF";
    if (eolMode === "MIXED") return t("Mixed", "混合");
    return t("None", "无");
  }, [eolMode, t]);

  return (
    <footer className="status-bar text-mode-status-bar">
      <span>
        {textLoading
          ? t("Loading text...", "加载文本中...")
          : textPath
            ? t("Text mode", "文本模式")
            : t("Waiting for file", "等待选择文件")}
      </span>
      <span>
        {textPath
          ? t(
              `Length ${textContent.length} · Lines ${whitespaceStats.lineCount}`,
              `长度 ${textContent.length} · 行数 ${whitespaceStats.lineCount}`,
            )
          : ""}
      </span>
      <span>
        {textPath
          ? t(
              `EOL ${eolLabel} · Tabs ${whitespaceStats.tabCount} · Trailing ${whitespaceStats.trailingWhitespaceLines}`,
              `换行 ${eolLabel} · Tab ${whitespaceStats.tabCount} · 行尾空白 ${whitespaceStats.trailingWhitespaceLines}`,
            )
          : ""}
      </span>
      <span>
        {textReplaceRunning
          ? t(
              `Replace ${Math.round(textReplaceProgress * 100)}% · scanned ${formatByteSize(textReplaceScannedBytes)}`,
              `替换 ${Math.round(textReplaceProgress * 100)}% · 已扫描 ${formatByteSize(textReplaceScannedBytes)}`,
            )
          : textReplaceAppliedCount !== null
            ? t(
                `Replaced ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                `替换 ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
              )
            : textFindRunning
              ? t(
                  `Find ${Math.round(textFindProgress * 100)}% · scanned ${formatByteSize(textFindScannedBytes)}`,
                  `查找 ${Math.round(textFindProgress * 100)}% · 已扫描 ${formatByteSize(textFindScannedBytes)}`,
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
