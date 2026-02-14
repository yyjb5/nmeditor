import type useCsvFindLifecycleEffects from "./useCsvFindLifecycleEffects";

type BuildCsvFindLifecycleEffectsOptionsContext = Record<string, any>;

export default function buildCsvFindLifecycleEffectsOptions(
  ctx: BuildCsvFindLifecycleEffectsOptionsContext,
): Parameters<typeof useCsvFindLifecycleEffects>[0] {
  return {
    clearFindMatches: ctx.clearFindMatches,
    findScope: ctx.findScope,
    findText: ctx.findText,
    findColumnInput: ctx.findColumnInput,
    findStartRow: ctx.findStartRow,
    findEndRow: ctx.findEndRow,
    useRegex: ctx.useRegex,
    matchCase: ctx.matchCase,
    findMatchesSource: ctx.findMatchesSource,
    rows: ctx.rows,
    windowStart: ctx.windowStart,
  };
}
