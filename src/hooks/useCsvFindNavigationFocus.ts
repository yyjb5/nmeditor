import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { CellPoint, SelectionMode } from "./useSelection";
import type { FindMatch, FindMatchSource } from "../types";

type GridVirtualizer = {
  scrollToIndex: (
    index: number,
    options?: { align?: "auto" | "start" | "center" | "end" },
  ) => void;
};

export interface UseCsvFindNavigationFocusOptions {
  findMatches: FindMatch[];
  findMatchesSource: FindMatchSource;
  activeFindMatchIndex: number;
  setActiveFindMatchIndex: (value: number) => void;
  setIsDraggingSelection: (value: boolean) => void;
  updateSelection: (
    point: CellPoint,
    mode: SelectionMode,
    options: { shift: boolean; ctrl: boolean },
  ) => void;
  windowStart: number;
  rowsLength: number;
  rowVirtualizer: GridVirtualizer;
  hasSortFilter: boolean;
  setError: (value: string | null) => void;
  t: (en: string, zh: string) => string;
  globalViewIdRef: MutableRefObject<number | null>;
  previewPath: string | null;
  previewDelimiter: string | null;
  dialectDelimiter: string;
  effectiveTotalRows: number | null;
  windowSize: number;
  requestIdRef: MutableRefObject<number>;
  loadWindow: (
    start: number,
    pathOverride?: string,
    delimiterOverride?: string,
    reqId?: number,
  ) => Promise<void>;
}

export default function useCsvFindNavigationFocus({
  findMatches,
  findMatchesSource,
  activeFindMatchIndex,
  setActiveFindMatchIndex,
  setIsDraggingSelection,
  updateSelection,
  windowStart,
  rowsLength,
  rowVirtualizer,
  hasSortFilter,
  setError,
  t,
  globalViewIdRef,
  previewPath,
  previewDelimiter,
  dialectDelimiter,
  effectiveTotalRows,
  windowSize,
  requestIdRef,
  loadWindow,
}: UseCsvFindNavigationFocusOptions) {
  const windowStartRef = useRef(windowStart);
  const loadedRowsLengthRef = useRef(rowsLength);

  useEffect(() => {
    windowStartRef.current = windowStart;
    loadedRowsLengthRef.current = rowsLength;
  }, [rowsLength, windowStart]);

  const focusFindMatchInLoadedWindow = useCallback(
    (match: FindMatch, index: number) => {
      setActiveFindMatchIndex(index);
      setIsDraggingSelection(false);
      updateSelection(
        { row: match.row, col: match.col },
        "cell",
        { shift: false, ctrl: false },
      );
      const localRow = match.row - windowStartRef.current;
      if (localRow >= 0 && localRow < loadedRowsLengthRef.current) {
        rowVirtualizer.scrollToIndex(localRow, { align: "center" });
        return true;
      }
      return false;
    },
    [rowVirtualizer, setActiveFindMatchIndex, setIsDraggingSelection, updateSelection],
  );

  const focusFindMatch = useCallback(
    async (match: FindMatch, index: number, source: FindMatchSource) => {
      if (focusFindMatchInLoadedWindow(match, index)) return;
      if (source === "loaded") return;
      if (source === "file" && hasSortFilter) {
        setError(
          t(
            "Jump to full-file match is unavailable while sort/filter view is active.",
            "Jump to full-file match is unavailable while sort/filter view is active.",
          ),
        );
        return;
      }
      if (source === "view" && !globalViewIdRef.current) {
        setError(
          t(
            "Sorted/filtered view is unavailable. Rebuild view and retry.",
            "Sorted/filtered view is unavailable. Rebuild view and retry.",
          ),
        );
        return;
      }
      if (!previewPath) return;
      const resolvedDelimiter = dialectDelimiter || previewDelimiter || ",";
      const loadedSize = Math.max(loadedRowsLengthRef.current, windowSize, 1);
      let start = Math.max(match.row - Math.floor(loadedSize / 3), 0);
      if (effectiveTotalRows !== null) {
        start = Math.min(start, Math.max(effectiveTotalRows - loadedSize, 0));
      }

      requestIdRef.current += 1;
      await loadWindow(
        start,
        source === "file" ? previewPath : undefined,
        source === "file" ? resolvedDelimiter : undefined,
        requestIdRef.current,
      );
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      if (focusFindMatchInLoadedWindow(match, index)) return;

      requestIdRef.current += 1;
      await loadWindow(
        match.row,
        source === "file" ? previewPath : undefined,
        source === "file" ? resolvedDelimiter : undefined,
        requestIdRef.current,
      );
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      focusFindMatchInLoadedWindow(match, index);
    },
    [
      dialectDelimiter,
      effectiveTotalRows,
      focusFindMatchInLoadedWindow,
      hasSortFilter,
      loadWindow,
      previewDelimiter,
      previewPath,
      requestIdRef,
      setError,
      t,
      windowSize,
      globalViewIdRef,
    ],
  );

  const jumpToFindMatch = useCallback(
    (index: number) => {
      if (index < 0 || index >= findMatches.length) return;
      void focusFindMatch(findMatches[index], index, findMatchesSource);
    },
    [findMatches, findMatchesSource, focusFindMatch],
  );

  const jumpFindNext = useCallback(() => {
    if (!findMatches.length) return;
    const next = activeFindMatchIndex < 0
      ? 0
      : (activeFindMatchIndex + 1) % findMatches.length;
    jumpToFindMatch(next);
  }, [activeFindMatchIndex, findMatches.length, jumpToFindMatch]);

  const jumpFindPrev = useCallback(() => {
    if (!findMatches.length) return;
    const prev = activeFindMatchIndex < 0
      ? findMatches.length - 1
      : (activeFindMatchIndex - 1 + findMatches.length) % findMatches.length;
    jumpToFindMatch(prev);
  }, [activeFindMatchIndex, findMatches.length, jumpToFindMatch]);

  return {
    focusFindMatch,
    jumpToFindMatch,
    jumpFindNext,
    jumpFindPrev,
  };
}
