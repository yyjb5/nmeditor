import { useEffect, type MutableRefObject } from "react";

interface PendingInitialSave {
  tabId: string;
  type: "csv" | "text";
}

export interface UsePendingInitialTabSaveOptions {
  pendingInitialSaveRef: MutableRefObject<PendingInitialSave | null>;
  activeTabId: string | null;
  fileMode: "none" | "csv" | "text";
  loading: boolean;
  textLoading: boolean;
  saveCurrentTabData: (tabId: string, mode: "csv" | "text") => void;
}

export default function usePendingInitialTabSave({
  pendingInitialSaveRef,
  activeTabId,
  fileMode,
  loading,
  textLoading,
  saveCurrentTabData,
}: UsePendingInitialTabSaveOptions) {
  useEffect(() => {
    const pending = pendingInitialSaveRef.current;
    if (!pending) return;
    if (activeTabId !== pending.tabId) return;

    if (pending.type === "csv") {
      if (fileMode !== "csv" || loading) return;
      saveCurrentTabData(pending.tabId, "csv");
      pendingInitialSaveRef.current = null;
      return;
    }

    if (pending.type === "text") {
      if (fileMode !== "text" || textLoading) return;
      saveCurrentTabData(pending.tabId, "text");
      pendingInitialSaveRef.current = null;
    }
  }, [
    pendingInitialSaveRef,
    activeTabId,
    fileMode,
    loading,
    textLoading,
    saveCurrentTabData,
  ]);
}
