import { describe, expect, it } from "vitest";
import {
  buildMarkdownPreviewBlocks,
  isMarkdownPath,
  normalizeMarkdownFenceLanguage,
  renderMarkdownInlineHtml,
} from "../markdownPreview";

describe("markdownPreview utils", () => {
  it("detects markdown file paths", () => {
    expect(isMarkdownPath("a.md")).toBe(true);
    expect(isMarkdownPath("a.markdown")).toBe(true);
    expect(isMarkdownPath("a.txt")).toBe(false);
    expect(isMarkdownPath(null)).toBe(false);
  });

  it("parses headings, code fences, tables and task lists with line indexes", () => {
    const content = [
      "# Title",
      "",
      "```ts",
      "const a = 1;",
      "```",
      "",
      "| Name | Done |",
      "| --- | --- |",
      "| A | yes |",
      "",
      "- [x] first",
      "- [ ] second",
    ].join("\n");
    const blocks = buildMarkdownPreviewBlocks(content, 20);
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "code",
      "table",
      "list",
    ]);
    expect(blocks[0]).toMatchObject({ kind: "heading", lineIndex: 0 });
    expect(blocks[1]).toMatchObject({ kind: "code", lineIndex: 2, language: "ts" });
    expect(blocks[2]).toMatchObject({ kind: "table", lineIndex: 6 });
    expect(blocks[3]).toMatchObject({ kind: "list", lineIndex: 10 });
    const list = blocks[3];
    if (list.kind !== "list") throw new Error("Expected list block");
    expect(list.items).toEqual([
      { lineIndex: 10, text: "first", checked: true },
      { lineIndex: 11, text: "second", checked: false },
    ]);
  });

  it("parses setext heading, tilde fence and indented code blocks", () => {
    const content = [
      "Title by setext",
      "===",
      "",
      "~~~js",
      "const a = 1;",
      "~~~",
      "",
      "    indented()",
      "    second()",
    ].join("\n");
    const blocks = buildMarkdownPreviewBlocks(content, 20);
    expect(blocks.map((block) => block.kind)).toEqual(["heading", "code", "code"]);
    expect(blocks[0]).toMatchObject({ kind: "heading", level: 1, lineIndex: 0 });
    expect(blocks[1]).toMatchObject({ kind: "code", language: "js", lineIndex: 3 });
    expect(blocks[2]).toMatchObject({ kind: "code", language: "", lineIndex: 7 });
  });

  it("respects max block limit", () => {
    const content = ["# A", "# B", "# C"].join("\n");
    const blocks = buildMarkdownPreviewBlocks(content, 2);
    expect(blocks.length).toBe(2);
    expect(blocks.map((block) => block.kind)).toEqual(["heading", "heading"]);
  });

  it("renders inline markdown with safe links", () => {
    const html = renderMarkdownInlineHtml(
      "**Bold** _Italic_ ~~Done~~ `code` [doc](https://example.com) [x](javascript:alert(1)) <tag>",
    );
    expect(html).toContain("<strong>Bold</strong>");
    expect(html).toContain("<em>Italic</em>");
    expect(html).toContain("<del>Done</del>");
    expect(html).toContain('<code class="markdown-inline-code">code</code>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('href="#"');
    expect(html).toContain("&lt;tag&gt;");
  });

  it("maps markdown fence language aliases", () => {
    expect(normalizeMarkdownFenceLanguage("ts")).toBe("typescript");
    expect(normalizeMarkdownFenceLanguage("PY")).toBe("python");
    expect(normalizeMarkdownFenceLanguage("unknown")).toBe("plain");
  });

  it("keeps escaped markers and avoids underscore emphasis inside words", () => {
    const html = renderMarkdownInlineHtml("foo_bar_baz \\*no\\* _ok_");
    expect(html).toContain("foo_bar_baz");
    expect(html).toContain("*no*");
    expect(html).toContain("<em>ok</em>");
    expect(html).not.toContain("<em>bar</em>");
  });

  it("supports markdown links with parentheses in url", () => {
    const html = renderMarkdownInlineHtml("[doc](https://example.com/a_(b))");
    expect(html).toContain('href="https://example.com/a_(b)"');
  });

  it("preserves line breaks for paragraph blocks", () => {
    const content = ["first line", "second line"].join("\n");
    const blocks = buildMarkdownPreviewBlocks(content, 10);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "paragraph", text: "first line\nsecond line" });
  });
});
