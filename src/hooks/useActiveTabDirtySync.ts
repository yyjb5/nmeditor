import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { TabData } from "../components/TabBar/types";
import type { ColumnOp, RowOp } from "./useRowColumnOps";

export interface UseActiveTabDirtySyncOptions {
  activeTabId: string | null;
  tabs: TabData[];
  patches: Record<string, string>;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  textDirty: boolean;
  setTabs: Dispatch<SetStateAction<TabData[]>>;
}

export default function useActiveTabDirtySync({
  activeTabId,
  tabs,
  patches,
  rowOps,
  columnOps,
  clearedRows,
  clearedCols,
  textDirty,
  setTabs,
}: UseActiveTabDirtySyncOptions) {
  useEffect(() => {
    if (!activeTabId) return;
    const currentTab = tabs.find((tab) => tab.id === activeTabId);
    if (!currentTab) return;

    const isDirty =
      currentTab.fileType === "csv"
        ? Object.keys(patches).length > 0 ||
          rowOps.length > 0 ||
          columnOps.length > 0 ||
          clearedRows.size > 0 ||
          clearedCols.size > 0
        : textDirty;

    if (currentTab.isDirty === isDirty) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.id === activeTabId ? { ...tab, isDirty } : tab)),
    );
  }, [
    activeTabId,
    tabs,
    patches,
    rowOps,
    columnOps,
    clearedRows,
    clearedCols,
    textDirty,
    setTabs,
  ]);
}
