import { describe, expect, it } from "vitest";
import { findBracketMatchNearCaret } from "../bracketMatching";

describe("findBracketMatchNearCaret", () => {
  it("matches forward when caret is on an opening bracket", () => {
    const content = "fn(a[b{c}])";
    const match = findBracketMatchNearCaret(content, 2, 2);
    expect(match).toEqual({
      anchorOffset: 2,
      anchorChar: "(",
      matchOffset: 10,
      matchChar: ")",
    });
  });

  it("matches backward when caret is after a closing bracket", () => {
    const content = "fn(a[b{c}])";
    const match = findBracketMatchNearCaret(content, 11, 11);
    expect(match).toEqual({
      anchorOffset: 10,
      anchorChar: ")",
      matchOffset: 2,
      matchChar: "(",
    });
  });

  it("returns null when there is no valid pair", () => {
    const content = "fn(a[b{c}]";
    expect(findBracketMatchNearCaret(content, 2, 2)).toBeNull();
  });

  it("returns null for non-collapsed selection", () => {
    const content = "fn(a)";
    expect(findBracketMatchNearCaret(content, 2, 4)).toBeNull();
  });

  it("respects scan distance limit", () => {
    const content = `(${ "x".repeat(2048) })`;
    expect(findBracketMatchNearCaret(content, 0, 0, 256)).toBeNull();
  });
});
