import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

interface RuleWithColumn {
  column: string;
}

export interface UseCsvGlobalViewPatchQueueOptions {
  hasSortFilter: boolean;
  sortRules: RuleWithColumn[];
  filterRules: RuleWithColumn[];
  debounceMs: number;
  setGlobalViewPatchTick: Dispatch<SetStateAction<number>>;
}

export default function useCsvGlobalViewPatchQueue({
  hasSortFilter,
  sortRules,
  filterRules,
  debounceMs,
  setGlobalViewPatchTick,
}: UseCsvGlobalViewPatchQueueOptions) {
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef(false);

  const relevantColumns = useMemo(() => {
    const columns = new Set<number>();
    sortRules.forEach((rule) => {
      const parsed = Number.parseInt(rule.column, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) columns.add(parsed);
    });
    filterRules.forEach((rule) => {
      const parsed = Number.parseInt(rule.column, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) columns.add(parsed);
    });
    return columns;
  }, [sortRules, filterRules]);

  const queueGlobalViewPatchRefresh = useCallback(
    (column: number) => {
      if (!hasSortFilter) return;
      if (relevantColumns.size > 0 && !relevantColumns.has(column)) return;
      pendingRef.current = true;
      if (timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!pendingRef.current) return;
        pendingRef.current = false;
        setGlobalViewPatchTick((current) => current + 1);
      }, debounceMs);
    },
    [hasSortFilter, relevantColumns, debounceMs, setGlobalViewPatchTick],
  );

  useEffect(() => {
    if (hasSortFilter) return;
    pendingRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [hasSortFilter]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  return {
    queueGlobalViewPatchRefresh,
  };
}
