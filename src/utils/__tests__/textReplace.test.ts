import { describe, expect, it } from "vitest";
import { replaceTextInContent } from "../textReplace";

describe("replaceTextInContent", () => {
  it("replaces first literal match with case-sensitive mode", () => {
    const result = replaceTextInContent({
      content: "Alpha alpha alpha",
      query: "alpha",
      replacement: "B",
      useRegex: false,
      matchCase: true,
      replaceAll: false,
    });
    expect(result).toEqual({
      content: "Alpha B alpha",
      replacedCount: 1,
    });
  });

  it("replaces all literal matches with case-insensitive mode", () => {
    const result = replaceTextInContent({
      content: "Alpha alpha ALPHA",
      query: "alpha",
      replacement: "x",
      useRegex: false,
      matchCase: false,
      replaceAll: true,
    });
    expect(result).toEqual({
      content: "x x x",
      replacedCount: 3,
    });
  });

  it("preserves case for literal replacements when enabled", () => {
    const result = replaceTextInContent({
      content: "Alpha alpha ALPHA aLpHa",
      query: "alpha",
      replacement: "beta",
      useRegex: false,
      matchCase: false,
      replaceAll: true,
      preserveCase: true,
    });
    expect(result).toEqual({
      content: "Beta beta BETA beta",
      replacedCount: 4,
    });
  });

  it("keeps replacement text literal for non-regex mode", () => {
    const result = replaceTextInContent({
      content: "a a",
      query: "a",
      replacement: "$1",
      useRegex: false,
      matchCase: true,
      replaceAll: true,
    });
    expect(result).toEqual({
      content: "$1 $1",
      replacedCount: 2,
    });
  });

  it("supports regex replacement with capture groups", () => {
    const result = replaceTextInContent({
      content: "id=12 id=7",
      query: "id=(\\d+)",
      replacement: "[$1]",
      useRegex: true,
      matchCase: true,
      replaceAll: true,
    });
    expect(result).toEqual({
      content: "[12] [7]",
      replacedCount: 2,
    });
  });

  it("returns unchanged content when no match exists", () => {
    const result = replaceTextInContent({
      content: "hello",
      query: "world",
      replacement: "x",
      useRegex: false,
      matchCase: true,
      replaceAll: true,
    });
    expect(result).toEqual({
      content: "hello",
      replacedCount: 0,
    });
  });

  it("throws on invalid regex", () => {
    expect(() =>
      replaceTextInContent({
        content: "abc",
        query: "(",
        replacement: "x",
        useRegex: true,
        matchCase: true,
        replaceAll: false,
      }),
    ).toThrow();
  });
});
