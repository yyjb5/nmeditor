import { useCallback } from "react";
import { statFile } from "../tauriBridge";

type OpenCsvInfo = { path: string; delimiter: string };

export interface UseCsvSaveActionsOptions {
  fileMode: "none" | "csv" | "text";
  saveTextAs: () => Promise<boolean>;
  saveAs: () => Promise<{ path: string; delimiter: string } | null>;
  clearDraftForPath: (path: string | null) => void;
  previewPath: string | null;
  updateActiveTabPath: (nextPath: string) => void;
  resetSessionState: () => void;
  closeSession: () => Promise<void>;
  openCsvPath: (path: string, delimiterValue?: string) => Promise<OpenCsvInfo | null>;
  setFileMode: (mode: "none" | "csv" | "text") => void;
  requestWindow: (start: number, path?: string, delimiterValue?: string) => Promise<void>;
  setFileSizeBytes: (size: number | null) => void;
  shouldAutoBuildIndex: (sizeBytes: number | null) => boolean;
  refreshTotalRows: (
    path: string,
    delimiterValue?: string,
    trigger?: "auto" | "manual",
  ) => Promise<void>;
  activeTabId: string | null;
  saveCurrentTabData: (tabId: string, type: "csv" | "text") => void;
  applyDelimiter: () => Promise<OpenCsvInfo | null>;
  fileSizeBytes: number | null;
}

export default function useCsvSaveActions({
  fileMode,
  saveTextAs,
  saveAs,
  clearDraftForPath,
  previewPath,
  updateActiveTabPath,
  resetSessionState,
  closeSession,
  openCsvPath,
  setFileMode,
  requestWindow,
  setFileSizeBytes,
  shouldAutoBuildIndex,
  refreshTotalRows,
  activeTabId,
  saveCurrentTabData,
  applyDelimiter,
  fileSizeBytes,
}: UseCsvSaveActionsOptions) {
  const saveAsCurrent = useCallback(async (): Promise<boolean> => {
    if (fileMode === "text") {
      return saveTextAs();
    }
    if (fileMode !== "csv") return false;
    const result = await saveAs();
    if (!result) return false;
    clearDraftForPath(previewPath);
    clearDraftForPath(result.path);
    updateActiveTabPath(result.path);
    resetSessionState();
    await closeSession();
    const info = await openCsvPath(result.path, result.delimiter);
    if (!info) return false;
    setFileMode("csv");
    await requestWindow(0, info.path, info.delimiter);
    let sizeHint: number | null = null;
    try {
      const fileInfo = await statFile(result.path);
      sizeHint = fileInfo.size ?? null;
      setFileSizeBytes(sizeHint);
    } catch {
      setFileSizeBytes(null);
    }
    if (shouldAutoBuildIndex(sizeHint)) {
      void refreshTotalRows(info.path, info.delimiter, "auto");
    }
    if (activeTabId) {
      saveCurrentTabData(activeTabId, "csv");
    }
    return true;
  }, [
    activeTabId,
    clearDraftForPath,
    closeSession,
    fileMode,
    openCsvPath,
    previewPath,
    refreshTotalRows,
    requestWindow,
    resetSessionState,
    saveAs,
    saveCurrentTabData,
    saveTextAs,
    setFileMode,
    setFileSizeBytes,
    shouldAutoBuildIndex,
    updateActiveTabPath,
  ]);

  const handleApplyDelimiter = useCallback(async () => {
    if (fileMode !== "csv") return;
    const info = await applyDelimiter();
    if (!info) return;
    resetSessionState();
    await requestWindow(0, info.path, info.delimiter);
    if (shouldAutoBuildIndex(fileSizeBytes)) {
      void refreshTotalRows(info.path, info.delimiter, "auto");
    }
  }, [
    applyDelimiter,
    fileMode,
    fileSizeBytes,
    refreshTotalRows,
    requestWindow,
    resetSessionState,
    shouldAutoBuildIndex,
  ]);

  return {
    saveAsCurrent,
    handleApplyDelimiter,
  };
}
