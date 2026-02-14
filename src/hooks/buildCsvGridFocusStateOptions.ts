import type useCsvGridFocusState from "./useCsvGridFocusState";

type BuildCsvGridFocusStateOptionsContext = Record<string, any>;

export default function buildCsvGridFocusStateOptions(
  ctx: BuildCsvGridFocusStateOptionsContext,
): Parameters<typeof useCsvGridFocusState>[0] {
  return {
    fileMode: ctx.fileMode,
  };
}
