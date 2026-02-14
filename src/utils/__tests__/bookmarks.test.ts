import { describe, expect, it } from "vitest";
import {
  parseBookmarksFromImport,
  serializeBookmarksForExport,
} from "../bookmarks";

describe("serializeBookmarksForExport", () => {
  it("exports one-based sorted bookmarks", () => {
    const json = serializeBookmarksForExport([4, 0, 4, 2], "C:/demo.txt");
    const parsed = JSON.parse(json) as { bookmarks: number[]; path: string | null };
    expect(parsed.path).toBe("C:/demo.txt");
    expect(parsed.bookmarks).toEqual([1, 3, 5]);
  });
});

describe("parseBookmarksFromImport", () => {
  it("parses object payload bookmarks and normalizes to zero-based", () => {
    const raw = JSON.stringify({ version: 1, bookmarks: [1, 3, 3, 9] });
    expect(parseBookmarksFromImport(raw, 5)).toEqual([0, 2]);
  });

  it("parses array payload as one-based bookmarks", () => {
    const raw = JSON.stringify([2, 5, 1]);
    expect(parseBookmarksFromImport(raw, 6)).toEqual([0, 1, 4]);
  });

  it("returns empty for invalid input", () => {
    expect(parseBookmarksFromImport("{bad json", 20)).toEqual([]);
    expect(parseBookmarksFromImport(JSON.stringify({ hello: "world" }), 20)).toEqual([]);
  });
});
