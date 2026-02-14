import { useCallback, useState } from "react";

const MAX_RECENT_FILES = 8;
const STORAGE_KEY = "nmeditor.recentFiles";

export default function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const addRecentFile = useCallback((path: string) => {
    setRecentFiles((current) => {
      const next = [path, ...current.filter((item) => item !== path)].slice(0, MAX_RECENT_FILES);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }, []);

  return { recentFiles, addRecentFile };
}
