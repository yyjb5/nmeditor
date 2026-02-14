import { useEffect, useState } from "react";

type AutoIndexMode = "large_only" | "all";

export default function useSortFilterPreferences() {
  const [sortFilterMemoryLimitMb, setSortFilterMemoryLimitMb] = useState(300);
  const [sortFilterMemoryLimitText, setSortFilterMemoryLimitText] = useState("300");
  const [forceExternalSort, setForceExternalSort] = useState(false);
  const [autoIndexMode, setAutoIndexMode] = useState<AutoIndexMode>("large_only");

  useEffect(() => {
    const raw = window.localStorage.getItem("nmeditor.sortfilter.memoryLimitMb");
    if (!raw) return;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 50 && parsed <= 4096) {
      setSortFilterMemoryLimitMb(parsed);
      setSortFilterMemoryLimitText(String(parsed));
    }
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("nmeditor.sortfilter.forceExternalSort");
    setForceExternalSort(raw === "1");
  }, []);

  useEffect(() => {
    const raw = window.localStorage.getItem("nmeditor.autoIndexMode");
    if (raw === "all" || raw === "large_only") {
      setAutoIndexMode(raw);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "nmeditor.sortfilter.memoryLimitMb",
      String(sortFilterMemoryLimitMb),
    );
    setSortFilterMemoryLimitText(String(sortFilterMemoryLimitMb));
  }, [sortFilterMemoryLimitMb]);

  useEffect(() => {
    if (forceExternalSort) {
      window.localStorage.setItem("nmeditor.sortfilter.forceExternalSort", "1");
      return;
    }
    window.localStorage.removeItem("nmeditor.sortfilter.forceExternalSort");
  }, [forceExternalSort]);

  useEffect(() => {
    window.localStorage.setItem("nmeditor.autoIndexMode", autoIndexMode);
  }, [autoIndexMode]);

  return {
    sortFilterMemoryLimitMb,
    setSortFilterMemoryLimitMb,
    sortFilterMemoryLimitText,
    setSortFilterMemoryLimitText,
    forceExternalSort,
    setForceExternalSort,
    autoIndexMode,
    setAutoIndexMode,
  };
}
