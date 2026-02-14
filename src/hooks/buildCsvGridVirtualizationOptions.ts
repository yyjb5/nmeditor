import type useCsvGridVirtualization from "./useCsvGridVirtualization";

type BuildCsvGridVirtualizationOptionsContext = Record<string, any>;

export default function buildCsvGridVirtualizationOptions(
  ctx: BuildCsvGridVirtualizationOptionsContext,
): Parameters<typeof useCsvGridVirtualization>[0] {
  return {
    fileMode: ctx.fileMode,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    rowsLength: ctx.rowsLength,
    windowStart: ctx.windowStart,
    rowHeight: ctx.rowHeight,
    rowHeightOverrides: ctx.rowHeightOverrides,
    effectiveTotalRows: ctx.effectiveTotalRows,
    eof: ctx.eof,
    windowLoading: ctx.windowLoading,
    requestWindow: ctx.requestWindow,
    bumpDiagnostics: ctx.bumpDiagnostics,
  };
}
