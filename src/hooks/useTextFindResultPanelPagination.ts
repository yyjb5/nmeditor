import { useMemo, useState } from "react";

export interface UseTextFindResultPanelPaginationOptions {
  textFindHitsLength: number;
  pageLimit: number;
}

export default function useTextFindResultPanelPagination({
  textFindHitsLength,
  pageLimit,
}: UseTextFindResultPanelPaginationOptions) {
  const [textFindResultPanelStart, setTextFindResultPanelStart] = useState(0);
  const [textFindResultPanelPageSpan, setTextFindResultPanelPageSpan] = useState(1);

  const textFindResultPanelRange = useMemo(() => {
    const total = textFindHitsLength;
    if (!total) return { start: 0, end: 0 };
    const maxStart = Math.max(total - pageLimit, 0);
    const start = Math.max(0, Math.min(textFindResultPanelStart, maxStart));
    const span = Math.max(1, Math.floor(textFindResultPanelPageSpan));
    const maxEnd = start + pageLimit * span;
    return { start, end: Math.min(maxEnd, total) };
  }, [pageLimit, textFindHitsLength, textFindResultPanelPageSpan, textFindResultPanelStart]);

  const textFindResultPanelPageInfo = useMemo(() => {
    const total = textFindHitsLength;
    const totalPages = Math.max(1, Math.ceil(total / pageLimit));
    const currentPage = total
      ? Math.floor(textFindResultPanelRange.start / pageLimit) + 1
      : 1;
    return { currentPage, totalPages };
  }, [pageLimit, textFindHitsLength, textFindResultPanelRange.start]);

  const textFindResultPanelCanLoadMore = textFindResultPanelRange.end < textFindHitsLength;

  const textFindResultPanelVisiblePages = useMemo(() => {
    if (!textFindHitsLength) return 0;
    const visible = textFindResultPanelRange.end - textFindResultPanelRange.start;
    return Math.max(1, Math.ceil(visible / pageLimit));
  }, [pageLimit, textFindHitsLength, textFindResultPanelRange.end, textFindResultPanelRange.start]);

  return {
    textFindResultPanelStart,
    setTextFindResultPanelStart,
    textFindResultPanelPageSpan,
    setTextFindResultPanelPageSpan,
    textFindResultPanelRange,
    textFindResultPanelPageInfo,
    textFindResultPanelCanLoadMore,
    textFindResultPanelVisiblePages,
  };
}
