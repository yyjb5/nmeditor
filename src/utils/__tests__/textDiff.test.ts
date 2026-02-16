import { describe, expect, it } from "vitest";
import {
  buildLineDiffModel,
  joinDiffLines,
  normalizeTextForDiff,
  splitTextToDiffLines,
} from "../textDiff";

describe("textDiff utils", () => {
  it("normalizes CRLF/CR to LF for diff", () => {
    expect(normalizeTextForDiff("a\r\nb\rc\n")).toBe("a\nb\nc\n");
  });

  it("splits and joins text lines consistently", () => {
    const lines = splitTextToDiffLines("a\nb\n");
    expect(lines).toEqual(["a", "b", ""]);
    expect(joinDiffLines(lines)).toBe("a\nb\n");
  });

  it("builds line diff blocks with lcs algorithm", () => {
    const model = buildLineDiffModel("a\nx\nc\n", "a\nb\nc\n");
    expect(model.algorithm).toBe("lcs");
    expect(model.blocks.length).toBe(1);
    expect(model.blocks[0]).toMatchObject({
      leftStart: 1,
      rightStart: 1,
      leftDeleteCount: 1,
      rightInsertCount: 1,
      leftLines: ["x"],
      rightLines: ["b"],
    });
  });

  it("falls back for large line sets", () => {
    const left = Array.from({ length: 50 }, (_, i) => `L${i}`).join("\n");
    const right = Array.from({ length: 50 }, (_, i) => `R${i}`).join("\n");
    const model = buildLineDiffModel(left, right, {
      maxExactLines: 10,
      maxExactCells: 100,
    });
    expect(model.algorithm).toBe("fallback");
    expect(model.blocks.length).toBeGreaterThan(0);
  });
});
