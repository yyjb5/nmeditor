import { useState, useRef, useCallback, useEffect, MutableRefObject } from "react";
import { invokeCmd } from "../tauriBridge";
import {
    MEMORY_BUDGET_BYTES,
    WINDOW_MAX_ROWS,
    WINDOW_MIN_ROWS,
    WINDOW_TARGET_BYTES,
    PREFETCH_ENABLED,
} from "../constants";
import type { DiagnosticState } from "./useDiagnostics";
import type { CsvPreview } from "./useCsvSession";

export interface UseCsvDataLoaderOptions {
    activePath: string | null;
    preview: CsvPreview | null;
    delimiter: string;
    delimiterApplied: string | null;
    rows: string[][];
    setRows: (rows: string[][]) => void;
    setEof: (eof: boolean) => void;
    applyColumnOpsToRows: (rows: string[][]) => string[][];
    bumpDiagnostics: (updater: (current: DiagnosticState) => DiagnosticState) => void;
    globalViewIdRef: MutableRefObject<number | null>;
    setError: (err: string | null) => void;
    setLastIndexTrigger?: (trigger: "auto" | "manual") => void; // Optional if managed here or passed
    windowStart: number;
    setWindowStart: (index: number) => void;
    setRowIndexMap?: (next: number[] | null) => void;
}

