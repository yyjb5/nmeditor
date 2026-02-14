import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { TabData } from "../components/TabBar/types";

export interface UseTabPathActionsOptions {
  activeTabId: string | null;
  setTabs: Dispatch<SetStateAction<TabData[]>>;
}

export default function useTabPathActions({
  activeTabId,
  setTabs,
}: UseTabPathActionsOptions) {
  const updateActiveTabPath = useCallback((nextPath: string) => {
    if (!activeTabId) return;
    const parts = nextPath.split(/[\\/]/);
    const fileName = parts[parts.length - 1] || nextPath;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId ? { ...tab, path: nextPath, fileName } : tab,
      ),
    );
  }, [activeTabId, setTabs]);

  return {
    updateActiveTabPath,
  };
}
