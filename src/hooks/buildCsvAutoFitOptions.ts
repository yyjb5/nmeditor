import type useCsvAutoFit from "./useCsvAutoFit";

type BuildCsvAutoFitOptionsContext = Record<string, any>;

export default function buildCsvAutoFitOptions(
  ctx: BuildCsvAutoFitOptionsContext,
): Parameters<typeof useCsvAutoFit>[0] {
  return {
    autoFitColumns: ctx.autoFitColumns,
    selectionColumnCount: ctx.selectionColumnCount,
    headers: ctx.headers,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
    getCellValue: ctx.getCellValue,
    setColumnWidths: ctx.setColumnWidths,
  };
}