export default function useCsvDataLoader({
    activePath,
    preview,
    delimiter,
    delimiterApplied,
    rows,
    setRows,
    setEof,
    applyColumnOpsToRows,
    bumpDiagnostics,
    globalViewIdRef,
    setError,
    setLastIndexTrigger, // If passed
    windowStart,
    setWindowStart,
    setRowIndexMap: setRowIndexMapExternal,
}: UseCsvDataLoaderOptions) {
    // --- State ---
    const [totalRows, setTotalRows] = useState<number | null>(null);
    const [indexJobId, setIndexJobId] = useState<number | null>(null);
    const [indexProgress, setIndexProgress] = useState(0);
    const [indexRunning, setIndexRunning] = useState(false);
    const [indexCanceled, setIndexCanceled] = useState(false);

    const [windowLoading, setWindowLoading] = useState(false);
    const [windowSize, setWindowSize] = useState(400); // Default
    const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);

    // --- Refs ---
    const pendingWindowRef = useRef<{
        start: number;
        path?: string;
        delimiter?: string;
        viewId?: number | null;
    } | null>(null);

    const windowLoadingRef = useRef(false);
    const debounceTimerRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);

    const prefetchRef = useRef<{
        start: number;
        rows: string[][];
        eof: boolean;
        path?: string;
        delimiter?: string;
        viewId?: number | null;
        rowIndices?: number[] | null;
    } | null>(null);

    const prefetchUpRef = useRef<{
        start: number;
        rows: string[][];
        eof: boolean;
        path?: string;
        delimiter?: string;
        viewId?: number | null;
        rowIndices?: number[] | null;
    } | null>(null);

    const prefetchingRef = useRef(false);
    const prefetchTimerRef = useRef<number | null>(null);
    const indexPollRef = useRef<number | null>(null);
    const indexPollTokenRef = useRef(0);
    const indexPollInFlightRef = useRef(false);
    const activeIndexRequestKeyRef = useRef<string | null>(null);

    // --- Actions ---

    const resetWindowCaches = useCallback(() => {
        if (debounceTimerRef.current !== null) {
            window.clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        pendingWindowRef.current = null;
        prefetchRef.current = null;
        prefetchUpRef.current = null;
        if (prefetchTimerRef.current !== null) {
            window.clearTimeout(prefetchTimerRef.current);
            prefetchTimerRef.current = null;
        }
        prefetchingRef.current = false;
        requestIdRef.current += 1;
        windowLoadingRef.current = false;
        setWindowLoading(false);
    }, []);

    const clearIndexPoll = useCallback(() => {
        if (indexPollRef.current !== null) {
            window.clearTimeout(indexPollRef.current);
            indexPollRef.current = null;
        }
    }, []);

    const cancelIndexBuild = useCallback(async () => {
        indexPollTokenRef.current += 1;
        indexPollInFlightRef.current = false;
        if (indexJobId === null) {
            activeIndexRequestKeyRef.current = null;
            return;
        }
        try {
            await invokeCmd("cancel_prepare_csv_index", { jobId: indexJobId });
            setIndexCanceled(true);
            setIndexRunning(false);
            setIndexJobId(null);
            activeIndexRequestKeyRef.current = null;
        } catch (err) {
            setError(String(err));
        } finally {
            clearIndexPoll();
        }
    }, [indexJobId, clearIndexPoll, setError]);

    const refreshTotalRows = useCallback(
        async (
            path: string,
            delimiterValue?: string,
            trigger: "auto" | "manual" = "manual",
        ) => {
            const resolvedDelimiter = delimiterValue ?? delimiter;
            const requestKey = `${path}::${resolvedDelimiter}`;
            if (trigger === "auto" && activeIndexRequestKeyRef.current === requestKey) {
                return;
            }
            await cancelIndexBuild();
            activeIndexRequestKeyRef.current = requestKey;
            setIndexProgress(0);
            setIndexCanceled(false);
            if (setLastIndexTrigger) setLastIndexTrigger(trigger);

            try {
                const response = await invokeCmd<{
                    job_id: number;
                    done: boolean;
                    total_rows?: number;
                }>("start_prepare_csv_index", {
                    path,
                    delimiter: resolvedDelimiter,
                });
                if (response.done) {
                    setIndexRunning(false);
                    setIndexJobId(null);
                    setIndexProgress(1);
                    activeIndexRequestKeyRef.current = null;
                    if (response.total_rows !== undefined) {
                        setTotalRows(response.total_rows);
                    }
                    return;
                }
                setIndexRunning(true);
                setIndexJobId(response.job_id);
            } catch (err) {
                setError(String(err));
                setTotalRows(null);
                setIndexRunning(false);
                activeIndexRequestKeyRef.current = null;
            }
        },
        [delimiter, cancelIndexBuild, setError, setLastIndexTrigger],
    );

    // Poll Effect
    useEffect(() => {
        if (indexJobId === null || !indexRunning) {
            clearIndexPoll();
            return;
        }
        const token = ++indexPollTokenRef.current;
        clearIndexPoll();
        const poll = async () => {
            if (token !== indexPollTokenRef.current) return;
            if (indexPollInFlightRef.current) return;
            indexPollInFlightRef.current = true;
            try {
                const status = await invokeCmd<{
                    job_id: number;
                    progress: number;
                    done: boolean;
                    canceled: boolean;
                    total_rows?: number;
                }>("get_prepare_csv_index_status", { jobId: indexJobId });
                if (token !== indexPollTokenRef.current) return;
                setIndexProgress(status.progress ?? 0);
                if (status.done) {
                    setIndexRunning(false);
                    setIndexCanceled(status.canceled);
                    setIndexJobId(null);
                    activeIndexRequestKeyRef.current = null;
                    if (status.total_rows !== undefined) {
                        setTotalRows(status.total_rows);
                    }
                    clearIndexPoll();
                    return;
                }
                indexPollRef.current = window.setTimeout(() => {
                    void poll();
                }, 350);
            } catch (err) {
                if (token !== indexPollTokenRef.current) return;
                const message = String(err);
                const missingJob =
                    message.includes("job not found") ||
                    message.includes("job_not_found");
                setIndexRunning(false);
                setIndexJobId(null);
                activeIndexRequestKeyRef.current = null;
                clearIndexPoll();
                if (!missingJob) {
                    setError(message);
                }
            } finally {
                indexPollInFlightRef.current = false;
            }
        };
        void poll();

        return () => {
            if (token === indexPollTokenRef.current) {
                indexPollTokenRef.current += 1;
            }
            indexPollInFlightRef.current = false;
            clearIndexPoll();
        };
    }, [indexJobId, indexRunning, clearIndexPoll, setError]);

    const estimateWindowSize = useCallback((sampleRows: string[][]) => {
        if (!sampleRows.length) return;
        const bytesPerRow =
            sampleRows.reduce((total, row) => {
                const rowBytes = row.reduce((sum, cell) => sum + cell.length * 2, 0);
                return total + rowBytes;
            }, 0) / sampleRows.length;
        if (!bytesPerRow || !Number.isFinite(bytesPerRow)) return;
        const safeBytes = Math.min(MEMORY_BUDGET_BYTES * 0.1, WINDOW_TARGET_BYTES);
        const maxRows = Math.max(80, Math.floor(safeBytes / Math.max(bytesPerRow, 256)));
        const clamped = Math.min(Math.max(maxRows, WINDOW_MIN_ROWS), WINDOW_MAX_ROWS);
        setWindowSize((current) => {
            const grown = Math.min(Math.max(current, WINDOW_MIN_ROWS) * 2, WINDOW_MAX_ROWS);
            const next = Math.min(clamped, grown);
            return Math.abs(next - current) >= 80 ? next : current;
        });
    }, []);

    const prefetchWindow = useCallback(
        async (
            start: number,
            path: string | undefined,
            resolvedDelimiter: string,
            direction: "down" | "up",
            viewId?: number | null,
        ) => {
            if (prefetchingRef.current) return;
            // Note: effectiveTotalRows dependency check removed for cleaner hook, 
            // or we accept totalRows as dep. 
            if (totalRows !== null && start >= totalRows && !viewId) return;
            // Actually globalViewTotal is managed in App. 
            // If we are in global view, totalRows in this hook might be null or file's total.
            // So prefetch check should be careful. 

            if (!viewId && !path) return;
            prefetchingRef.current = true;
            try {
                const slice = viewId
                    ? await invokeCmd<{
                        rows: string[][];
                        start: number;
                        end: number;
                        eof: boolean;
                        row_indices?: number[];
                    }>("read_global_view_rows", {
                        viewId,
                        start,
                        limit: windowSize,
                    })
                    : await invokeCmd<{
                        rows: string[][];
                        start: number;
                        end: number;
                        eof: boolean;
                        row_indices?: number[];
                    }>("read_csv_rows_window", {
                        path,
                        delimiter: resolvedDelimiter,
                        start,
                        limit: windowSize,
                    });
                const payload = {
                    start: slice.start,
                    rows: applyColumnOpsToRows(slice.rows),
                    eof: slice.eof,
                    path,
                    delimiter: resolvedDelimiter,
                    rowIndices: slice.row_indices ?? null,
                    viewId: viewId ?? null,
                };
                if (direction === "down") {
                    prefetchRef.current = payload;
                } else {
                    prefetchUpRef.current = payload;
                }
            } finally {
                prefetchingRef.current = false;
            }
        },
        [totalRows, windowSize, applyColumnOpsToRows],
    );

    const schedulePrefetch = useCallback(
        (
            start: number,
            path: string | undefined,
            resolvedDelimiter: string,
            direction: "down" | "up",
            viewId?: number | null,
        ) => {
            if (!PREFETCH_ENABLED) return;
            if (prefetchTimerRef.current !== null) {
                window.clearTimeout(prefetchTimerRef.current);
                prefetchTimerRef.current = null;
            }
            if (windowLoadingRef.current) {
                prefetchTimerRef.current = window.setTimeout(() => {
                    prefetchTimerRef.current = null;
                    if (!windowLoadingRef.current) {
                        void prefetchWindow(start, path, resolvedDelimiter, direction, viewId);
                    }
                }, 160);
                return;
            }
            void prefetchWindow(start, path, resolvedDelimiter, direction, viewId);
        },
        [prefetchWindow],
    );

    // Exposed for setting row index map if needed
    const [rowIndexMap, setRowIndexMap] = useState<number[] | null>(null);
    const applyRowIndexMap = useCallback(
        (next: number[] | null) => {
            setRowIndexMap(next);
            setRowIndexMapExternal?.(next);
        },
        [setRowIndexMapExternal],
    );

    const loadWindow = useCallback(
        async (start: number, pathOverride?: string, delimiterOverride?: string, reqId?: number) => {
            const path = pathOverride ?? preview?.path ?? activePath ?? undefined;
            if (!path && !globalViewIdRef.current) return;
            bumpDiagnostics((current) => ({
                ...current,
                loadCalls: current.loadCalls + 1,
                lastStart: start,
                lastAction: "load-window",
            }));

            const currentReqId = reqId ?? requestIdRef.current;
            if (currentReqId !== requestIdRef.current) return;

            const resolvedDelimiter =
                delimiterOverride ?? delimiterApplied ?? preview?.delimiter ?? delimiter;
            const viewId = globalViewIdRef.current;
            setWindowLoading(true);
            windowLoadingRef.current = true;
            if (
                prefetchRef.current &&
                (prefetchRef.current.viewId !== viewId ||
                    prefetchRef.current.path !== path ||
                    prefetchRef.current.delimiter !== resolvedDelimiter)
            ) {
                prefetchRef.current = null;
                prefetchUpRef.current = null;
            }
            try {
                const slice = viewId
                    ? await invokeCmd<{
                        rows: string[][];
                        start: number;
                        end: number;
                        eof: boolean;
                        row_indices?: number[];
                    }>("read_global_view_rows", {
                        viewId,
                        start,
                        limit: windowSize,
                    })
                    : await invokeCmd<{
                        rows: string[][];
                        start: number;
                        end: number;
                        eof: boolean;
                        row_indices?: number[];
                    }>("read_csv_rows_window", {
                        path,
                        delimiter: resolvedDelimiter,
                        start,
                        limit: windowSize,
                    });

                // Race condition check: if a newer request started, ignore this result
                if (requestIdRef.current !== currentReqId) return;
                if (slice.eof && slice.rows.length === 0 && slice.start > 0) {
                    setEof(true);
                    bumpDiagnostics((current) => ({
                        ...current,
                        lastStart: slice.start,
                        lastRows: 0,
                        lastEof: true,
                        lastAction: "load-empty-eof",
                    }));
                    return;
                }

                const normalizedRows = applyColumnOpsToRows(slice.rows);
                setRows(normalizedRows);
                // Note: frozen first row snapshot logic usually depends on start===0
                // We might need to expose a callback for that or handle it in App.
                // App handles it via refreshFrozenFirstRowSnapshot independently? 
                // Or loadWindow updates it?
                // App logic line 1540: if (slice.start === 0) setFrozenFirstRowValues(...)
                // We should expose the raw response or let App handle frozen row separately?
                // But optimization: loadWindow HAS the data.
                // So we might want to return `normalizedRows` or `slice` via a callback?
                // Or adding `setFrozenFirstRowValues` to options.

                setWindowStart(slice.start);
                setEof(slice.eof);
                bumpDiagnostics((current) => ({
                    ...current,
                    lastRows: normalizedRows.length,
                    lastEof: slice.eof,
                    lastStart: slice.start,
                    lastAction: "load-success",
                }));
                applyRowIndexMap(slice.row_indices ?? null);
                estimateWindowSize(normalizedRows);
                if (!slice.eof) {
                    const nextStart = slice.start + slice.rows.length;
                    schedulePrefetch(nextStart, path, resolvedDelimiter, "down", viewId);
                }
                if (slice.start > 0) {
                    const prevStart = Math.max(slice.start - windowSize, 0);
                    schedulePrefetch(prevStart, path, resolvedDelimiter, "up", viewId);
                }
            } catch (err) {
                if (requestIdRef.current === currentReqId) {
                    setError(String(err));
                    bumpDiagnostics((current) => ({
                        ...current,
                        lastAction: "load-error",
                    }));
                }
            } finally {
                if (requestIdRef.current === currentReqId) {
                    setWindowLoading(false);
                    windowLoadingRef.current = false;
                }
            }
        },
        [
            preview,
            activePath,
            bumpDiagnostics,
            delimiterApplied,
            delimiter,
            windowSize,
            setRows,
            setEof,
            estimateWindowSize,
            applyColumnOpsToRows,
            globalViewIdRef,
            schedulePrefetch,
            setError
        ],
    );

    const requestWindow = useCallback(
        async (start: number, pathOverride?: string, delimiterOverride?: string) => {
            const path = pathOverride ?? preview?.path ?? activePath ?? undefined;
            if (!path && !globalViewIdRef.current) {
                bumpDiagnostics((current) => ({
                    ...current,
                    lastAction: "request-skip-no-path",
                }));
                return;
            }
            bumpDiagnostics((current) => ({
                ...current,
                requestCalls: current.requestCalls + 1,
                lastStart: start,
                lastAction: "request-window",
            }));
            const resolvedDelimiter =
                delimiterOverride ?? delimiterApplied ?? preview?.delimiter ?? delimiter;
            const viewId = globalViewIdRef.current;
            const matchCache = (cache: typeof prefetchRef.current) =>
                cache &&
                cache.start === start &&
                cache.viewId === viewId &&
                cache.path === path &&
                cache.delimiter === resolvedDelimiter;

            if (matchCache(prefetchRef.current) || matchCache(prefetchUpRef.current)) {
                const cached = matchCache(prefetchRef.current)
                    ? prefetchRef.current
                    : prefetchUpRef.current;

                if (debounceTimerRef.current !== null) {
                    window.clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                    pendingWindowRef.current = null;
                }

                prefetchRef.current = null;
                prefetchUpRef.current = null;
                if (!cached) return;

                requestIdRef.current += 1;
                setWindowLoading(false);
                windowLoadingRef.current = false;
                if (cached.eof && cached.rows.length === 0 && cached.start > 0) {
                    setEof(true);
                    bumpDiagnostics((current) => ({
                        ...current,
                        cacheHits: current.cacheHits + 1,
                        lastStart: cached.start,
                        lastRows: 0,
                        lastEof: true,
                        lastAction: "request-cache-empty-eof",
                    }));
                    return;
                }

                setRows(cached.rows);
                setWindowStart(cached.start);
                setEof(cached.eof);
                bumpDiagnostics((current) => ({
                    ...current,
                    cacheHits: current.cacheHits + 1,
                    lastStart: cached.start,
                    lastRows: cached.rows.length,
                    lastEof: cached.eof,
                    lastAction: "request-cache-hit",
                }));
                applyRowIndexMap(cached.rowIndices ?? null);
                estimateWindowSize(cached.rows);
                // Prefetch logic
                if (!cached.eof) {
                    const nextStart = cached.start + cached.rows.length;
                    schedulePrefetch(nextStart, path, resolvedDelimiter, "down", viewId);
                }
                if (cached.start > 0) {
                    const prevStart = Math.max(cached.start - windowSize, 0);
                    schedulePrefetch(prevStart, path, resolvedDelimiter, "up", viewId);
                }
                return;
            }

            if (!rows.length && !windowLoadingRef.current) {
                bumpDiagnostics((current) => ({
                    ...current,
                    lastAction: "request-immediate",
                }));
                requestIdRef.current += 1;
                await loadWindow(start, path, resolvedDelimiter, requestIdRef.current);
                return;
            }

            pendingWindowRef.current = { start, path, delimiter: resolvedDelimiter, viewId };

            if (debounceTimerRef.current !== null) {
                window.clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = window.setTimeout(async () => {
                debounceTimerRef.current = null;
                const pending = pendingWindowRef.current;
                if (!pending) return;
                pendingWindowRef.current = null;
                bumpDiagnostics((current) => ({
                    ...current,
                    lastAction: "request-debounced",
                }));
                requestIdRef.current += 1;
                await loadWindow(pending.start, pending.path, pending.delimiter, requestIdRef.current);
            }, 60);
        },
        [
            activePath,
            delimiter,
            delimiterApplied,
            globalViewIdRef,
            preview?.delimiter,
            preview?.path,
            rows.length,
            bumpDiagnostics,
            estimateWindowSize,
            loadWindow,
            schedulePrefetch,
            setEof,
            setRows,
            windowSize,
        ],
    );

    return {
        totalRows,
        setTotalRows,
        indexJobId,
        setIndexJobId,
        indexProgress,
        setIndexProgress,
        indexRunning,
        setIndexRunning,
        indexCanceled,
        setIndexCanceled,
        windowStart,
        setWindowStart,
        windowLoading,
        setWindowLoading,
        windowLoadingRef,
        requestIdRef,
        windowSize,
        setWindowSize,
        fileSizeBytes,
        setFileSizeBytes,
        rowIndexMap,
        setRowIndexMap,

        // Actions
        resetWindowCaches,
        cancelIndexBuild,
        refreshTotalRows,
        loadWindow,
        requestWindow,
    };
}
