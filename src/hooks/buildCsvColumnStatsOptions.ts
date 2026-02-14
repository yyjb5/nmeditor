import type useCsvColumnStats from "./useCsvColumnStats";

type BuildCsvColumnStatsOptionsContext = Record<string, any>;

export default function buildCsvColumnStatsOptions(
  ctx: BuildCsvColumnStatsOptionsContext,
): Parameters<typeof useCsvColumnStats>[0] {
  return {
    showStatsPanel: ctx.showStatsPanel,
    rows: ctx.rows,
    dataColumnCount: ctx.dataColumnCount,
    headers: ctx.headers,
    windowStart: ctx.windowStart,
    getCellValue: ctx.getCellValue,
    t: ctx.t,
  };
}
