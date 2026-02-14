import type useCsvHeaderEditingActions from "./useCsvHeaderEditingActions";

type BuildCsvHeaderEditingActionsOptionsContext = Record<string, any>;

export default function buildCsvHeaderEditingActionsOptions(
  ctx: BuildCsvHeaderEditingActionsOptionsContext,
): Parameters<typeof useCsvHeaderEditingActions>[0] {
  return {
    loading: ctx.loading,
    globalViewLoading: ctx.globalViewLoading,
    hasSortFilter: ctx.hasSortFilter,
    headers: ctx.headers,
    startHeaderEditingModel: ctx.startHeaderEditingModel,
    commitHeaderEditingModel: ctx.commitHeaderEditingModel,
    cancelHeaderEditingModel: ctx.cancelHeaderEditingModel,
    pushUndo: ctx.pushUndo,
  };
}
