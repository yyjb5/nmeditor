import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TabData } from "../components/TabBar/types";
import type { UndoOp } from "../types";
import { confirmDialog, openFileDialog, statFile } from "../tauriBridge";
import { isCsvLikePath } from "../utils/fileMode";

type CsvDraftPayload = {
  patches?: Record<string, string>;
  clearedRows?: number[];
  clearedCols?: number[];
  updatedAt?: number;
};

type PendingImport = { skipRows: number; firstRowHeader: boolean } | null;
type PendingInitialSave = { tabId: string; type: "csv" | "text" } | null;

type UseFileOpenActionsParams = {
  activeTabId: string | null;
  tabs: TabData[];
  confirmSaveOrDiscard: (tab: TabData) => Promise<boolean>;
  saveCurrentTabData: (tabId: string, type: "csv" | "text") => void;
  createTab: (path: string, fileType: "csv" | "text") => string;
  importFirstRowHeader: boolean;
  importSkipRows: string;
  pendingImportRef: MutableRefObject<PendingImport>;
  pendingInitialSaveRef: MutableRefObject<PendingInitialSave>;
  resetTextSession: () => void;
  closeSession: () => Promise<void>;
  openCsvPath: (path: string, delimiterOverride?: string) => Promise<{ path: string; delimiter: string } | null>;
  openText: (path: string) => Promise<boolean>;
  setFileMode: Dispatch<SetStateAction<"none" | "csv" | "text">>;
  resetSessionState: () => void;
  requestWindow: (start: number, pathOverride?: string, delimiterOverride?: string) => Promise<void>;
  setFileSizeBytes: Dispatch<SetStateAction<number | null>>;
  shouldAutoBuildIndex: (sizeBytes: number | null) => boolean;
  refreshTotalRows: (
    path: string,
    delimiterValue?: string,
    trigger?: "auto" | "manual",
  ) => Promise<void>;
  loadDraftForPath: (path: string) => CsvDraftPayload | null;
  clearDraftForPath: (path: string | null) => void;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  setClearedRows: Dispatch<SetStateAction<Set<number>>>;
  setClearedCols: Dispatch<SetStateAction<Set<number>>>;
  setUndoStack: Dispatch<SetStateAction<UndoOp[]>>;
  setRedoStack: Dispatch<SetStateAction<UndoOp[]>>;
  addRecentFile: (path: string) => void;
  t: (en: string, zh: string) => string;
};

export default function useFileOpenActions({
  activeTabId,
  tabs,
  confirmSaveOrDiscard,
  saveCurrentTabData,
  createTab,
  importFirstRowHeader,
  importSkipRows,
  pendingImportRef,
  pendingInitialSaveRef,
  resetTextSession,
  closeSession,
  openCsvPath,
  openText,
  setFileMode,
  resetSessionState,
  requestWindow,
  setFileSizeBytes,
  shouldAutoBuildIndex,
  refreshTotalRows,
  loadDraftForPath,
  clearDraftForPath,
  setPatches,
  setClearedRows,
  setClearedCols,
  setUndoStack,
  setRedoStack,
  addRecentFile,
  t,
}: UseFileOpenActionsParams) {
  const openDialogActiveRef = useRef(false);

  const openPath = useCallback(
    async (path: string) => {
      const isCsv = isCsvLikePath(path);

      if (activeTabId) {
        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        if (currentTab) {
          saveCurrentTabData(activeTabId, currentTab.fileType);
        }
      }

      if (isCsv) {
        resetTextSession();
        await closeSession();
        const info = await openCsvPath(path);
        if (!info) return;
        setFileMode("csv");
        resetSessionState();
        const parsedSkip = Number.parseInt(importSkipRows, 10);
        const skipRows = Number.isNaN(parsedSkip) ? 0 : Math.max(0, parsedSkip);
        pendingImportRef.current = { skipRows, firstRowHeader: importFirstRowHeader };
        await requestWindow(skipRows, path, info.delimiter);
        let sizeHint: number | null = null;
        try {
          const fileInfo = await statFile(path);
          sizeHint = fileInfo.size ?? null;
          setFileSizeBytes(sizeHint);
        } catch {
          setFileSizeBytes(null);
        }
        if (shouldAutoBuildIndex(sizeHint)) {
          void refreshTotalRows(path, info.delimiter, "auto");
        }
        const draft = loadDraftForPath(path);
        const hasDraft =
          draft &&
          ((draft.patches && Object.keys(draft.patches).length > 0) ||
            (draft.clearedRows && draft.clearedRows.length > 0) ||
            (draft.clearedCols && draft.clearedCols.length > 0));
        if (hasDraft) {
          const restore = await confirmDialog(
            t(
              "Restore unsaved edits from the last session?",
              "Restore unsaved edits from the last session?",
            ),
            { title: t("Draft detected", "检测到草稿"), kind: "warning" },
          );
          if (restore && draft) {
            setPatches(draft.patches ?? {});
            setClearedRows(new Set(draft.clearedRows ?? []));
            setClearedCols(new Set(draft.clearedCols ?? []));
            setUndoStack([]);
            setRedoStack([]);
          } else {
            clearDraftForPath(path);
          }
        }
        const tabId = createTab(path, "csv");
        pendingInitialSaveRef.current = { tabId, type: "csv" };
        addRecentFile(path);
        return;
      }

      resetSessionState();
      await closeSession();
      const opened = await openText(path);
      if (!opened) return;
      setFileMode("text");
      setFileSizeBytes(null);
      const tabId = createTab(path, "text");
      pendingInitialSaveRef.current = { tabId, type: "text" };
      addRecentFile(path);
    },
    [
      activeTabId,
      addRecentFile,
      clearDraftForPath,
      closeSession,
      createTab,
      importFirstRowHeader,
      importSkipRows,
      loadDraftForPath,
      openCsvPath,
      openText,
      pendingImportRef,
      pendingInitialSaveRef,
      refreshTotalRows,
      requestWindow,
      resetSessionState,
      resetTextSession,
      saveCurrentTabData,
      setClearedCols,
      setClearedRows,
      setFileMode,
      setFileSizeBytes,
      setPatches,
      setRedoStack,
      setUndoStack,
      shouldAutoBuildIndex,
      t,
      tabs,
    ],
  );

  const handleOpen = useCallback(async () => {
    if (activeTabId) {
      const currentTab = tabs.find((tab) => tab.id === activeTabId);
      if (currentTab) {
        const ok = await confirmSaveOrDiscard(currentTab);
        if (!ok) return;
      }
    }
    if (openDialogActiveRef.current) return;
    openDialogActiveRef.current = true;
    try {
      const selected = await openFileDialog({
        multiple: false,
        filters: [
          { name: "CSV", extensions: ["csv", "tsv", "psv", "ssv"] },
          { name: "Text", extensions: ["txt", "log", "md"] },
        ],
      });

      if (!selected || Array.isArray(selected)) return;
      await openPath(selected);
    } finally {
      openDialogActiveRef.current = false;
    }
  }, [activeTabId, confirmSaveOrDiscard, openPath, tabs]);

  return { openPath, handleOpen };
}
