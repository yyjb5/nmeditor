import { useCallback, useMemo, useState } from "react";

type SortDirection = "asc" | "desc";
type SortRule = { column: string; direction: SortDirection };
type FilterRule = { column: string; value: string };

export default function useCsvSortFilterModel() {
  const [sortColumnInput, setSortColumnInput] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterColumnInput, setFilterColumnInput] = useState("");
  const [filterText, setFilterText] = useState("");
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);

  const hasSortFilter = sortRules.length > 0 || filterRules.length > 0;

  const upsertFilterRule = useCallback((column: string, value: string) => {
    const columnKey = column.trim();
    if (!columnKey) return;
    const nextValue = value.trim();
    setFilterRules((current) => {
      const withoutColumn = current.filter((rule) => rule.column !== columnKey);
      if (!nextValue) return withoutColumn;
      return [...withoutColumn, { column: columnKey, value: nextValue }];
    });
  }, []);

  const addSortRule = useCallback(() => {
    const column = sortColumnInput.trim();
    if (!column) return;
    setSortRules((current) => [...current, { column, direction: sortDirection }]);
    setSortColumnInput("");
  }, [sortColumnInput, sortDirection]);

  const addFilterRule = useCallback(() => {
    const column = filterColumnInput.trim();
    const value = filterText.trim();
    if (!column || !value) return;
    upsertFilterRule(column, value);
    setFilterColumnInput("");
    setFilterText("");
  }, [filterColumnInput, filterText, upsertFilterRule]);

  const clearSortFilter = useCallback(() => {
    setSortRules([]);
    setFilterRules([]);
  }, []);

  const removeSortRule = useCallback((index: number) => {
    setSortRules((current) => current.filter((_, idx) => idx !== index));
  }, []);

  const removeFilterRule = useCallback((index: number) => {
    setFilterRules((current) => current.filter((_, idx) => idx !== index));
  }, []);

  const filterColumnValues = useMemo(() => {
    const values: Record<number, string> = {};
    filterRules.forEach((rule) => {
      const column = Number.parseInt(rule.column, 10);
      if (Number.isNaN(column) || column < 0) return;
      values[column] = rule.value;
    });
    return values;
  }, [filterRules]);

  const filteredColumns = useMemo(() => {
    const next = new Set<number>();
    Object.keys(filterColumnValues).forEach((key) => {
      const parsed = Number.parseInt(key, 10);
      if (Number.isNaN(parsed) || parsed < 0) return;
      next.add(parsed);
    });
    return next;
  }, [filterColumnValues]);

  const applyHeaderFilter = useCallback(
    (column: number, value: string) => {
      upsertFilterRule(String(column), value);
    },
    [upsertFilterRule],
  );

  const clearHeaderFilter = useCallback(
    (column: number) => {
      upsertFilterRule(String(column), "");
    },
    [upsertFilterRule],
  );

  return {
    sortColumnInput,
    setSortColumnInput,
    sortDirection,
    setSortDirection,
    filterColumnInput,
    setFilterColumnInput,
    filterText,
    setFilterText,
    sortRules,
    setSortRules,
    filterRules,
    setFilterRules,
    hasSortFilter,
    addSortRule,
    addFilterRule,
    clearSortFilter,
    removeSortRule,
    removeFilterRule,
    filterColumnValues,
    filteredColumns,
    applyHeaderFilter,
    clearHeaderFilter,
  };
}
