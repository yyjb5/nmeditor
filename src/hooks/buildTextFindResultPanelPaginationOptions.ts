import type useTextFindResultPanelPagination from "./useTextFindResultPanelPagination";

type BuildTextFindResultPanelPaginationOptionsContext = Record<string, any>;

export default function buildTextFindResultPanelPaginationOptions(
  ctx: BuildTextFindResultPanelPaginationOptionsContext,
): Parameters<typeof useTextFindResultPanelPagination>[0] {
  return {
    textFindHitsLength: ctx.textFindHitsLength,
    pageLimit: ctx.pageLimit,
  };
}
