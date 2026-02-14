import { useCallback, useEffect, useRef } from "react";

type CsvDraftPayload = {
  patches?: Record<string, string>;
  clearedRows?: number[];
  clearedCols?: number[];
  updatedAt?: number;
};

type UseCsvDraftPersistenceParams = {
  fileMode: "none" | "csv" | "text";
  path: string | null;
  patches: Record<string, string>;
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  delayMs?: number;
};

const STORAGE_PREFIX = "nmeditor.draft.";

const getDraftKey = (path: string) => {
  const encoded = encodeURIComponent(path);
  return `${STORAGE_PREFIX}${encoded}`;
};

export default function useCsvDraftPersistence({
  fileMode,
  path,
  patches,
  clearedRows,
  clearedCols,
  delayMs = 1800,
}: UseCsvDraftPersistenceParams) {
  const draftSaveTimerRef = useRef<number | null>(null);

  const clearDraftForPath = useCallback((targetPath: string | null) => {
    if (!targetPath) return;
    try {
      window.localStorage.removeItem(getDraftKey(targetPath));
    } catch {
      // ignore storage errors
    }
  }, []);

  const loadDraftForPath = useCallback((targetPath: string) => {
    try {
      const raw = window.localStorage.getItem(getDraftKey(targetPath));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CsvDraftPayload;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (fileMode !== "csv" || !path) return;
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      const hasEdits =
        Object.keys(patches).length > 0 || clearedRows.size > 0 || clearedCols.size > 0;
      if (!hasEdits) {
        clearDraftForPath(path);
        return;
      }
      try {
        const payload = JSON.stringify({
          patches,
          clearedRows: Array.from(clearedRows),
          clearedCols: Array.from(clearedCols),
          updatedAt: Date.now(),
        });
        window.localStorage.setItem(getDraftKey(path), payload);
      } catch {
        // ignore storage failures (quota, serialization)
      }
    }, delayMs);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    };
  }, [clearedCols, clearedRows, clearDraftForPath, delayMs, fileMode, patches, path]);

  return { clearDraftForPath, loadDraftForPath };
}
