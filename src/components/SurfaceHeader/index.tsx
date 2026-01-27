import "./styles.css";
import type { SurfaceHeaderProps } from "./types";

export default function SurfaceHeader({
  activePath,
  delimiter,
  delimiterApplied,
  rowsLength,
  previewDelimiter,
  t,
}: SurfaceHeaderProps) {
  return (
    <div className="surface-header">
      <div className="file-meta">
        <span className="label">{t("File", "文件")}</span>
        <span className="value">{activePath ?? t("Select a file", "选择文件")}</span>
      </div>
      <div className="file-meta">
        <span className="label">{t("Delimiter", "分隔符")}</span>
        <span className="value">
          {previewDelimiter ?? delimiter}
          {delimiterApplied && delimiterApplied !== delimiter ? t(" (pending)", " (待应用)") : ""}
        </span>
      </div>
      <div className="file-meta">
        <span className="label">{t("Rows (preview)", "行数(预览)")}</span>
        <span className="value">{rowsLength}</span>
      </div>
    </div>
  );
}
