import { describe, expect, it } from "vitest";
import {
  applyMultiCursorEdit,
  buildBlockSelectionRanges,
  buildLineStarts,
  buildLineEndCursorRanges,
  buildVerticalCursorRanges,
  findLineIndexAtOffset,
  findAllOccurrenceRanges,
  findNextOccurrenceRange,
  measureVisualColumn,
  moveOffsetByLines,
  moveOffsetToLineBoundary,
  moveOffsetByVisualColumns,
  normalizeRanges,
} from "../multiCursor";

describe("normalizeRanges", () => {
  it("sorts and merges overlapping ranges", () => {
    const result = normalizeRanges([
      { start: 8, end: 4 },
      { start: 2, end: 5 },
      { start: 5, end: 7 },
    ]);
    expect(result).toEqual([{ start: 2, end: 8 }]);
  });
});

describe("findNextOccurrenceRange", () => {
  it("finds next non-selected occurrence and wraps", () => {
    const content = "foo bar foo baz foo";
    const next = findNextOccurrenceRange(content, "foo", [{ start: 8, end: 11 }, { start: 16, end: 19 }]);
    expect(next).toEqual({ start: 0, end: 3 });
  });
});

describe("findAllOccurrenceRanges", () => {
  it("collects all non-overlapping matches", () => {
    const ranges = findAllOccurrenceRanges("foo bar foo baz foo", "foo");
    expect(ranges).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
      { start: 16, end: 19 },
    ]);
  });
});

describe("applyMultiCursorEdit", () => {
  it("inserts text at multiple cursors", () => {
    const result = applyMultiCursorEdit(
      "abc def",
      [
        { start: 1, end: 1 },
        { start: 5, end: 5 },
      ],
      { kind: "insert", text: "X" },
    );
    expect(result.content).toBe("aXbc dXef");
    expect(result.ranges).toEqual([
      { start: 2, end: 2 },
      { start: 7, end: 7 },
    ]);
  });

  it("inserts per range for block-style multi-line paste", () => {
    const result = applyMultiCursorEdit(
      "a1\nb2\nc3",
      [
        { start: 1, end: 1 },
        { start: 4, end: 4 },
        { start: 7, end: 7 },
      ],
      { kind: "insert_per_range", texts: ["X", "Y", "Z"] },
    );
    expect(result.content).toBe("aX1\nbY2\ncZ3");
    expect(result.ranges).toEqual([
      { start: 2, end: 2 },
      { start: 6, end: 6 },
      { start: 10, end: 10 },
    ]);
  });

  it("reuses last line when pasted lines are fewer than cursors", () => {
    const result = applyMultiCursorEdit(
      "a1\nb2\nc3",
      [
        { start: 1, end: 1 },
        { start: 4, end: 4 },
        { start: 7, end: 7 },
      ],
      { kind: "insert_per_range", texts: ["L1", "L2"] },
    );
    expect(result.content).toBe("aL11\nbL22\ncL23");
  });

  it("backspace removes previous character for collapsed ranges", () => {
    const result = applyMultiCursorEdit(
      "abc def",
      [
        { start: 1, end: 1 },
        { start: 5, end: 5 },
      ],
      { kind: "backspace" },
    );
    expect(result.content).toBe("bc ef");
    expect(result.ranges).toEqual([
      { start: 0, end: 0 },
      { start: 3, end: 3 },
    ]);
  });

  it("delete removes selected ranges", () => {
    const result = applyMultiCursorEdit(
      "alpha beta gamma",
      [
        { start: 0, end: 5 },
        { start: 6, end: 10 },
      ],
      { kind: "delete" },
    );
    expect(result.content).toBe("  gamma");
    expect(result.ranges).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
    ]);
  });
});

describe("buildLineEndCursorRanges", () => {
  it("builds end-of-line cursors for selected lines", () => {
    const content = "aa\nbbb\ncccc";
    const ranges = buildLineEndCursorRanges(content, 1, 8);
    expect(ranges).toEqual([
      { start: 2, end: 2 },
      { start: 6, end: 6 },
      { start: 11, end: 11 },
    ]);
  });
});

describe("line helpers", () => {
  it("builds line starts and locates line index by offset", () => {
    const starts = buildLineStarts("ab\ncd\nef");
    expect(starts).toEqual([0, 3, 6]);
    expect(findLineIndexAtOffset(starts, 0)).toBe(0);
    expect(findLineIndexAtOffset(starts, 2)).toBe(0);
    expect(findLineIndexAtOffset(starts, 3)).toBe(1);
    expect(findLineIndexAtOffset(starts, 8)).toBe(2);
  });

  it("measures visual columns with tabs", () => {
    const content = "\ta";
    expect(measureVisualColumn(content, 0, 1)).toBe(4);
    expect(measureVisualColumn(content, 0, 2)).toBe(5);
  });
});

describe("buildVerticalCursorRanges", () => {
  it("adds cursor below keeping visual column", () => {
    const content = "ab\ncdef\nxy";
    const ranges = buildVerticalCursorRanges(content, [{ start: 1, end: 1 }], 1);
    expect(ranges).toEqual([{ start: 4, end: 4 }]);
  });

  it("adds cursor above and clamps to shorter line end", () => {
    const content = "ab\ncdef\nxy";
    const ranges = buildVerticalCursorRanges(content, [{ start: 6, end: 6 }], -1);
    expect(ranges).toEqual([{ start: 2, end: 2 }]);
  });
});

describe("buildBlockSelectionRanges", () => {
  it("builds rectangular ranges between anchor/focus lines and columns", () => {
    const content = "abcd\nefgh\nijkl";
    const ranges = buildBlockSelectionRanges(content, 1, 8);
    expect(ranges).toEqual([
      { start: 1, end: 3 },
      { start: 6, end: 8 },
    ]);
  });

  it("supports reverse drag direction and keeps same rectangle", () => {
    const content = "abcd\nefgh\nijkl";
    const ranges = buildBlockSelectionRanges(content, 8, 1);
    expect(ranges).toEqual([
      { start: 1, end: 3 },
      { start: 6, end: 8 },
    ]);
  });
});

describe("offset movement helpers", () => {
  it("moves offset by visual columns with tabs", () => {
    const content = "\tabc\nxy";
    expect(moveOffsetByVisualColumns(content, 1, 1)).toBe(2);
    expect(moveOffsetByVisualColumns(content, 2, -2)).toBe(0);
  });

  it("moves offset by lines while preserving visual column", () => {
    const content = "abcd\nxy\nmnop";
    expect(moveOffsetByLines(content, 3, 1)).toBe(7);
    expect(moveOffsetByLines(content, 7, 1)).toBe(10);
    expect(moveOffsetByLines(content, 10, -1)).toBe(7);
  });

  it("moves offset to line start/end boundary", () => {
    const content = "abcd\nxy\nmnop";
    expect(moveOffsetToLineBoundary(content, 3, "start")).toBe(0);
    expect(moveOffsetToLineBoundary(content, 3, "end")).toBe(4);
    expect(moveOffsetToLineBoundary(content, 7, "start")).toBe(5);
    expect(moveOffsetToLineBoundary(content, 7, "end")).toBe(7);
  });
});
