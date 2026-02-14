import { useCallback } from "react";

export interface UseTextFindReplaceResetStateOptions {
  resetTextFindResultsModel: () => void;
  setTextFindRunning: (value: boolean) => void;
  setTextFindJobId: (value: number | null) => void;
  setTextFindProgress: (value: number) => void;
  setTextFindHits: (value: Array<{
    offset: number;
    length: number;
    line: number;
    column: number;
    preview?: string;
  }>) => void;
  setTextFindResultPanelStart: (value: number) => void;
  setTextFindResultPanelPageSpan: (value: number) => void;
  setActiveTextFindIndex: (value: number) => void;
  setTextFindHasMore: (value: boolean) => void;
  setTextFindMatchedCount: (value: number | null) => void;
  setTextFindScannedBytes: (value: number | null) => void;
  setTextFindElapsedMs: (value: number | null) => void;
  setTextReplaceRunning: (value: boolean) => void;
  setTextReplaceJobId: (value: number | null) => void;
  setTextReplaceProgress: (value: number) => void;
  setTextReplaceAppliedCount: (value: number | null) => void;
  setTextReplaceScannedBytes: (value: number | null) => void;
  setTextReplaceElapsedMs: (value: number | null) => void;
}

export default function useTextFindReplaceResetState({
  resetTextFindResultsModel,
  setTextFindRunning,
  setTextFindJobId,
  setTextFindProgress,
  setTextFindHits,
  setTextFindResultPanelStart,
  setTextFindResultPanelPageSpan,
  setActiveTextFindIndex,
  setTextFindHasMore,
  setTextFindMatchedCount,
  setTextFindScannedBytes,
  setTextFindElapsedMs,
  setTextReplaceRunning,
  setTextReplaceJobId,
  setTextReplaceProgress,
  setTextReplaceAppliedCount,
  setTextReplaceScannedBytes,
  setTextReplaceElapsedMs,
}: UseTextFindReplaceResetStateOptions) {
  const resetTextFindState = useCallback(() => {
    resetTextFindResultsModel();
    setTextFindRunning(false);
    setTextFindJobId(null);
    setTextFindProgress(0);
    setTextFindHits([]);
    setTextFindResultPanelStart(0);
    setTextFindResultPanelPageSpan(1);
    setActiveTextFindIndex(-1);
    setTextFindHasMore(false);
    setTextFindMatchedCount(null);
    setTextFindScannedBytes(null);
    setTextFindElapsedMs(null);
  }, [
    resetTextFindResultsModel,
    setActiveTextFindIndex,
    setTextFindElapsedMs,
    setTextFindHasMore,
    setTextFindHits,
    setTextFindJobId,
    setTextFindMatchedCount,
    setTextFindProgress,
    setTextFindResultPanelPageSpan,
    setTextFindResultPanelStart,
    setTextFindRunning,
    setTextFindScannedBytes,
  ]);

  const resetTextReplaceState = useCallback(() => {
    setTextReplaceRunning(false);
    setTextReplaceJobId(null);
    setTextReplaceProgress(0);
    setTextReplaceAppliedCount(null);
    setTextReplaceScannedBytes(null);
    setTextReplaceElapsedMs(null);
  }, [
    setTextReplaceAppliedCount,
    setTextReplaceElapsedMs,
    setTextReplaceJobId,
    setTextReplaceProgress,
    setTextReplaceRunning,
    setTextReplaceScannedBytes,
  ]);

  return {
    resetTextFindState,
    resetTextReplaceState,
  };
}
