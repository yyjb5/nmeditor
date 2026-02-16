import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { invokeCmd } from "../tauriBridge";
import type { TextEncoding } from "../types";

type FindMatch = { row: number; col: number; value: string };
type TextFindHit = { offset: number; length: number };

type UseTextFileFindReplaceJobsParams = {
  textPath: string | null;
  textReadOnlyPreview: boolean;
  textEncoding: TextEncoding;
  textFindQuery: string;
  textFindUseRegex: boolean;
  textFindMatchCase: boolean;
  textFindRunning: boolean;
  textFindJobId: number | null;
  textReplaceValue: string;
  textReplacePreserveCase: boolean;
  textReplaceConfirmEach: boolean;
  textReplaceRunning: boolean;
  textReplaceJobId: number | null;
  textDirty: boolean;
  textPreviewOffset: number;
  loadTextPreviewChunkAtOffset: (offset: number) => Promise<boolean | void>;
  saveTextTo: (path: string) => Promise<boolean>;
  setTextChunkJumpInput: Dispatch<SetStateAction<string>>;
  setTextFindRunning: Dispatch<SetStateAction<boolean>>;
  setTextFindJobId: Dispatch<SetStateAction<number | null>>;
  setTextFindProgress: Dispatch<SetStateAction<number>>;
  setTextFindHits: Dispatch<SetStateAction<TextFindHit[]>>;
  setTextFindHasMore: Dispatch<SetStateAction<boolean>>;
  setTextFindMatchedCount: Dispatch<SetStateAction<number | null>>;
  setTextFindScannedBytes: Dispatch<SetStateAction<number | null>>;
  setTextFindElapsedMs: Dispatch<SetStateAction<number | null>>;
  setActiveTextFindIndex: Dispatch<SetStateAction<number>>;
  setTextReplaceRunning: Dispatch<SetStateAction<boolean>>;
  setTextReplaceJobId: Dispatch<SetStateAction<number | null>>;
  setTextReplaceProgress: Dispatch<SetStateAction<number>>;
  setTextReplaceAppliedCount: Dispatch<SetStateAction<number | null>>;
  setTextReplaceScannedBytes: Dispatch<SetStateAction<number | null>>;
  setTextReplaceElapsedMs: Dispatch<SetStateAction<number | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  resetTextFindState: () => void;
  resetTextReplaceState: () => void;
  t: (en: string, zh: string) => string;
};

