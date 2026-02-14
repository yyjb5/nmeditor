import { useCallback, useEffect, type Dispatch, type SetStateAction, type UIEvent } from "react";

type TextFindHit = { offset: number; length: number };

type UseTextFindNavigationParams = {
  textFindHits: TextFindHit[];
  textFindHitJumpInput: string;
  setTextFindHitJumpInput: Dispatch<SetStateAction<string>>;
  textFindOffsetJumpInput: string;
  textFindResultPanelRange: { start: number; end: number };
  textFindResultPanelCanLoadMore: boolean;
  textFindHasMoreRenderedGroups: boolean;
  loadMoreTextFindRenderedGroups: () => void;
  setTextFindResultPanelStart: Dispatch<SetStateAction<number>>;
  setTextFindResultPanelPageSpan: Dispatch<SetStateAction<number>>;
  activeTextFindIndex: number;
  setActiveTextFindIndex: Dispatch<SetStateAction<number>>;
  loadTextPreviewChunkAtOffset: (offset: number) => Promise<boolean | void>;
  setTextChunkJumpInput: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  t: (en: string, zh: string) => string;
  textFindResultsPanelLimit: number;
};

export default function useTextFindNavigation({
  textFindHits,
  textFindHitJumpInput,
  setTextFindHitJumpInput,
  textFindOffsetJumpInput,
  textFindResultPanelRange,
  textFindResultPanelCanLoadMore,
  textFindHasMoreRenderedGroups,
  loadMoreTextFindRenderedGroups,
  setTextFindResultPanelStart,
  setTextFindResultPanelPageSpan,
  activeTextFindIndex,
  setActiveTextFindIndex,
  loadTextPreviewChunkAtOffset,
  setTextChunkJumpInput,
  setError,
  t,
  textFindResultsPanelLimit,
}: UseTextFindNavigationParams) {
  const jumpToTextFindHit = useCallback(
    async (index: number): Promise<void> => {
      if (index < 0 || index >= textFindHits.length) return;
      const hit = textFindHits[index];
      const pageStart = Math.floor(index / textFindResultsPanelLimit) * textFindResultsPanelLimit;
      setTextFindResultPanelStart(pageStart);
      setTextFindResultPanelPageSpan(1);
      setActiveTextFindIndex(index);
      await loadTextPreviewChunkAtOffset(hit.offset);
      setTextChunkJumpInput(String(hit.offset));
    },
    [
      loadTextPreviewChunkAtOffset,
      setActiveTextFindIndex,
      setTextChunkJumpInput,
      setTextFindResultPanelPageSpan,
      setTextFindResultPanelStart,
      textFindHits,
      textFindResultsPanelLimit,
    ],
  );

  useEffect(() => {
    if (activeTextFindIndex < 0) {
      setTextFindHitJumpInput("1");
      return;
    }
    setTextFindHitJumpInput(String(activeTextFindIndex + 1));
  }, [activeTextFindIndex, setTextFindHitJumpInput]);

  useEffect(() => {
    if (activeTextFindIndex < textFindResultPanelRange.start) return;
    if (activeTextFindIndex >= textFindResultPanelRange.end) return;
    const item = document.getElementById(`text-find-hit-${activeTextFindIndex}`);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeTextFindIndex, textFindResultPanelRange]);

  const jumpToTextFindHitFromInput = useCallback(() => {
    if (!textFindHits.length) return;
    const parsed = Number.parseInt(textFindHitJumpInput.trim(), 10);
    if (Number.isNaN(parsed)) {
      setError(t("Hit index must be a number.", "Hit index must be a number."));
      return;
    }
    const target = parsed - 1;
    if (target < 0 || target >= textFindHits.length) {
      setError(
        t(
          `Hit index must be between 1 and ${textFindHits.length}.`,
          `Hit index must be between 1 and ${textFindHits.length}.`,
        ),
      );
      return;
    }
    setError(null);
    void jumpToTextFindHit(target);
  }, [jumpToTextFindHit, setError, t, textFindHitJumpInput, textFindHits.length]);

  const jumpToTextFindHitFromOffsetInput = useCallback(() => {
    if (!textFindHits.length) return;
    const parsed = Number.parseInt(textFindOffsetJumpInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(
        t(
          "Byte offset must be a non-negative number.",
          "Byte offset must be a non-negative number.",
        ),
      );
      return;
    }
    let left = 0;
    let right = textFindHits.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (textFindHits[mid].offset < parsed) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    let target = left;
    if (target >= textFindHits.length) {
      target = textFindHits.length - 1;
    } else if (target > 0) {
      const prev = target - 1;
      const prevDistance = Math.abs(textFindHits[prev].offset - parsed);
      const currentDistance = Math.abs(textFindHits[target].offset - parsed);
      target = prevDistance <= currentDistance ? prev : target;
    }
    setError(null);
    void jumpToTextFindHit(target);
  }, [jumpToTextFindHit, setError, t, textFindHits, textFindOffsetJumpInput]);

  const jumpTextFindNext = useCallback(() => {
    if (!textFindHits.length) return;
    const next = activeTextFindIndex < 0 ? 0 : (activeTextFindIndex + 1) % textFindHits.length;
    void jumpToTextFindHit(next);
  }, [activeTextFindIndex, jumpToTextFindHit, textFindHits.length]);

  const jumpTextFindPrev = useCallback(() => {
    if (!textFindHits.length) return;
    const prev =
      activeTextFindIndex < 0
        ? textFindHits.length - 1
        : (activeTextFindIndex - 1 + textFindHits.length) % textFindHits.length;
    void jumpToTextFindHit(prev);
  }, [activeTextFindIndex, jumpToTextFindHit, textFindHits.length]);

  const jumpTextFindResultPage = useCallback(
    (direction: -1 | 1) => {
      if (!textFindHits.length) return;
      setTextFindResultPanelStart((current) => {
        const maxStart = Math.max(textFindHits.length - textFindResultsPanelLimit, 0);
        if (direction < 0) {
          return Math.max(current - textFindResultsPanelLimit, 0);
        }
        return Math.min(current + textFindResultsPanelLimit, maxStart);
      });
      setTextFindResultPanelPageSpan(1);
    },
    [setTextFindResultPanelPageSpan, setTextFindResultPanelStart, textFindHits.length, textFindResultsPanelLimit],
  );

  const jumpTextFindResultPageFirst = useCallback(() => {
    setTextFindResultPanelStart(0);
    setTextFindResultPanelPageSpan(1);
  }, [setTextFindResultPanelPageSpan, setTextFindResultPanelStart]);

  const jumpTextFindResultPageLast = useCallback(() => {
    if (!textFindHits.length) {
      setTextFindResultPanelStart(0);
      setTextFindResultPanelPageSpan(1);
      return;
    }
    const maxStart = Math.max(textFindHits.length - textFindResultsPanelLimit, 0);
    setTextFindResultPanelStart(maxStart);
    setTextFindResultPanelPageSpan(1);
  }, [setTextFindResultPanelPageSpan, setTextFindResultPanelStart, textFindHits.length, textFindResultsPanelLimit]);

  const loadMoreTextFindResultPages = useCallback(() => {
    if (!textFindResultPanelCanLoadMore) return;
    const total = textFindHits.length;
    const remaining = total - textFindResultPanelRange.start;
    const maxSpan = Math.max(1, Math.ceil(remaining / textFindResultsPanelLimit));
    setTextFindResultPanelPageSpan((current) => Math.min(current + 1, maxSpan));
  }, [
    setTextFindResultPanelPageSpan,
    textFindHits.length,
    textFindResultPanelCanLoadMore,
    textFindResultPanelRange.start,
    textFindResultsPanelLimit,
  ]);

  const handleTextFindResultsScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const distanceToBottom = target.scrollHeight - (target.scrollTop + target.clientHeight);
      if (distanceToBottom > 18) return;
      if (textFindResultPanelCanLoadMore) {
        loadMoreTextFindResultPages();
      }
      if (textFindHasMoreRenderedGroups) {
        loadMoreTextFindRenderedGroups();
      }
    },
    [
      loadMoreTextFindRenderedGroups,
      loadMoreTextFindResultPages,
      textFindHasMoreRenderedGroups,
      textFindResultPanelCanLoadMore,
    ],
  );

  return {
    jumpToTextFindHit,
    jumpToTextFindHitFromInput,
    jumpToTextFindHitFromOffsetInput,
    jumpTextFindNext,
    jumpTextFindPrev,
    jumpTextFindResultPage,
    jumpTextFindResultPageFirst,
    jumpTextFindResultPageLast,
    loadMoreTextFindResultPages,
    loadMoreTextFindRenderedGroups,
    handleTextFindResultsScroll,
  };
}
