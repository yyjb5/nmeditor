import type useCsvHeaderFilterAndFrozenRow from "./useCsvHeaderFilterAndFrozenRow";

type BuildCsvHeaderFilterAndFrozenRowOptionsContext = Record<string, any>;

export default function buildCsvHeaderFilterAndFrozenRowOptions(
  ctx: BuildCsvHeaderFilterAndFrozenRowOptionsContext,
): Parameters<typeof useCsvHeaderFilterAndFrozenRow>[0] {
  return {
    patches: ctx.patches,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    previewDelimiter: ctx.previewDelimiter,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    hasSortFilter: ctx.hasSortFilter,
    globalViewIdRef: ctx.globalViewIdRef,
    rowOps: ctx.rowOps,
    columnOps: ctx.columnOps,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
    fileMode: ctx.fileMode,
    freezeFirstRow: ctx.freezeFirstRow,
    windowStart: ctx.windowStart,
    rowsLength: ctx.rowsLength,
    applyColumnOpsToRows: ctx.applyColumnOpsToRows,
    setFrozenFirstRowValues: ctx.setFrozenFirstRowValues,
    setFrozenFirstRowBaseIndex: ctx.setFrozenFirstRowBaseIndex,
    frozenFirstRowValues: ctx.frozenFirstRowValues,
    frozenFirstRowBaseIndex: ctx.frozenFirstRowBaseIndex,
    selectionColumnCount: ctx.selectionColumnCount,
  };
}
