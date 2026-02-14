import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { invokeCmd } from "../tauriBridge";

type FindMatch = { row: number; col: number; value: string };
type FindMatchSource = "loaded" | "file" | "view";

type UseCsvFindMatchesParams = {
  findScope: "loaded" | "file";
  findText: string;
  findColumnInput: string;
  findStartRow: string;
  findEndRow: string;
  useRegex: boolean;
  matchCase: boolean;
  findRunning: boolean;
  findJobId: number | null;
  hasSortFilter: boolean;
  getGlobalViewId: () => number | null;
  preview: { path: string; delimiter: string } | null;
  dialectDelimiter: string | null;
  rows: string[][];
  windowStart: number;
  selectionColumnCount: number;
  getCellValue: (row: number, col: number) => string;
  focusFindMatch: (match: FindMatch, index: number, source: FindMatchSource) => Promise<void>;
  setFindJobId: Dispatch<SetStateAction<number | null>>;
  setFindRunning: Dispatch<SetStateAction<boolean>>;
  setFindProgress: Dispatch<SetStateAction<number>>;
  setFindCanceled: Dispatch<SetStateAction<boolean>>;
  setFindMatchedCount: Dispatch<SetStateAction<number | null>>;
  setFindScannedRows: Dispatch<SetStateAction<number | null>>;
  setFindElapsedMs: Dispatch<SetStateAction<number | null>>;
  setFindMatches: Dispatch<SetStateAction<FindMatch[]>>;
  setFindMatchesSource: Dispatch<SetStateAction<FindMatchSource>>;
  setFindMatchesHasMore: Dispatch<SetStateAction<boolean>>;
  setActiveFindMatchIndex: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  t: (en: string, zh: string) => string;
};

