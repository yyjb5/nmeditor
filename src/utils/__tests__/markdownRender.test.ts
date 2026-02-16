import { describe, expect, it } from "vitest";
import { renderMarkdownBlockHtml } from "../markdownRender";
import type { MarkdownPreviewBlock } from "../markdownPreview";

describe("markdownRender utils", () => {
  it("renders heading blocks via remark pipeline", () => {
    const block: MarkdownPreviewBlock = {
      kind: "heading",
      lineIndex: 0,
      level: 2,
      text: "Hello **Markdown**",
    };
    const html = renderMarkdownBlockHtml(block);
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>Markdown</strong>");
  });

  it("renders GFM task-list markup", () => {
    const block: MarkdownPreviewBlock = {
      kind: "list",
      lineIndex: 0,
      ordered: false,
      items: [
        { lineIndex: 0, text: "done", checked: true },
        { lineIndex: 1, text: "todo", checked: false },
      ],
    };
    const html = renderMarkdownBlockHtml(block);
    expect(html).toContain("contains-task-list");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("sanitizes unsafe html and javascript links", () => {
    const block: MarkdownPreviewBlock = {
      kind: "paragraph",
      lineIndex: 0,
      text: '<script>alert(1)</script> [bad](javascript:alert(1))',
    };
    const html = renderMarkdownBlockHtml(block);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:alert");
  });

  it("decorates external links with target and rel", () => {
    const block: MarkdownPreviewBlock = {
      kind: "paragraph",
      lineIndex: 0,
      text: "[doc](https://example.com/path)",
    };
    const html = renderMarkdownBlockHtml(block);
    expect(html).toContain('href="https://example.com/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
  });
});
