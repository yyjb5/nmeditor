import type useCsvInitialWindowLoad from "./useCsvInitialWindowLoad";

type BuildCsvInitialWindowLoadOptionsContext = Record<string, any>;

export default function buildCsvInitialWindowLoadOptions(
  ctx: BuildCsvInitialWindowLoadOptionsContext,
): Parameters<typeof useCsvInitialWindowLoad>[0] {
  return {
    fileMode: ctx.fileMode,
    previewPath: ctx.previewPath,
    activePath: ctx.activePath,
    delimiter: ctx.delimiter,
    delimiterApplied: ctx.delimiterApplied,
    previewDelimiter: ctx.previewDelimiter,
    refreshTotalRows: ctx.refreshTotalRows,
    loadWindow: ctx.loadWindow,
  };
}
