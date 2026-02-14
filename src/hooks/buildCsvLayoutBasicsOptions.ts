import type useCsvLayoutBasics from "./useCsvLayoutBasics";

type BuildCsvLayoutBasicsOptionsContext = Record<string, any>;

export default function buildCsvLayoutBasicsOptions(
  ctx: BuildCsvLayoutBasicsOptionsContext,
): Parameters<typeof useCsvLayoutBasics>[0] {
  return {
    rows: ctx.rows,
    headersLength: ctx.headersLength,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    maxUiColumns: ctx.maxUiColumns,
    normalizeColumnWidthsRaw: ctx.normalizeColumnWidthsRaw,
  };
}
