import {
  useCallback,
  useEffect,
  useRef,
  type UIEvent,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { planWindowRequestForScroll } from "../utils/scrollWindowPlanner";
import type { DiagnosticState } from "./useDiagnostics";

type UseCsvGridVirtualizationParams = {
  fileMode: "none" | "csv" | "text";
  previewPath: string | null;
  activePath: string | null;
  rowsLength: number;
  windowStart: number;
  rowHeight: number;
  rowHeightOverrides: Record<number, number>;
  effectiveTotalRows: number | null;
  eof: boolean;
  windowLoading: boolean;
  requestWindow: (start: number) => Promise<void>;
  bumpDiagnostics: (updater: (current: DiagnosticState) => DiagnosticState) => void;
};

export default function useCsvGridVirtualization({
  fileMode,
  previewPath,
  activePath,
  rowsLength,
  windowStart,
  rowHeight,
  rowHeightOverrides,
  effectiveTotalRows,
  eof,
  windowLoading,
  requestWindow,
  bumpDiagnostics,
}: UseCsvGridVirtualizationParams) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const windowStartAdjustRef = useRef<number | null>(null);
  const suppressAutoLoadRef = useRef(false);
  const suppressAutoLoadTimerRef = useRef<number | null>(null);
  const lastAutoRequestRef = useRef<number | null>(null);

  const virtualCount = rowsLength;
  const virtualPaddingStart = windowStart * rowHeight;
  const virtualPaddingEnd =
    effectiveTotalRows !== null
      ? Math.max(effectiveTotalRows - windowStart - rowsLength, 0) * rowHeight
      : 0;

  const getRowIndex = useCallback(
    (virtualIndex: number) => windowStart + virtualIndex,
    [windowStart],
  );

  const isRowLoaded = useCallback(
    (rowIndex: number) => rowIndex >= windowStart && rowIndex < windowStart + rowsLength,
    [rowsLength, windowStart],
  );

  const getRowHeight = useCallback(
    (rowIndex: number) => rowHeightOverrides[rowIndex] ?? rowHeight,
    [rowHeight, rowHeightOverrides],
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    paddingStart: virtualPaddingStart,
    paddingEnd: virtualPaddingEnd,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => getRowHeight(getRowIndex(index)),
    overscan: 8,
  });

  useEffect(() => {
    windowStartAdjustRef.current = null;
    suppressAutoLoadRef.current = false;
    if (suppressAutoLoadTimerRef.current !== null) {
      window.clearTimeout(suppressAutoLoadTimerRef.current);
      suppressAutoLoadTimerRef.current = null;
    }
  }, [previewPath, activePath, fileMode]);

  useEffect(() => {
    lastAutoRequestRef.current = null;
  }, [windowStart, rowsLength]);

  useEffect(() => {
    const prev = windowStartAdjustRef.current;
    if (prev === null) {
      windowStartAdjustRef.current = windowStart;
      return;
    }
    const delta = windowStart - prev;
    if (delta !== 0 && parentRef.current) {
      if (Math.abs(delta) > Math.max(rowsLength, 1)) {
        windowStartAdjustRef.current = windowStart;
        return;
      }
      suppressAutoLoadRef.current = true;
      parentRef.current.scrollTop += delta * rowHeight;
      if (delta > 0 && effectiveTotalRows === null) {
        const threshold = rowHeight * 6;
        const maxScrollTop = Math.max(
          parentRef.current.scrollHeight - parentRef.current.clientHeight,
          0,
        );
        const safeTop = Math.max(maxScrollTop - threshold - 1, 0);
        if (parentRef.current.scrollTop > safeTop) {
          parentRef.current.scrollTop = safeTop;
        }
      }
      if (suppressAutoLoadTimerRef.current !== null) {
        window.clearTimeout(suppressAutoLoadTimerRef.current);
      }
      suppressAutoLoadTimerRef.current = window.setTimeout(() => {
        suppressAutoLoadRef.current = false;
        suppressAutoLoadTimerRef.current = null;
      }, 120);
    }
    windowStartAdjustRef.current = windowStart;
  }, [windowStart, rowHeight, effectiveTotalRows, rowsLength]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowHeightOverrides, rowVirtualizer]);

  const handleBodyScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (fileMode !== "csv") return;
      const target = event.currentTarget;
      const scrollTop = target.scrollTop;
      const viewHeight = target.clientHeight;
      const totalSize = rowVirtualizer.getTotalSize();
      bumpDiagnostics((current) => ({
        ...current,
        scrollEvents: current.scrollEvents + 1,
        lastScrollTop: scrollTop,
        lastTotalSize: totalSize,
        lastAction: "scroll",
      }));
      const loadingInProgress = windowLoading;
      if (loadingInProgress) {
        bumpDiagnostics((current) => ({
          ...current,
          blockedLoading: current.blockedLoading + 1,
          lastAction: "scroll-blocked-loading",
        }));
      }
      if (suppressAutoLoadRef.current) {
        bumpDiagnostics((current) => ({
          ...current,
          blockedSuppress: current.blockedSuppress + 1,
          lastAction: "scroll-blocked-suppress",
        }));
        return;
      }
      if (!rowsLength) {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "scroll-no-rows",
        }));
        return;
      }
      if (!Number.isFinite(totalSize) || totalSize <= 0) return;
      const plan = planWindowRequestForScroll({
        scrollTop,
        viewHeight,
        rowHeight,
        windowStart,
        rowsLength,
        effectiveTotalRows,
        eof,
        loadingInProgress,
      });

      if (plan.kind === "jump") {
        if (lastAutoRequestRef.current !== plan.start) {
          lastAutoRequestRef.current = plan.start;
          bumpDiagnostics((current) => ({
            ...current,
            requestCalls: current.requestCalls + 1,
            lastStart: plan.start,
            lastAction: plan.direction === "down" ? "jump-down" : "jump-up",
          }));
          void requestWindow(plan.start);
        }
        return;
      }

      if (plan.kind === "next") {
        if (lastAutoRequestRef.current !== plan.start) {
          lastAutoRequestRef.current = plan.start;
          bumpDiagnostics((current) => ({
            ...current,
            autoDown: current.autoDown + 1,
            lastStart: plan.start,
            lastAction: "auto-down",
          }));
          void requestWindow(plan.start);
        } else {
          bumpDiagnostics((current) => ({
            ...current,
            blockedDuplicate: current.blockedDuplicate + 1,
            lastAction: "scroll-blocked-dup-down",
          }));
        }
        return;
      }

      if (plan.kind === "prev") {
        if (lastAutoRequestRef.current !== plan.start) {
          lastAutoRequestRef.current = plan.start;
          bumpDiagnostics((current) => ({
            ...current,
            autoUp: current.autoUp + 1,
            lastStart: plan.start,
            lastAction: "auto-up",
          }));
          void requestWindow(plan.start);
        } else {
          bumpDiagnostics((current) => ({
            ...current,
            blockedDuplicate: current.blockedDuplicate + 1,
            lastAction: "scroll-blocked-dup-up",
          }));
        }
        return;
      }

      if (plan.reason === "eof") {
        bumpDiagnostics((current) => ({
          ...current,
          blockedEof: current.blockedEof + 1,
          lastAction: "scroll-blocked-eof",
        }));
      } else if (plan.reason === "down-bound") {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "scroll-blocked-down-bound",
        }));
      } else if (plan.reason === "loading") {
        return;
      } else {
        bumpDiagnostics((current) => ({
          ...current,
          lastAction: "scroll-middle",
        }));
      }
    },
    [
      bumpDiagnostics,
      effectiveTotalRows,
      eof,
      fileMode,
      requestWindow,
      rowHeight,
      rowVirtualizer,
      rowsLength,
      windowLoading,
      windowStart,
    ],
  );

  const loadNextWindow = useCallback(async () => {
    if (eof) {
      bumpDiagnostics((current) => ({
        ...current,
        blockedEof: current.blockedEof + 1,
        lastAction: "load-next-blocked-eof",
      }));
      return;
    }
    const nextStart = windowStart + rowsLength;
    if (effectiveTotalRows !== null && nextStart >= effectiveTotalRows) {
      bumpDiagnostics((current) => ({
        ...current,
        lastAction: "load-next-blocked-bound",
      }));
      return;
    }
    bumpDiagnostics((current) => ({
      ...current,
      autoDown: current.autoDown + 1,
      lastStart: nextStart,
      lastAction: "load-next",
    }));
    await requestWindow(nextStart);
  }, [bumpDiagnostics, effectiveTotalRows, eof, requestWindow, rowsLength, windowStart]);

  return {
    parentRef,
    rowVirtualizer,
    getRowIndex,
    isRowLoaded,
    getRowHeight,
    handleBodyScroll,
    loadNextWindow,
  };
}
