export type TextRange = {
  start: number;
  end: number;
};

export type MultiCursorEditOperation =
  | { kind: "insert"; text: string }
  | { kind: "insert_per_range"; texts: string[] }
  | { kind: "backspace" }
  | { kind: "delete" };

const DEFAULT_TAB_SIZE = 4;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const visualWidthOfChar = (char: string, visualColumn: number, tabSize: number): number =>
  char === "\t" ? tabSize - (visualColumn % tabSize) : 1;

export const buildLineStarts = (content: string): number[] => {
  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
};

export const findLineIndexAtOffset = (lineStarts: number[], offset: number): number => {
  if (!lineStarts.length) return 0;
  let left = 0;
  let right = lineStarts.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    const start = lineStarts[mid];
    const nextStart = mid + 1 < lineStarts.length ? lineStarts[mid + 1] : Number.POSITIVE_INFINITY;
    if (offset < start) {
      right = mid - 1;
      continue;
    }
    if (offset >= nextStart) {
      left = mid + 1;
      continue;
    }
    return mid;
  }
  return Math.max(0, Math.min(lineStarts.length - 1, left));
};

export const measureVisualColumn = (
  content: string,
  from: number,
  to: number,
  tabSize = DEFAULT_TAB_SIZE,
): number => {
  let visualColumn = 0;
  const start = Math.max(0, Math.min(from, content.length));
  const end = Math.max(start, Math.min(to, content.length));
  for (let index = start; index < end; index += 1) {
    visualColumn += visualWidthOfChar(content[index], visualColumn, tabSize);
  }
  return visualColumn;
};

const resolveOffsetAtVisualColumn = (
  content: string,
  lineStart: number,
  lineEnd: number,
  targetColumn: number,
  tabSize: number,
): number => {
  let index = lineStart;
  let visualColumn = 0;
  while (index < lineEnd) {
    const width = visualWidthOfChar(content[index], visualColumn, tabSize);
    if (visualColumn + width > targetColumn) {
      break;
    }
    visualColumn += width;
    index += 1;
    if (visualColumn === targetColumn) {
      break;
    }
  }
  return index;
};

const getLineEndByIndex = (
  content: string,
  lineStarts: number[],
  lineIndex: number,
): number => {
  const lineStart = lineStarts[lineIndex] ?? 0;
  if (lineIndex + 1 >= lineStarts.length) {
    return content.length;
  }
  return Math.max(lineStart, lineStarts[lineIndex + 1] - 1);
};

export const normalizeRanges = (ranges: TextRange[]): TextRange[] => {
  if (!ranges.length) return [];
  const sorted = ranges
    .map((range) => ({
      start: Math.min(range.start, range.end),
      end: Math.max(range.start, range.end),
    }))
    .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
  }
  return merged;
};

export const findNextOccurrenceRange = (
  content: string,
  query: string,
  existingRanges: TextRange[],
): TextRange | null => {
  const normalized = normalizeRanges(existingRanges);
  if (!query) return null;
  const from = normalized.length ? normalized[normalized.length - 1].end : 0;
  const seen = new Set(normalized.map((range) => `${range.start}:${range.end}`));
  const checkCandidate = (start: number): TextRange | null => {
    if (start < 0) return null;
    const candidate = { start, end: start + query.length };
    if (seen.has(`${candidate.start}:${candidate.end}`)) return null;
    return candidate;
  };

  const next = checkCandidate(content.indexOf(query, from));
  if (next) return next;
  return checkCandidate(content.indexOf(query, 0));
};

export const findAllOccurrenceRanges = (
  content: string,
  query: string,
  maxCount = 2048,
): TextRange[] => {
  if (!query || maxCount <= 0) return [];
  const ranges: TextRange[] = [];
  let from = 0;
  while (from <= content.length && ranges.length < maxCount) {
    const index = content.indexOf(query, from);
    if (index < 0) break;
    const end = index + query.length;
    ranges.push({ start: index, end });
    from = end;
  }
  return ranges;
};

