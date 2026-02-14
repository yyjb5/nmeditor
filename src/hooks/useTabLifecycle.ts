import { useCallback, type Dispatch, type SetStateAction } from "react";
import { confirmDialog } from "../tauriBridge";
import type { TabData } from "../components/TabBar/types";
import type { TabFileData } from "../types";

type UseTabLifecycleParams = {
  activeTabId: string | null;
  tabs: TabData[];
  tabDataMap: Map<string, TabFileData>;
  patches: Record<string, string>;
  rowOps: unknown[];
  columnOps: unknown[];
  textDirty: boolean;
  loadTabData: (tabId: string) => Promise<void>;
  saveCurrentTabData: (tabId: string, type: "csv" | "text") => void;
  saveCurrent: () => Promise<boolean>;
  resetTextSession: () => void;
  setTabs: Dispatch<SetStateAction<TabData[]>>;
  setActiveTabId: Dispatch<SetStateAction<string | null>>;
  setFileMode: Dispatch<SetStateAction<"none" | "csv" | "text">>;
  setRows: Dispatch<SetStateAction<string[][]>>;
  setHeaders: Dispatch<SetStateAction<string[]>>;
  setPatches: Dispatch<SetStateAction<Record<string, string>>>;
  setRowIndexMap: Dispatch<SetStateAction<number[] | null>>;
  setTabDataMap: Dispatch<SetStateAction<Map<string, TabFileData>>>;
  t: (en: string, zh: string) => string;
};

export default function useTabLifecycle({
  activeTabId,
  tabs,
  tabDataMap,
  patches,
  rowOps,
  columnOps,
  textDirty,
  loadTabData,
  saveCurrentTabData,
  saveCurrent,
  resetTextSession,
  setTabs,
  setActiveTabId,
  setFileMode,
  setRows,
  setHeaders,
  setPatches,
  setRowIndexMap,
  setTabDataMap,
  t,
}: UseTabLifecycleParams) {
  const getBaseName = useCallback((path: string) => {
    const normalized = path.replace(/\\/g, "/");
    return normalized.split("/").pop() || path;
  }, []);

  const createTab = useCallback(
    (path: string, fileType: "csv" | "text") => {
      const tabId = `${Date.now()}-${Math.random()}`;
      const fileName = getBaseName(path);
      const newTab: TabData = {
        id: tabId,
        path,
        fileName,
        isDirty: false,
        fileType,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(tabId);
      return tabId;
    },
    [getBaseName, setActiveTabId, setTabs],
  );

  const isTabDirty = useCallback(
    (tab: TabData | undefined) => {
      if (!tab) return false;
      if (tab.id === activeTabId) {
        return tab.fileType === "csv"
          ? Object.keys(patches).length > 0 || rowOps.length > 0 || columnOps.length > 0
          : textDirty;
      }
      const cached = tabDataMap.get(tab.id);
      if (!cached) return tab.isDirty;
      if (cached.fileType === "csv" && cached.csvData) {
        return (
          Object.keys(cached.csvData.patches).length > 0 ||
          cached.csvData.rowOps.length > 0 ||
          cached.csvData.columnOps.length > 0
        );
      }
      if (cached.fileType === "text" && cached.textData) {
        return cached.textData.dirty;
      }
      return tab.isDirty;
    },
    [activeTabId, columnOps.length, patches, rowOps.length, tabDataMap, textDirty],
  );

  const confirmDiscardForTab = useCallback(
    async (tab: TabData) => {
      const discard = await confirmDialog(
        t(`Discard changes to ${tab.fileName}?`, `放弃 ${tab.fileName} 的更改？`),
        { title: t("Unsaved changes", "未保存更改"), kind: "warning" },
      );
      return discard;
    },
    [t],
  );

  const confirmSaveOrDiscard = useCallback(
    async (tab: TabData) => {
      if (!isTabDirty(tab)) return true;
      if (tab.id !== activeTabId) {
        return confirmDiscardForTab(tab);
      }
      const saveChanges = await confirmDialog(
        t(`Save changes to ${tab.fileName}?`, `保存 ${tab.fileName} 的更改？`),
        { title: t("Unsaved changes", "未保存更改"), kind: "warning" },
      );
      if (saveChanges) {
        return saveCurrent();
      }
      return confirmDiscardForTab(tab);
    },
    [activeTabId, confirmDiscardForTab, isTabDirty, saveCurrent, t],
  );

  const handleTabClick = useCallback(
    async (tabId: string) => {
      if (tabId === activeTabId) return;
      if (activeTabId) {
        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        if (currentTab) {
          const ok = await confirmSaveOrDiscard(currentTab);
          if (!ok) return;
          saveCurrentTabData(activeTabId, currentTab.fileType);
        }
      }
      setActiveTabId(tabId);
      await loadTabData(tabId);
    },
    [activeTabId, confirmSaveOrDiscard, loadTabData, saveCurrentTabData, setActiveTabId, tabs],
  );

  const handleTabClose = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (tab) {
        const ok = await confirmSaveOrDiscard(tab);
        if (!ok) return;
      }

      setTabs((prev) => {
        const filtered = prev.filter((item) => item.id !== tabId);
        if (activeTabId === tabId && filtered.length > 0) {
          const nextTab = filtered[filtered.length - 1];
          setActiveTabId(nextTab.id);
          void loadTabData(nextTab.id);
        } else if (filtered.length === 0) {
          setActiveTabId(null);
          setFileMode("none");
          setRows([]);
          setHeaders([]);
          setPatches({});
          setRowIndexMap(null);
          resetTextSession();
        }
        return filtered;
      });

      setTabDataMap((prev) => {
        const next = new Map(prev);
        next.delete(tabId);
        return next;
      });
    },
    [
      activeTabId,
      confirmSaveOrDiscard,
      loadTabData,
      resetTextSession,
      setActiveTabId,
      setFileMode,
      setHeaders,
      setPatches,
      setRowIndexMap,
      setRows,
      setTabDataMap,
      setTabs,
      tabs,
    ],
  );

  return {
    createTab,
    confirmSaveOrDiscard,
    handleTabClick,
    handleTabClose,
  };
}
