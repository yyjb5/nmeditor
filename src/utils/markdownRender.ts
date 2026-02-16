import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { MarkdownPreviewBlock } from "./markdownPreview";

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function buildMarkdownFromBlock(block: MarkdownPreviewBlock): string {
  if (block.kind === "heading") {
    return `${"#".repeat(Math.max(1, Math.min(6, block.level)))} ${block.text}`;
  }
  if (block.kind === "paragraph") {
    return block.text;
  }
  if (block.kind === "blockquote") {
    return block.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (block.kind === "hr") {
    return "---";
  }
  if (block.kind === "code") {
    const language = block.language.trim();
    return `~~~${language}\n${block.code}\n~~~`;
  }
  if (block.kind === "list") {
    return block.items
      .map((item, index) => {
        const marker = block.ordered ? `${index + 1}. ` : "- ";
        const taskPrefix =
          item.checked === null ? "" : item.checked ? "[x] " : "[ ] ";
        const lines = item.text.split("\n");
        const firstLine = `${marker}${taskPrefix}${lines[0] ?? ""}`;
        const tailLines = lines.slice(1).map((line) => `   ${line}`);
        return [firstLine, ...tailLines].join("\n");
      })
      .join("\n");
  }
  if (block.kind === "table") {
    const headers = block.headers.map((cell) => escapeTableCell(cell));
    const separator = headers.map(() => "---");
    const rows = block.rows.map((row) => row.cells.map((cell) => escapeTableCell(cell)));
    const asRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
    return [asRow(headers), asRow(separator), ...rows.map(asRow)].join("\n");
  }
  return "";
}

function decorateExternalLinks(html: string): string {
  return html.replace(
    /<a\s+([^>]*href="https?:\/\/[^"]+"[^>]*)>/gi,
    (_match, attrs: string) => {
      let nextAttrs = attrs;
      if (!/\btarget=/.test(nextAttrs)) {
        nextAttrs += ' target="_blank"';
      }
      if (!/\brel=/.test(nextAttrs)) {
        nextAttrs += ' rel="noreferrer noopener"';
      }
      return `<a ${nextAttrs}>`;
    },
  );
}

export function renderMarkdownBlockHtml(block: MarkdownPreviewBlock): string {
  const markdown = buildMarkdownFromBlock(block).trimEnd();
  if (!markdown) return "";
  try {
    const html = String(markdownProcessor.processSync(markdown));
    return decorateExternalLinks(html);
  } catch {
    return `<pre><code>${escapeHtml(markdown)}</code></pre>`;
  }
}