export default function useCsvFindMatches({
  findScope,
  findText,
  findColumnInput,
  findStartRow,
  findEndRow,
  useRegex,
  matchCase,
  findRunning,
  findJobId,
  hasSortFilter,
  getGlobalViewId,
  preview,
  dialectDelimiter,
  rows,
  windowStart,
  selectionColumnCount,
  getCellValue,
  focusFindMatch,
  setFindJobId,
  setFindRunning,
  setFindProgress,
  setFindCanceled,
  setFindMatchedCount,
  setFindScannedRows,
  setFindElapsedMs,
  setFindMatches,
  setFindMatchesSource,
  setFindMatchesHasMore,
  setActiveFindMatchIndex,
  setError,
  t,
}: UseCsvFindMatchesParams) {
  const findJobIdRef = useRef<number | null>(null);
  const findPollTimerRef = useRef<number | null>(null);
  const findPollInFlightRef = useRef(false);
  const findPollTokenRef = useRef(0);
  const findConsumedCountRef = useRef(0);
  const findFirstFocusLoadedRef = useRef(false);

  useEffect(() => {
    findJobIdRef.current = findJobId;
  }, [findJobId]);

  const clearFindPoll = useCallback(() => {
    if (findPollTimerRef.current !== null) {
      window.clearTimeout(findPollTimerRef.current);
      findPollTimerRef.current = null;
    }
    findPollInFlightRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      findPollTokenRef.current += 1;
      clearFindPoll();
    };
  }, [clearFindPoll]);

  const clearFindMatches = useCallback(() => {
    findPollTokenRef.current += 1;
    clearFindPoll();
    findConsumedCountRef.current = 0;
    findFirstFocusLoadedRef.current = false;
    const runningJobId = findJobIdRef.current;
    if (runningJobId !== null) {
      void invokeCmd("cancel_find_matches_job", { jobId: runningJobId }).catch(() => {});
    }
    setFindJobId(null);
    setFindRunning(false);
    setFindProgress(0);
    setFindCanceled(false);
    setFindMatchedCount(null);
    setFindScannedRows(null);
    setFindElapsedMs(null);
    setFindMatches([]);
    setFindMatchesSource("loaded");
    setFindMatchesHasMore(false);
    setActiveFindMatchIndex(-1);
  }, [
    clearFindPoll,
    setActiveFindMatchIndex,
    setFindCanceled,
    setFindElapsedMs,
    setFindJobId,
    setFindMatchedCount,
    setFindMatches,
    setFindMatchesHasMore,
    setFindMatchesSource,
    setFindProgress,
    setFindRunning,
    setFindScannedRows,
  ]);

  const parseOptionalFindIndex = useCallback((value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) return null;
    return parsed;
  }, []);

  const cancelFindMatchJobInternal = useCallback(
    async (markCanceled: boolean) => {
      findPollTokenRef.current += 1;
      clearFindPoll();
      if (findJobId !== null) {
        try {
          await invokeCmd("cancel_find_matches_job", { jobId: findJobId });
        } catch {
          // Ignore cancel race if job has already finished.
        }
      }
      setFindJobId(null);
      setFindRunning(false);
      setFindProgress(0);
      setFindCanceled(markCanceled);
      setFindMatchedCount(null);
      setFindScannedRows(null);
      setFindElapsedMs(null);
    },
    [
      clearFindPoll,
      findJobId,
      setFindCanceled,
      setFindElapsedMs,
      setFindJobId,
      setFindMatchedCount,
      setFindProgress,
      setFindRunning,
      setFindScannedRows,
    ],
  );

  const cancelFindMatchJob = useCallback(() => {
    void cancelFindMatchJobInternal(true);
  }, [cancelFindMatchJobInternal]);

  const pollFindMatchJob = useCallback(
    (jobId: number, source: "file" | "view") => {
      const token = ++findPollTokenRef.current;
      clearFindPoll();
      const poll = async () => {
        if (token !== findPollTokenRef.current) return;
        if (findPollInFlightRef.current) return;
        findPollInFlightRef.current = true;
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
            consumeFrom: findConsumedCountRef.current,
            consumeLimit: 500,
          });
          if (token !== findPollTokenRef.current) return;
          setFindProgress(Math.min(Math.max(status.progress ?? 0, 0), 1));
          setFindMatchedCount(typeof status.matched_count === "number" ? status.matched_count : null);
          setFindScannedRows(typeof status.scanned_rows === "number" ? status.scanned_rows : null);
          setFindElapsedMs(typeof status.elapsed_ms === "number" ? status.elapsed_ms : null);
          setFindMatchesHasMore(Boolean(status.has_more));

          const chunkOffset =
            typeof status.matches_offset === "number"
              ? Math.max(status.matches_offset, 0)
              : findConsumedCountRef.current;
          const chunkMatches = status.matches ?? [];
          if (chunkMatches.length) {
            setFindMatches((current) => {
              const next = chunkOffset <= current.length ? current.slice(0, chunkOffset) : current.slice();
              next.push(...chunkMatches);
              return next;
            });
            setFindMatchesSource(source);
            const consumed = chunkOffset + chunkMatches.length;
            if (consumed > findConsumedCountRef.current) {
              findConsumedCountRef.current = consumed;
            }
            if (chunkOffset === 0 && !findFirstFocusLoadedRef.current) {
              findFirstFocusLoadedRef.current = true;
              setError(null);
              await focusFindMatch(chunkMatches[0], 0, source);
            }
          }

          const matchesTotal = typeof status.matches_total === "number" ? status.matches_total : 0;
          const pendingChunkDrain =
            !status.canceled &&
            !status.error &&
            matchesTotal > findConsumedCountRef.current;
          if (!status.done || pendingChunkDrain) {
            findPollInFlightRef.current = false;
            findPollTimerRef.current = window.setTimeout(() => {
              void poll();
            }, 220);
            return;
          }

          clearFindPoll();
          setFindRunning(false);
          setFindJobId(null);

          if (status.canceled) {
            setFindCanceled(true);
            setError(t("Find task canceled.", "Find task canceled."));
            return;
          }
          if (status.error) {
            clearFindMatches();
            setError(status.error);
            return;
          }

          if (findConsumedCountRef.current > 0) {
            setError(null);
            return;
          }
          setActiveFindMatchIndex(-1);
          setError(
            source === "view"
              ? t("No matches found in sorted/filtered view.", "No matches found in sorted/filtered view.")
              : t("No matches found in full file.", "No matches found in full file."),
          );
        } catch (err) {
          if (token !== findPollTokenRef.current) return;
          clearFindPoll();
          setFindRunning(false);
          setFindJobId(null);
          clearFindMatches();
          setError(String(err));
        } finally {
          findPollInFlightRef.current = false;
        }
      };
      void poll();
    },
    [
      clearFindMatches,
      clearFindPoll,
      focusFindMatch,
      setActiveFindMatchIndex,
      setError,
      setFindCanceled,
      setFindElapsedMs,
      setFindJobId,
      setFindMatchedCount,
      setFindMatches,
      setFindMatchesHasMore,
      setFindMatchesSource,
      setFindProgress,
      setFindRunning,
      setFindScannedRows,
      t,
    ],
  );

  const runFindMatches = useCallback(async () => {
    if (!findText) {
      setError(t("Find text is required.", "Find text is required."));
      clearFindMatches();
      return;
    }
    setFindCanceled(false);

    const columnIndex = parseOptionalFindIndex(findColumnInput);
    const startRow = parseOptionalFindIndex(findStartRow) ?? 0;
    const parsedEndRow = parseOptionalFindIndex(findEndRow);
    if (parsedEndRow !== null && parsedEndRow < startRow) {
      setError(t("Row range is invalid.", "Row range is invalid."));
      clearFindMatches();
      return;
    }

    if (findScope === "file") {
      if (findRunning || findJobId !== null) {
        await cancelFindMatchJobInternal(false);
      }
      if (!preview?.path) return;
      const currentGlobalViewId = getGlobalViewId();
      if (hasSortFilter && !currentGlobalViewId) {
        setError(
          t(
            "Sort/filter view is still building. Please try again in a moment.",
            "Sort/filter view is still building. Please try again in a moment.",
          ),
        );
        clearFindMatches();
        return;
      }
      try {
        setFindMatches([]);
        setActiveFindMatchIndex(-1);
        setFindMatchesHasMore(false);
        setFindMatchedCount(null);
        setFindScannedRows(null);
        setFindElapsedMs(null);
        findConsumedCountRef.current = 0;
        findFirstFocusLoadedRef.current = false;
        const started = hasSortFilter
          ? await invokeCmd<{ job_id: number; done: boolean }>(
              "start_find_matches_in_global_view_job",
              {
                viewId: currentGlobalViewId,
                find: findText,
                regex: useRegex,
                matchCase,
                column: columnIndex ?? undefined,
                startRow,
                endRow: parsedEndRow ?? undefined,
                maxMatches: 50000,
              },
            )
          : await invokeCmd<{ job_id: number; done: boolean }>(
              "start_find_matches_in_file_job",
              {
                path: preview.path,
                delimiter: dialectDelimiter || preview.delimiter,
                find: findText,
                regex: useRegex,
                matchCase,
                column: columnIndex ?? undefined,
                startRow,
                endRow: parsedEndRow ?? undefined,
                maxMatches: 50000,
              },
            );
        setFindRunning(true);
        setFindCanceled(false);
        setFindProgress(0);
        setFindJobId(started.job_id);
        setError(null);
        pollFindMatchJob(started.job_id, hasSortFilter ? "view" : "file");
      } catch (err) {
        clearFindMatches();
        setError(String(err));
        setFindRunning(false);
        setFindJobId(null);
      }
      return;
    }

    if (!rows.length) {
      setError(t("No rows loaded.", "No rows loaded."));
      clearFindMatches();
      return;
    }

    const lastRow = parsedEndRow ?? rows.length - 1;
    let regex: RegExp | null = null;
    if (useRegex) {
      try {
        regex = new RegExp(findText, matchCase ? "" : "i");
      } catch (err) {
        setError(t(`Invalid regex: ${String(err)}`, `Invalid regex: ${String(err)}`));
        clearFindMatches();
        return;
      }
    }

    const findLower = findText.toLowerCase();
    const nextMatches: FindMatch[] = [];
    const MAX_MATCHES = 2000;
    const startedAt = performance.now();
    let scannedRows = 0;
    for (let localRow = startRow; localRow <= lastRow && localRow < rows.length; localRow += 1) {
      scannedRows += 1;
      const rowIndex = windowStart + localRow;
      const columns =
        columnIndex === null
          ? Array.from({ length: selectionColumnCount }, (_, idx) => idx)
          : [columnIndex];
      for (const col of columns) {
        if (col < 0 || col >= selectionColumnCount) continue;
        const value = getCellValue(rowIndex, col);
        const matched = regex
          ? regex.test(value)
          : matchCase
            ? value.includes(findText)
            : value.toLowerCase().includes(findLower);
        if (!matched) continue;
        nextMatches.push({ row: rowIndex, col, value });
        if (nextMatches.length >= MAX_MATCHES) break;
      }
      if (nextMatches.length >= MAX_MATCHES) break;
    }

    setFindMatches(nextMatches);
    setFindMatchesSource("loaded");
    setFindMatchesHasMore(nextMatches.length >= MAX_MATCHES);
    setFindMatchedCount(nextMatches.length);
    setFindScannedRows(scannedRows);
    setFindElapsedMs(Math.max(Math.round(performance.now() - startedAt), 0));
    if (nextMatches.length) {
      setError(null);
      await focusFindMatch(nextMatches[0], 0, "loaded");
      return;
    }
    setActiveFindMatchIndex(-1);
    setError(t("No matches found in loaded rows.", "No matches found in loaded rows."));
  }, [
    cancelFindMatchJobInternal,
    clearFindMatches,
    dialectDelimiter,
    findColumnInput,
    findEndRow,
    findJobId,
    findRunning,
    findScope,
    findStartRow,
    findText,
    focusFindMatch,
    getCellValue,
    getGlobalViewId,
    hasSortFilter,
    matchCase,
    parseOptionalFindIndex,
    preview,
    rows,
    selectionColumnCount,
    setActiveFindMatchIndex,
    setError,
    setFindCanceled,
    setFindElapsedMs,
    setFindJobId,
    setFindMatchedCount,
    setFindMatches,
    setFindMatchesHasMore,
    setFindMatchesSource,
    setFindProgress,
    setFindRunning,
    setFindScannedRows,
    t,
    useRegex,
    windowStart,
    pollFindMatchJob,
  ]);

  return {
    clearFindMatches,
    cancelFindMatchJob,
    runFindMatches,
  };
}
