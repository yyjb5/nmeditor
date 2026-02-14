import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { TabData } from "../components/TabBar/types";
import type { CellEditingState, UndoOp } from "../types";

type UseSaveCurrentActionParams = {
  fileMode: "none" | "csv" | "text";
  textPath: string | null;
  saveTextTo: (path: string) => Promise<boolean>;
  saveTextAs: () => Promise<boolean>;
  previewPath: string | null;
  saveToPath: (target: string) => Promise<boolean>;
  clearDraftForPath: (path: string) => void;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  setUndoStack: Dispatch<SetStateAction<UndoOp[]>>;
  setRedoStack: Dispatch<SetStateAction<UndoOp[]>>;
  resetOps: () => void;
  resetFileOps: () => void;
  setClearedRows: Dispatch<SetStateAction<Set<number>>>;
  setClearedCols: Dispatch<SetStateAction<Set<number>>>;
  setEditingCell: Dispatch<SetStateAction<CellEditingState>>;
  requestWindow: (start: number, pathOverride?: string, delimiterOverride?: string) => Promise<void>;
  windowStart: number;
  delimiterApplied: string | null;
  delimiter: string;
  setTabs: Dispatch<SetStateAction<TabData[]>>;
  activeTabId: string | null;
  saveCurrentTabData: (tabId: string, type: "csv" | "text") => void;
};

export default function useSaveCurrentAction({
  fileMode,
  textPath,
  saveTextTo,
  saveTextAs,
  previewPath,
  saveToPath,
  clearDraftForPath,
  setPatches,
  setUndoStack,
  setRedoStack,
  resetOps,
  resetFileOps,
  setClearedRows,
  setClearedCols,
  setEditingCell,
  requestWindow,
  windowStart,
  delimiterApplied,
  delimiter,
  setTabs,
  activeTabId,
  saveCurrentTabData,
}: UseSaveCurrentActionParams) {
  return useCallback(async (): Promise<boolean> => {
    if (fileMode === "text") {
      if (textPath) {
        return saveTextTo(textPath);
      }
      return saveTextAs();
    }

    if (fileMode === "csv" && previewPath) {
      const saved = await saveToPath(previewPath);
      if (!saved) return false;
      clearDraftForPath(previewPath);
      setPatches({});
      setUndoStack([]);
      setRedoStack([]);
      resetOps();
      resetFileOps();
      setClearedRows(new Set());
      setClearedCols(new Set());
      setEditingCell(null);
      await requestWindow(windowStart, previewPath, delimiterApplied ?? delimiter);
      setTabs((prev) =>
        prev.map((tab) => (tab.id === activeTabId ? { ...tab, isDirty: false } : tab)),
      );
      if (activeTabId) {
        saveCurrentTabData(activeTabId, "csv");
      }
      return true;
    }

    return false;
  }, [
    activeTabId,
    clearDraftForPath,
    delimiter,
    delimiterApplied,
    fileMode,
    previewPath,
    requestWindow,
    resetFileOps,
    resetOps,
    saveCurrentTabData,
    saveTextAs,
    saveTextTo,
    saveToPath,
    setClearedCols,
    setClearedRows,
    setEditingCell,
    setPatches,
    setRedoStack,
    setTabs,
    setUndoStack,
    textPath,
    windowStart,
  ]);
}
