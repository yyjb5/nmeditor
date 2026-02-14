import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

export interface UseCsvColumnOrderingOptions {
  displayColumnCount: number;
  headers: string[];
  columnOrder: number[];
  t: (en: string, zh: string) => string;
  setColumnOrder: Dispatch<SetStateAction<number[]>>;
}

export default function useCsvColumnOrdering({
  displayColumnCount,
  headers,
  columnOrder,
  t,
  setColumnOrder,
}: UseCsvColumnOrderingOptions) {
  const columnSelectOptions = useMemo(() => {
    const count = Math.max(displayColumnCount, 3);
    if (headers.length) {
      const base = headers.slice(0, count).map((name, idx) => ({
        value: String(idx),
        label: name ? `${idx}: ${name}` : t(`Column ${idx + 1}`, `列${idx + 1}`),
      }));
      if (!columnOrder.length) return base;
      return columnOrder
        .filter((idx) => idx >= 0 && idx < base.length)
        .map((idx) => base[idx]);
    }
    const base = new Array(count).fill(null).map((_, idx) => ({
      value: String(idx),
      label: t(`Column ${idx + 1}`, `列${idx + 1}`),
    }));
    if (!columnOrder.length) return base;
    return columnOrder
      .filter((idx) => idx >= 0 && idx < base.length)
      .map((idx) => base[idx]);
  }, [columnOrder, displayColumnCount, headers, t]);

  const moveColumnInOrder = useCallback((index: number, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const pos = current.indexOf(index);
      if (pos === -1) return current;
      const nextPos = pos + direction;
      if (nextPos < 0 || nextPos >= current.length) return current;
      const next = [...current];
      [next[pos], next[nextPos]] = [next[nextPos], next[pos]];
      return next;
    });
  }, [setColumnOrder]);

  return {
    columnSelectOptions,
    moveColumnInOrder,
  };
}
