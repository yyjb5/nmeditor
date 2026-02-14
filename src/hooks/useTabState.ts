import { useState } from "react";
import type { TabData } from "../components/TabBar/types";
import type { TabFileData } from "../types";

export default function useTabState() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabDataMap, setTabDataMap] = useState<Map<string, TabFileData>>(new Map());

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    tabDataMap,
    setTabDataMap,
  };
}
