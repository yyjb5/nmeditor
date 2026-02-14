import type useCsvDataModel from "./useCsvDataModel";

type BuildCsvDataModelOptionsContext = Record<string, any>;

export default function buildCsvDataModelOptions(
  ctx: BuildCsvDataModelOptionsContext,
): Parameters<typeof useCsvDataModel>[0] {
  return {
    rows: ctx.rows,
    headers: ctx.headers,
    setRows: ctx.setRows,
    setHeaders: ctx.setHeaders,
    windowStart: ctx.windowStart,
    dataColumnCount: ctx.dataColumnCount,
    rowIndexMap: ctx.rowIndexMap,
    rowIndexInput: ctx.rowIndexInput,
    columnIndexInput: ctx.columnIndexInput,
    columnNameInput: ctx.columnNameInput,
    pasteMode: ctx.pasteMode,
    getCurrentDelimiter: ctx.getCurrentDelimiter,
    getActiveRange: ctx.getActiveRange,
    clearSelection: ctx.clearSelection,
    setError: ctx.setError,
    onGlobalViewPatchRefresh: ctx.onGlobalViewPatchRefresh,
    t: ctx.t,
  };
}