export const applyMultiCursorEdit = (
  content: string,
  ranges: TextRange[],
  operation: MultiCursorEditOperation,
): { content: string; ranges: TextRange[] } => {
  const normalized = normalizeRanges(ranges);
  if (!normalized.length) return { content, ranges: [] };
  let nextContent = content;
  let offsetDelta = 0;
  const nextRanges: TextRange[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const originalRange = normalized[index];
    const start = clamp(originalRange.start + offsetDelta, 0, nextContent.length);
    const end = clamp(originalRange.end + offsetDelta, start, nextContent.length);
    let replaceStart = start;
    let replaceEnd = end;
    let insertText = "";

    if (operation.kind === "insert") {
      insertText = operation.text;
    } else if (operation.kind === "insert_per_range") {
      if (!operation.texts.length) {
        nextRanges.push({ start, end: start });
        continue;
      }
      insertText = operation.texts[Math.min(index, operation.texts.length - 1)];
    } else if (operation.kind === "backspace") {
      if (start === end) {
        if (start <= 0) {
          nextRanges.push({ start, end: start });
          continue;
        }
        replaceStart = start - 1;
        replaceEnd = start;
      }
    } else if (operation.kind === "delete" && start === end) {
      if (start >= nextContent.length) {
        nextRanges.push({ start, end: start });
        continue;
      }
      replaceStart = start;
      replaceEnd = start + 1;
    }

    nextContent = `${nextContent.slice(0, replaceStart)}${insertText}${nextContent.slice(replaceEnd)}`;
    const nextCursor = replaceStart + insertText.length;
    const replacedLength = replaceEnd - replaceStart;
    offsetDelta += insertText.length - replacedLength;
    nextRanges.push({ start: nextCursor, end: nextCursor });
  }

  return { content: nextContent, ranges: nextRanges };
};

export const buildLineEndCursorRanges = (
  content: string,
  start: number,
  end: number,
): TextRange[] => {
  const minPos = clamp(Math.min(start, end), 0, content.length);
  const maxPos = clamp(Math.max(start, end), 0, content.length);
  if (maxPos <= minPos) return [];

  const ranges: TextRange[] = [];
  let lineStart = 0;
  while (lineStart <= content.length) {
    const newlineIndex = content.indexOf("\n", lineStart);
    const lineEnd = newlineIndex >= 0 ? newlineIndex : content.length;
    const overlaps = lineEnd >= minPos && lineStart <= maxPos;
    if (overlaps) {
      ranges.push({ start: lineEnd, end: lineEnd });
    }
    if (newlineIndex < 0) break;
    lineStart = newlineIndex + 1;
  }

  return normalizeRanges(ranges);
};

export const buildVerticalCursorRanges = (
  content: string,
  ranges: TextRange[],
  direction: -1 | 1,
  tabSize = DEFAULT_TAB_SIZE,
): TextRange[] => {
  const normalized = normalizeRanges(ranges);
  if (!normalized.length) return [];
  const lineStarts = buildLineStarts(content);
  const nextRanges: TextRange[] = [];

  for (const range of normalized) {
    const anchor = clamp(Math.max(range.start, range.end), 0, content.length);
    const lineIndex = findLineIndexAtOffset(lineStarts, anchor);
    const targetLineIndex = lineIndex + direction;
    if (targetLineIndex < 0 || targetLineIndex >= lineStarts.length) {
      continue;
    }
    const lineStart = lineStarts[lineIndex];
    const visualColumn = measureVisualColumn(content, lineStart, anchor, tabSize);
    const targetStart = lineStarts[targetLineIndex];
    const targetEnd =
      targetLineIndex + 1 < lineStarts.length
        ? Math.max(targetStart, lineStarts[targetLineIndex + 1] - 1)
        : content.length;
    const targetOffset = resolveOffsetAtVisualColumn(
      content,
      targetStart,
      targetEnd,
      visualColumn,
      tabSize,
    );
    nextRanges.push({ start: targetOffset, end: targetOffset });
  }

  return normalizeRanges(nextRanges);
};