export default function useTextFileFindReplaceJobs({
  textPath,
  textReadOnlyPreview,
  textEncoding,
  textFindQuery,
  textFindUseRegex,
  textFindMatchCase,
  textFindRunning,
  textFindJobId,
  textReplaceValue,
  textReplacePreserveCase,
  textReplaceConfirmEach,
  textReplaceRunning,
  textReplaceJobId,
  textDirty,
  textPreviewOffset,
  loadTextPreviewChunkAtOffset,
  saveTextTo,
  setTextChunkJumpInput,
  setTextFindRunning,
  setTextFindJobId,
  setTextFindProgress,
  setTextFindHits,
  setTextFindHasMore,
  setTextFindMatchedCount,
  setTextFindScannedBytes,
  setTextFindElapsedMs,
  setActiveTextFindIndex,
  setTextReplaceRunning,
  setTextReplaceJobId,
  setTextReplaceProgress,
  setTextReplaceAppliedCount,
  setTextReplaceScannedBytes,
  setTextReplaceElapsedMs,
  setError,
  resetTextFindState,
  resetTextReplaceState,
  t,
}: UseTextFileFindReplaceJobsParams) {
  const textFindPollTimerRef = useRef<number | null>(null);
  const textFindPollInFlightRef = useRef(false);
  const textFindPollTokenRef = useRef(0);
  const textFindConsumedCountRef = useRef(0);
  const textFindFirstPreviewLoadedRef = useRef(false);
  const textReplacePollTimerRef = useRef<number | null>(null);
  const textReplacePollInFlightRef = useRef(false);
  const textReplacePollTokenRef = useRef(0);

  const clearTextFindPoll = useCallback(() => {
    if (textFindPollTimerRef.current !== null) {
      window.clearTimeout(textFindPollTimerRef.current);
      textFindPollTimerRef.current = null;
    }
    textFindPollInFlightRef.current = false;
  }, []);

  const clearTextReplacePoll = useCallback(() => {
    if (textReplacePollTimerRef.current !== null) {
      window.clearTimeout(textReplacePollTimerRef.current);
      textReplacePollTimerRef.current = null;
    }
    textReplacePollInFlightRef.current = false;
  }, []);

  const invalidateTextJobPolling = useCallback(() => {
    textFindPollTokenRef.current += 1;
    clearTextFindPoll();
    textReplacePollTokenRef.current += 1;
    clearTextReplacePoll();
  }, [clearTextFindPoll, clearTextReplacePoll]);

  const cancelTextFindJobInternal = useCallback(
    async (markCanceled: boolean) => {
      textFindPollTokenRef.current += 1;
      clearTextFindPoll();
      if (textFindJobId !== null) {
        try {
          await invokeCmd("cancel_find_matches_job", { jobId: textFindJobId });
        } catch {
          // Ignore cancel race when job is already done.
        }
      }
      setTextFindJobId(null);
      setTextFindRunning(false);
      setTextFindProgress(0);
      if (markCanceled) {
        setError(t("Text find task canceled.", "Text find task canceled."));
      }
    },
    [
      clearTextFindPoll,
      setError,
      setTextFindJobId,
      setTextFindProgress,
      setTextFindRunning,
      t,
      textFindJobId,
    ],
  );

  const pollTextFindJob = useCallback(
    (jobId: number) => {
      const token = ++textFindPollTokenRef.current;
      clearTextFindPoll();
      const poll = async () => {
        if (token !== textFindPollTokenRef.current) return;
        if (textFindPollInFlightRef.current) return;
        textFindPollInFlightRef.current = true;
        try {
          const status = await invokeCmd<{
            job_id: number;
            progress: number;
            done: boolean;
            canceled: boolean;
            has_more: boolean;
            matched_count: number;
            scanned_rows: number;
            elapsed_ms: number;
            matches?: FindMatch[];
            matches_offset?: number;
            matches_total?: number;
            error?: string;
          }>("get_find_matches_job_status", {
            jobId,
            consumeFrom: textFindConsumedCountRef.current,
            consumeLimit: 500,
          });
          if (token !== textFindPollTokenRef.current) return;

          setTextFindProgress(Math.min(Math.max(status.progress ?? 0, 0), 1));
          setTextFindMatchedCount(typeof status.matched_count === "number" ? status.matched_count : null);
          setTextFindScannedBytes(typeof status.scanned_rows === "number" ? status.scanned_rows : null);
          setTextFindElapsedMs(typeof status.elapsed_ms === "number" ? status.elapsed_ms : null);
          setTextFindHasMore(Boolean(status.has_more));

          const chunkOffset =
            typeof status.matches_offset === "number"
              ? Math.max(status.matches_offset, 0)
              : textFindConsumedCountRef.current;
          const chunkHits = (status.matches ?? []).map((item) => ({
            offset: item.row,
            length: Math.max(item.col, 1),
          }));
          if (chunkHits.length) {
            setTextFindHits((current) => {
              const next = chunkOffset <= current.length ? current.slice(0, chunkOffset) : current.slice();
              next.push(...chunkHits);
              return next;
            });
            const consumed = chunkOffset + chunkHits.length;
            if (consumed > textFindConsumedCountRef.current) {
              textFindConsumedCountRef.current = consumed;
            }
            if (chunkOffset === 0 && !textFindFirstPreviewLoadedRef.current) {
              textFindFirstPreviewLoadedRef.current = true;
              setActiveTextFindIndex(0);
              setTextChunkJumpInput(String(chunkHits[0].offset));
              void loadTextPreviewChunkAtOffset(chunkHits[0].offset);
              setError(null);
            }
          }

          const matchesTotal = typeof status.matches_total === "number" ? status.matches_total : 0;
          const pendingChunkDrain =
            !status.canceled && !status.error && matchesTotal > textFindConsumedCountRef.current;
          if (!status.done || pendingChunkDrain) {
            textFindPollInFlightRef.current = false;
            textFindPollTimerRef.current = window.setTimeout(() => {
              void poll();
            }, 220);
            return;
          }

          clearTextFindPoll();
          setTextFindRunning(false);
          setTextFindJobId(null);

          if (status.canceled) {
            setError(t("Text find task canceled.", "Text find task canceled."));
            return;
          }
          if (status.error) {
            resetTextFindState();
            setError(status.error);
            return;
          }

          if (textFindConsumedCountRef.current < 1) {
            setActiveTextFindIndex(-1);
            setError(t("No matches found in file.", "No matches found in file."));
            return;
          }
          setError(null);
        } catch (err) {
          if (token !== textFindPollTokenRef.current) return;
          clearTextFindPoll();
          setTextFindRunning(false);
          setTextFindJobId(null);
          resetTextFindState();
          setError(String(err));
        } finally {
          textFindPollInFlightRef.current = false;
        }
      };
      void poll();
    },
    [
      clearTextFindPoll,
      loadTextPreviewChunkAtOffset,
      resetTextFindState,
      setActiveTextFindIndex,
      setError,
      setTextChunkJumpInput,
      setTextFindElapsedMs,
      setTextFindHasMore,
      setTextFindHits,
      setTextFindJobId,
      setTextFindMatchedCount,
      setTextFindProgress,
      setTextFindRunning,
      setTextFindScannedBytes,
      t,
    ],
  );

  const runTextFind = useCallback(async (): Promise<void> => {
    if (!textReadOnlyPreview || !textPath) return;
    if (!textFindQuery.trim()) {
      setError(t("Find text is required.", "Find text is required."));
      return;
    }
    if (textFindRunning || textFindJobId !== null) {
      await cancelTextFindJobInternal(false);
    }
    resetTextFindState();
    textFindConsumedCountRef.current = 0;
    textFindFirstPreviewLoadedRef.current = false;
    try {
      const started = await invokeCmd<{ job_id: number; done: boolean }>(
        "start_find_text_in_file_job",
        {
          path: textPath,
          find: textFindQuery,
          regex: textFindUseRegex,
          matchCase: textFindMatchCase,
          encoding: textEncoding,
          maxMatches: 50000,
        },
      );
      setTextFindRunning(true);
      setTextFindJobId(started.job_id);
      setTextFindProgress(0);
      setError(null);
      pollTextFindJob(started.job_id);
    } catch (err) {
      resetTextFindState();
      setError(String(err));
    }
  }, [
    cancelTextFindJobInternal,
    pollTextFindJob,
    resetTextFindState,
    setError,
    setTextFindJobId,
    setTextFindProgress,
    setTextFindRunning,
    t,
    textEncoding,
    textFindJobId,
    textFindMatchCase,
    textFindQuery,
    textFindRunning,
    textFindUseRegex,
    textPath,
    textReadOnlyPreview,
  ]);

  const cancelTextReplaceJobInternal = useCallback(
    async (markCanceled: boolean) => {
      textReplacePollTokenRef.current += 1;
      clearTextReplacePoll();
      if (textReplaceJobId !== null) {
        try {
          await invokeCmd("cancel_find_matches_job", { jobId: textReplaceJobId });
        } catch {
          // Ignore cancel race when job is already done.
        }
      }
      setTextReplaceJobId(null);
      setTextReplaceRunning(false);
      setTextReplaceProgress(0);
      if (markCanceled) {
        setError(t("Text replace task canceled.", "Text replace task canceled."));
      }
    },
    [
      clearTextReplacePoll,
      setError,
      setTextReplaceJobId,
      setTextReplaceProgress,
      setTextReplaceRunning,
      t,
      textReplaceJobId,
    ],
  );

  const pollTextReplaceJob = useCallback(
    (jobId: number) => {
      const token = ++textReplacePollTokenRef.current;
      clearTextReplacePoll();
      const poll = async () => {
        if (token !== textReplacePollTokenRef.current) return;
        if (textReplacePollInFlightRef.current) return;
        textReplacePollInFlightRef.current = true;
        try {
          const status = await invokeCmd<{
            job_id: number;
            progress: number;
            done: boolean;
            canceled: boolean;
            matched_count: number;
            scanned_rows: number;
            elapsed_ms: number;
            error?: string;
          }>("get_find_matches_job_status", { jobId });
          if (token !== textReplacePollTokenRef.current) return;

          setTextReplaceProgress(Math.min(Math.max(status.progress ?? 0, 0), 1));
          setTextReplaceAppliedCount(typeof status.matched_count === "number" ? status.matched_count : null);
          setTextReplaceScannedBytes(typeof status.scanned_rows === "number" ? status.scanned_rows : null);
          setTextReplaceElapsedMs(typeof status.elapsed_ms === "number" ? status.elapsed_ms : null);

          if (!status.done) {
            textReplacePollInFlightRef.current = false;
            textReplacePollTimerRef.current = window.setTimeout(() => {
              void poll();
            }, 220);
            return;
          }

          clearTextReplacePoll();
          setTextReplaceRunning(false);
          setTextReplaceJobId(null);

          if (status.canceled) {
            setError(t("Text replace task canceled.", "Text replace task canceled."));
            return;
          }
          if (status.error) {
            resetTextReplaceState();
            setError(status.error);
            return;
          }
          resetTextFindState();
          if ((status.matched_count ?? 0) < 1) {
            setError(t("No matches found in file.", "No matches found in file."));
          } else {
            setError(
              t(
                `Replaced ${status.matched_count} match(es) in file.`,
                `Replaced ${status.matched_count} match(es) in file.`,
              ),
            );
          }
          const loaded = await loadTextPreviewChunkAtOffset(textPreviewOffset);
          if (loaded) {
            setTextChunkJumpInput(String(textPreviewOffset));
          }
        } catch (err) {
          if (token !== textReplacePollTokenRef.current) return;
          clearTextReplacePoll();
          setTextReplaceRunning(false);
          setTextReplaceJobId(null);
          resetTextReplaceState();
          setError(String(err));
        } finally {
          textReplacePollInFlightRef.current = false;
        }
      };
      void poll();
    },
    [
      clearTextReplacePoll,
      loadTextPreviewChunkAtOffset,
      resetTextFindState,
      resetTextReplaceState,
      setError,
      setTextChunkJumpInput,
      setTextReplaceAppliedCount,
      setTextReplaceElapsedMs,
      setTextReplaceJobId,
      setTextReplaceProgress,
      setTextReplaceRunning,
      setTextReplaceScannedBytes,
      t,
      textPreviewOffset,
    ],
  );

  const runTextReplaceInFile = useCallback(async (): Promise<void> => {
    if (!textReadOnlyPreview || !textPath) return;
    if (!textFindQuery.trim()) {
      setError(t("Find text is required.", "Find text is required."));
      return;
    }
    if (textReplaceConfirmEach) {
      setError(
        t(
          "Confirm-each replace is only supported in current chunk. Use Replace next + Confirm replace.",
          "Confirm-each replace is only supported in current chunk. Use Replace next + Confirm replace.",
        ),
      );
      return;
    }
    if (textFindRunning || textFindJobId !== null) {
      await cancelTextFindJobInternal(false);
    }
    if (textReplaceRunning || textReplaceJobId !== null) {
      await cancelTextReplaceJobInternal(false);
    }
    if (textDirty) {
      const saved = await saveTextTo(textPath);
      if (!saved) return;
    }
    resetTextFindState();
    resetTextReplaceState();
    try {
      const started = await invokeCmd<{ job_id: number; done: boolean }>(
        "start_replace_text_in_file_job",
        {
          path: textPath,
          find: textFindQuery,
          replace: textReplaceValue,
          regex: textFindUseRegex,
          matchCase: textFindMatchCase,
          preserveCase: textReplacePreserveCase && !textFindUseRegex,
          encoding: textEncoding,
          targetPath: textPath,
        },
      );
      setTextReplaceRunning(true);
      setTextReplaceJobId(started.job_id);
      setTextReplaceProgress(0);
      setError(null);
      pollTextReplaceJob(started.job_id);
    } catch (err) {
      resetTextReplaceState();
      setError(String(err));
    }
  }, [
    cancelTextFindJobInternal,
    cancelTextReplaceJobInternal,
    pollTextReplaceJob,
    resetTextFindState,
    resetTextReplaceState,
    saveTextTo,
    setError,
    setTextReplaceJobId,
    setTextReplaceProgress,
    setTextReplaceRunning,
    t,
    textDirty,
    textEncoding,
    textFindJobId,
    textFindMatchCase,
    textFindQuery,
    textFindRunning,
    textFindUseRegex,
    textPath,
    textReadOnlyPreview,
    textReplaceJobId,
    textReplaceConfirmEach,
    textReplacePreserveCase,
    textReplaceRunning,
    textReplaceValue,
  ]);

  return {
    clearTextFindPoll,
    clearTextReplacePoll,
    invalidateTextJobPolling,
    cancelTextFindJobInternal,
    cancelTextReplaceJobInternal,
    runTextFind,
    runTextReplaceInFile,
  };
}
