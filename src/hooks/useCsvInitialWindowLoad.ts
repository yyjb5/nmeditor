import { useEffect } from "react";

export interface UseCsvInitialWindowLoadOptions {
  fileMode: "none" | "csv" | "text";
  previewPath: string | null;
  activePath: string | null;
  delimiter: string;
  delimiterApplied: string | null;
  previewDelimiter: string | null;
  refreshTotalRows: (path: string, delimiter: string, trigger: "auto" | "manual") => Promise<void>;
  loadWindow: (start: number, path: string, delimiter: string) => Promise<void>;
}

export default function useCsvInitialWindowLoad({
  fileMode,
  previewPath,
  activePath,
  delimiter,
  delimiterApplied,
  previewDelimiter,
  refreshTotalRows,
  loadWindow,
}: UseCsvInitialWindowLoadOptions) {
  useEffect(() => {
    const path = previewPath ?? activePath;
    if (!path || fileMode !== "csv") return;
    const resolvedDelimiter = delimiterApplied ?? previewDelimiter ?? delimiter;
    void refreshTotalRows(path, resolvedDelimiter, "auto");
    void loadWindow(0, path, resolvedDelimiter);
  }, [
    previewPath,
    activePath,
    fileMode,
    delimiter,
    delimiterApplied,
    previewDelimiter,
    refreshTotalRows,
    loadWindow,
  ]);
}