export const moveOffsetByVisualColumns = (
  content: string,
  offset: number,
  deltaColumns: number,
  tabSize = DEFAULT_TAB_SIZE,
): number => {
  if (deltaColumns === 0) {
    return clamp(offset, 0, content.length);
  }
  const safeOffset = clamp(offset, 0, content.length);
  const lineStarts = buildLineStarts(content);
  const lineIndex = findLineIndexAtOffset(lineStarts, safeOffset);
  const lineStart = lineStarts[lineIndex] ?? 0;
  const lineEnd = getLineEndByIndex(content, lineStarts, lineIndex);
  const currentColumn = measureVisualColumn(content, lineStart, safeOffset, tabSize);
  const targetColumn = Math.max(0, currentColumn + deltaColumns);
  return resolveOffsetAtVisualColumn(content, lineStart, lineEnd, targetColumn, tabSize);
};

export const moveOffsetByLines = (
  content: string,
  offset: number,
  deltaLines: number,
  tabSize = DEFAULT_TAB_SIZE,
): number => {
  if (deltaLines === 0) {
    return clamp(offset, 0, content.length);
  }
  const safeOffset = clamp(offset, 0, content.length);
  const lineStarts = buildLineStarts(content);
  const lineIndex = findLineIndexAtOffset(lineStarts, safeOffset);
  const targetIndex = lineIndex + deltaLines;
  if (targetIndex < 0 || targetIndex >= lineStarts.length) {
    return safeOffset;
  }
  const lineStart = lineStarts[lineIndex] ?? 0;
  const targetStart = lineStarts[targetIndex] ?? 0;
  const targetEnd = getLineEndByIndex(content, lineStarts, targetIndex);
  const currentColumn = measureVisualColumn(content, lineStart, safeOffset, tabSize);
  return resolveOffsetAtVisualColumn(content, targetStart, targetEnd, currentColumn, tabSize);
};

export const moveOffsetToLineBoundary = (
  content: string,
  offset: number,
  boundary: "start" | "end",
): number => {
  const safeOffset = clamp(offset, 0, content.length);
  const lineStarts = buildLineStarts(content);
  const lineIndex = findLineIndexAtOffset(lineStarts, safeOffset);
  if (boundary === "start") {
    return lineStarts[lineIndex] ?? 0;
  }
  return getLineEndByIndex(content, lineStarts, lineIndex);
};

export const buildBlockSelectionRanges = (
  content: string,
  anchorOffset: number,
  focusOffset: number,
  tabSize = DEFAULT_TAB_SIZE,
): TextRange[] => {
  const safeAnchor = clamp(anchorOffset, 0, content.length);
  const safeFocus = clamp(focusOffset, 0, content.length);
  if (safeAnchor === safeFocus) return [];

  const lineStarts = buildLineStarts(content);
  const anchorLineIndex = findLineIndexAtOffset(lineStarts, safeAnchor);
  const focusLineIndex = findLineIndexAtOffset(lineStarts, safeFocus);
  const rowStart = Math.min(anchorLineIndex, focusLineIndex);
  const rowEnd = Math.max(anchorLineIndex, focusLineIndex);

  const anchorLineStart = lineStarts[anchorLineIndex];
  const focusLineStart = lineStarts[focusLineIndex];
  const anchorColumn = measureVisualColumn(content, anchorLineStart, safeAnchor, tabSize);
  const focusColumn = measureVisualColumn(content, focusLineStart, safeFocus, tabSize);
  const columnStart = Math.min(anchorColumn, focusColumn);
  const columnEnd = Math.max(anchorColumn, focusColumn);

  const ranges: TextRange[] = [];
  for (let lineIndex = rowStart; lineIndex <= rowEnd; lineIndex += 1) {
    const lineStart = lineStarts[lineIndex];
    const lineEnd = getLineEndByIndex(content, lineStarts, lineIndex);
    const rangeStart = resolveOffsetAtVisualColumn(
      content,
      lineStart,
      lineEnd,
      columnStart,
      tabSize,
    );
    const rangeEnd = resolveOffsetAtVisualColumn(
      content,
      lineStart,
      lineEnd,
      columnEnd,
      tabSize,
    );
    ranges.push({
      start: Math.min(rangeStart, rangeEnd),
      end: Math.max(rangeStart, rangeEnd),
    });
  }
  return normalizeRanges(ranges);
};
