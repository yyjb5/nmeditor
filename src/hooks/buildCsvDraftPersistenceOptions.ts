import type useCsvDraftPersistence from "./useCsvDraftPersistence";

type BuildCsvDraftPersistenceOptionsContext = Record<string, any>;

export default function buildCsvDraftPersistenceOptions(
  ctx: BuildCsvDraftPersistenceOptionsContext,
): Parameters<typeof useCsvDraftPersistence>[0] {
  return {
    fileMode: ctx.fileMode,
    path: ctx.path,
    patches: ctx.patches,
    clearedRows: ctx.clearedRows,
    clearedCols: ctx.clearedCols,
  };
}
