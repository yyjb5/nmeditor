import { describe, expect, it } from "vitest";
import {
  buildBraceFoldRanges,
  detectSyntaxLanguageFromPath,
  renderSyntaxHighlightedHtml,
} from "../syntaxHighlight";

describe("detectSyntaxLanguageFromPath", () => {
  it("detects known extensions", () => {
    expect(detectSyntaxLanguageFromPath("a.ts")).toBe("typescript");
    expect(detectSyntaxLanguageFromPath("a.js")).toBe("javascript");
    expect(detectSyntaxLanguageFromPath("a.json")).toBe("json");
    expect(detectSyntaxLanguageFromPath("a.py")).toBe("python");
    expect(detectSyntaxLanguageFromPath("a.rs")).toBe("rust");
    expect(detectSyntaxLanguageFromPath("a.sql")).toBe("sql");
  });

  it("falls back to plain", () => {
    expect(detectSyntaxLanguageFromPath("a.txt")).toBe("plain");
    expect(detectSyntaxLanguageFromPath(null)).toBe("plain");
  });
});

describe("renderSyntaxHighlightedHtml", () => {
  it("highlights js keywords, numbers and comments", () => {
    const html = renderSyntaxHighlightedHtml(
      "const x = 42; // note",
      "javascript",
    );
    expect(html).toContain('class="syn-keyword"');
    expect(html).toContain('class="syn-number"');
    expect(html).toContain('class="syn-comment"');
  });

  it("highlights json property and string", () => {
    const html = renderSyntaxHighlightedHtml(
      '{"name":"deskcsv","ok":true}',
      "json",
    );
    expect(html).toContain('class="syn-property"');
    expect(html).toContain('class="syn-string"');
    expect(html).toContain('class="syn-boolean"');
  });
});

describe("buildBraceFoldRanges", () => {
  it("builds multi-line fold ranges for braces", () => {
    const ranges = buildBraceFoldRanges("function a() {\n  if (ok) {\n    x();\n  }\n}\n");
    expect(ranges).toEqual([
      { startLine: 0, endLine: 4 },
      { startLine: 1, endLine: 3 },
    ]);
  });

  it("ignores braces in comments and strings", () => {
    const ranges = buildBraceFoldRanges(
      "const s = '{'; // }\n/* { */\nfunction x() {\n  return 1;\n}\n",
    );
    expect(ranges).toEqual([{ startLine: 2, endLine: 4 }]);
  });
});
