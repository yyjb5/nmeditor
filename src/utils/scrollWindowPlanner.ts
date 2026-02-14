export type ScrollPlan =
  | { kind: "jump"; start: number; direction: "up" | "down" }
  | { kind: "next"; start: number }
  | { kind: "prev"; start: number }
  | { kind: "none"; reason: "loading" | "eof" | "down-bound" | "middle" | "no-rows" };

type ScrollPlanInput = {
  scrollTop: number;
  viewHeight: number;
  rowHeight: number;
  windowStart: number;
  rowsLength: number;
  effectiveTotalRows: number | null;
  eof: boolean;
  loadingInProgress: boolean;
};

export function planWindowRequestForScroll(input: ScrollPlanInput): ScrollPlan {
  const {
    scrollTop,
    viewHeight,
    rowHeight,
    windowStart,
    rowsLength,
    effectiveTotalRows,
    eof,
    loadingInProgress,
  } = input;

  if (rowsLength <= 0) {
    return { kind: "none", reason: "no-rows" };
  }

  const safeRowHeight = Math.max(rowHeight, 1);
  const threshold = safeRowHeight * 6;
  const loadedWindowTop = windowStart * safeRowHeight;
  const loadedWindowBottom = loadedWindowTop + rowsLength * safeRowHeight;

  const farAboveLoaded = scrollTop + viewHeight < loadedWindowTop - threshold;
  const farBelowLoaded = scrollTop > loadedWindowBottom + threshold;

  if (farAboveLoaded || farBelowLoaded) {
    const approxRow = Math.floor(scrollTop / safeRowHeight);
    const halfWindow = Math.floor(rowsLength / 2);
    let targetStart = Math.max(0, approxRow - halfWindow);
    if (effectiveTotalRows !== null) {
      targetStart = Math.min(
        targetStart,
        Math.max(effectiveTotalRows - Math.max(rowsLength, 1), 0),
      );
    }
    return {
      kind: "jump",
      start: targetStart,
      direction: farBelowLoaded ? "down" : "up",
    };
  }

  if (loadingInProgress) {
    return { kind: "none", reason: "loading" };
  }

  if (scrollTop + viewHeight >= loadedWindowBottom - threshold) {
    if (eof) {
      return { kind: "none", reason: "eof" };
    }
    const nextStart = windowStart + rowsLength;
    if (effectiveTotalRows === null || nextStart < effectiveTotalRows) {
      return { kind: "next", start: nextStart };
    }
    return { kind: "none", reason: "down-bound" };
  }

  if (scrollTop <= loadedWindowTop + threshold && windowStart > 0) {
    const prevStart = Math.max(windowStart - rowsLength, 0);
    return { kind: "prev", start: prevStart };
  }

  return { kind: "none", reason: "middle" };
}
