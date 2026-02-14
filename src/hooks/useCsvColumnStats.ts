import { useCallback, useMemo } from "react";

export interface UseCsvColumnStatsOptions {
  showStatsPanel: boolean;
  rows: string[][];
  dataColumnCount: number;
  headers: string[];
  windowStart: number;
  getCellValue: (row: number, col: number) => string;
  t: (en: string, zh: string) => string;
}

export default function useCsvColumnStats({
  showStatsPanel,
  rows,
  dataColumnCount,
  headers,
  windowStart,
  getCellValue,
  t,
}: UseCsvColumnStatsOptions) {
  const inferType = useCallback(
    (values: string[]) => {
      if (!values.length) return t("Empty", "空");
      const isNumber = values.every((value) => {
        if (value.trim() === "") return false;
        return !Number.isNaN(Number(value));
      });
      if (isNumber) return t("Number", "数字");
      const isBoolean = values.every((value) => {
        const normalized = value.trim().toLowerCase();
        return ["true", "false", "0", "1"].includes(normalized);
      });
      if (isBoolean) return t("Boolean", "布尔");
      return t("Text", "文本");
    },
    [t],
  );

  const columnStats = useMemo(() => {
    if (!showStatsPanel) return [];
    if (!rows.length || dataColumnCount === 0) return [];
    return Array.from({ length: dataColumnCount }, (_, colIndex) => {
      const values = rows.map((_, rowIndex) => getCellValue(windowStart + rowIndex, colIndex));
      const nonEmptyValues = values.filter((value) => value !== "");
      return {
        name: headers[colIndex] ?? t(`Column ${colIndex + 1}`, `列${colIndex + 1}`),
        nonEmpty: nonEmptyValues.length,
        distinct: new Set(nonEmptyValues).size,
        inferred: inferType(nonEmptyValues),
      };
    });
  }, [showStatsPanel, rows, dataColumnCount, headers, getCellValue, inferType, t, windowStart]);

  return {
    columnStats,
  };
}
