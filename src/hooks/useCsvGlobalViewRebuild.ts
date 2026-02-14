import { useEffect, type MutableRefObject } from "react";
import { invokeCmd } from "../tauriBridge";
import { GLOBAL_VIEW_REBUILD_DEBOUNCE_MS } from "../constants";
import type { ColumnOp, RowOp } from "./useRowColumnOps";

type SortRule = { column: string; direction: "asc" | "desc" };
type FilterRule = { column: string; value: string };

export interface UseCsvGlobalViewRebuildOptions {
  fileMode: "none" | "csv" | "text";
  hasSortFilter: boolean;
  sortRules: SortRule[];
  filterRules: FilterRule[];
  globalViewPatchTick: number;
  patches: Record<string, string>;
  rowOps: RowOp[];
  columnOps: ColumnOp[];
  clearedRows: Set<number>;
  clearedCols: Set<number>;
  previewPath: string | null;
  delimiterApplied: string | null;
  delimiter: string;
  sortFilterMemoryLimitMb: number;
  forceExternalSort: boolean;
  globalViewIdRef: MutableRefObject<number | null>;
  globalViewBuildRef: MutableRefObject<number>;
  globalViewRebuildTimerRef: MutableRefObject<number | null>;
  globalViewBuildRunningRef: MutableRefObject<boolean>;
  globalViewBuildPendingRef: MutableRefObject<boolean>;
  requestWindow: (start: number, path?: string, delimiterValue?: string) => Promise<void>;
  resetWindowCaches: () => void;
  releaseGlobalView: (viewId: number | null) => Promise<void>;
  setGlobalViewTotal: (value: number | null) => void;
  setGlobalViewLoading: (value: boolean) => void;
  setRowIndexMap: (next: number[] | null) => void;
  setError: (value: string | null) => void;
  t: (en: string, zh: string) => string;
}

export default function useCsvGlobalViewRebuild({
  fileMode,
  hasSortFilter,
  sortRules,
  filterRules,
  globalViewPatchTick,
  patches,
  rowOps,
  columnOps,
  clearedRows,
  clearedCols,
  previewPath,
  delimiterApplied,
  delimiter,
  sortFilterMemoryLimitMb,
  forceExternalSort,
  globalViewIdRef,
  globalViewBuildRef,
  globalViewRebuildTimerRef,
  globalViewBuildRunningRef,
  globalViewBuildPendingRef,
  requestWindow,
  resetWindowCaches,
  releaseGlobalView,
  setGlobalViewTotal,
  setGlobalViewLoading,
  setRowIndexMap,
  setError,
  t,
}: UseCsvGlobalViewRebuildOptions) {
  useEffect(() => {
    const clearRebuildTimer = () => {
      if (globalViewRebuildTimerRef.current !== null) {
        window.clearTimeout(globalViewRebuildTimerRef.current);
        globalViewRebuildTimerRef.current = null;
      }
    };
    clearRebuildTimer();

    if (fileMode !== "csv") {
      globalViewBuildPendingRef.current = false;
      return;
    }
    if (!hasSortFilter) {
      globalViewBuildRef.current += 1;
      globalViewBuildPendingRef.current = false;
      globalViewBuildRunningRef.current = false;
      if (globalViewIdRef.current) {
        const prev = globalViewIdRef.current;
        globalViewIdRef.current = null;
        setGlobalViewTotal(null);
        setRowIndexMap(null);
        void releaseGlobalView(prev);
        resetWindowCaches();
        if (previewPath) {
          void requestWindow(0, previewPath, delimiterApplied ?? delimiter);
        }
      }
      setGlobalViewLoading(false);
      return;
    }

    if (!previewPath) return;

    globalViewBuildPendingRef.current = true;

    const scheduleBuild = (delay: number) => {
      if (globalViewRebuildTimerRef.current !== null) return;
      globalViewRebuildTimerRef.current = window.setTimeout(() => {
        globalViewRebuildTimerRef.current = null;
        if (!globalViewBuildPendingRef.current) return;
        if (globalViewBuildRunningRef.current) {
          scheduleBuild(120);
          return;
        }

        globalViewBuildPendingRef.current = false;
        const buildId = ++globalViewBuildRef.current;

        const build = async () => {
          const sortRulesParsed = sortRules.map((rule) => {
            const column = Number.parseInt(rule.column, 10);
            if (Number.isNaN(column) || column < 0) {
              throw new Error(
                t(
                  "Sort column must be a non-negative number.",
                  "Sort column must be a non-negative number.",
                ),
              );
            }
            return { column, direction: rule.direction };
          });

          const filterRulesParsed = filterRules.map((rule) => {
            const column = Number.parseInt(rule.column, 10);
            if (Number.isNaN(column) || column < 0) {
              throw new Error(
                t(
                  "Filter column must be a non-negative number.",
                  "Filter column must be a non-negative number.",
                ),
              );
            }
            return { column, value: rule.value };
          });

          const patchList = Object.entries(patches).map(([key, value]) => {
            const [row, col] = key.split(":").map(Number);
            return { row, col, value };
          });

          const result = await invokeCmd<{ view_id: number; total_rows: number }>(
            "build_global_view",
            {
              path: previewPath,
              delimiter: delimiterApplied ?? delimiter,
              sortRules: sortRulesParsed,
              filterRules: filterRulesParsed,
              patches: patchList,
              rowOps,
              columnOps,
              clearRows: Array.from(clearedRows),
              clearCols: Array.from(clearedCols),
              memoryLimitMb: sortFilterMemoryLimitMb,
              forceExternalSort,
            },
          );

          if (buildId !== globalViewBuildRef.current) return;

          const prev = globalViewIdRef.current;
          globalViewIdRef.current = result.view_id;
          setGlobalViewTotal(result.total_rows);
          resetWindowCaches();
          await requestWindow(0);
          if (prev && prev !== result.view_id) {
            void releaseGlobalView(prev);
          }
        };

        globalViewBuildRunningRef.current = true;
        setError(null);
        setGlobalViewLoading(true);
        build()
          .catch((err) => {
            if (buildId !== globalViewBuildRef.current) return;
            setError(String(err));
          })
          .finally(() => {
            globalViewBuildRunningRef.current = false;
            if (buildId === globalViewBuildRef.current) {
              setGlobalViewLoading(false);
            }
            if (globalViewBuildPendingRef.current) {
              scheduleBuild(120);
            }
          });
      }, delay);
    };

    scheduleBuild(GLOBAL_VIEW_REBUILD_DEBOUNCE_MS);
    return clearRebuildTimer;
  }, [
    fileMode,
    hasSortFilter,
    sortRules,
    filterRules,
    globalViewPatchTick,
    rowOps,
    columnOps,
    clearedRows,
    clearedCols,
    previewPath,
    delimiterApplied,
    delimiter,
    sortFilterMemoryLimitMb,
    forceExternalSort,
    requestWindow,
    resetWindowCaches,
    releaseGlobalView,
    setError,
    setGlobalViewLoading,
    setGlobalViewTotal,
    setRowIndexMap,
    t,
    globalViewIdRef,
    globalViewBuildRef,
    globalViewRebuildTimerRef,
    globalViewBuildRunningRef,
    globalViewBuildPendingRef,
  ]);
}
