import type useCsvGlobalViewPatchQueue from "./useCsvGlobalViewPatchQueue";

type BuildCsvGlobalViewPatchQueueOptionsContext = Record<string, any>;

export default function buildCsvGlobalViewPatchQueueOptions(
  ctx: BuildCsvGlobalViewPatchQueueOptionsContext,
): Parameters<typeof useCsvGlobalViewPatchQueue>[0] {
  return {
    hasSortFilter: ctx.hasSortFilter,
    sortRules: ctx.sortRules,
    filterRules: ctx.filterRules,
    debounceMs: ctx.debounceMs,
    setGlobalViewPatchTick: ctx.setGlobalViewPatchTick,
  };
}
