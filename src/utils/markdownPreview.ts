import type { SyntaxLanguage } from "./syntaxHighlight";

export type MarkdownListItem = {
  lineIndex: number;
  text: string;
  checked: boolean | null;
};

export type MarkdownTableRow = {
  lineIndex: number;
  cells: string[];
};

export type MarkdownPreviewBlock =
  | { kind: "heading"; lineIndex: number; level: number; text: string }
  | { kind: "paragraph"; lineIndex: number; text: string }
  | { kind: "code"; lineIndex: number; language: string; code: string }
  | { kind: "list"; lineIndex: number; ordered: boolean; items: MarkdownListItem[] }
  | {
      kind: "table";
      lineIndex: number;
      headers: string[];
      rows: MarkdownTableRow[];
    }
  | { kind: "blockquote"; lineIndex: number; text: string }
  | { kind: "hr"; lineIndex: number };

export const MAX_MARKDOWN_PREVIEW_BLOCKS = 500;

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const SETEXT_HEADING_RE = /^\s{0,3}(=+|-+)\s*$/;
const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const CODE_FENCE_RE = /^\s*(`{3,}|~{3,})(.*)$/;
const UNORDERED_LIST_RE = /^\s*[-+*]\s+(.*)$/;
const ORDERED_LIST_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const BLOCK_QUOTE_RE = /^\s*>\s?(.*)$/;
const INDENTED_CODE_RE = /^(?:\t| {4,}).*$/;
const INLINE_TOKEN_PREFIX = "@@MDTOK";
const INLINE_LITERAL_PREFIX = "@@MDLIT";
const UNSAFE_URL_RE = /^(?:javascript|data|vbscript):/i;

const FENCE_LANGUAGE_ALIASES: Record<string, SyntaxLanguage> = {
  js: "javascript",
  jsx: "javascript",
  javascript: "javascript",
  node: "javascript",
  ts: "typescript",
  tsx: "typescript",
  typescript: "typescript",
  json: "json",
  jsonc: "json",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sql: "sql",
};

function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeHref(rawHref: string): string {
  const trimmed = rawHref.trim().replace(/^<|>$/g, "");
  if (!trimmed) return "#";
  if (UNSAFE_URL_RE.test(trimmed)) return "#";
  return escapeHtml(trimmed);
}

export function normalizeMarkdownFenceLanguage(language: string): SyntaxLanguage {
  const normalized = language.trim().toLowerCase();
  if (!normalized) return "plain";
  return FENCE_LANGUAGE_ALIASES[normalized] ?? "plain";
}

export function renderMarkdownInlineHtml(text: string): string {
  if (!text.length) return "";
  const placeholders: string[] = [];
  const literals: string[] = [];
  const reserve = (html: string): string => {
    const key = `${INLINE_TOKEN_PREFIX}${placeholders.length}@@`;
    placeholders.push(html);
    return key;
  };
  const reserveLiteral = (literal: string): string => {
    const key = `${INLINE_LITERAL_PREFIX}${literals.length}@@`;
    literals.push(literal);
    return key;
  };
  let output = escapeHtml(text);

  output = output.replace(/\\([\\`*_[\]{}()#+\-.!~])/g, (_match, literal: string) =>
    reserveLiteral(literal),
  );

  output = output.replace(/`([^`]+)`/g, (_match, code: string) =>
    reserve(`<code class="markdown-inline-code">${code}</code>`),
  );

  output = output.replace(
    /!\[([^\]]*)\]\(((?:[^()\s]|(?:\([^)]*\)))+)\)/g,
    (_match, alt: string, href: string) =>
      reserve(
        `<a class="markdown-inline-link markdown-inline-image" href="${sanitizeHref(href)}" target="_blank" rel="noreferrer noopener">🖼 ${alt || href}</a>`,
      ),
  );

  output = output.replace(
    /\[([^\]]+)\]\(((?:[^()\s]|(?:\([^)]*\)))+)\)/g,
    (_match, label: string, href: string) =>
      reserve(
        `<a class="markdown-inline-link" href="${sanitizeHref(href)}" target="_blank" rel="noreferrer noopener">${label}</a>`,
      ),
  );

  output = output.replace(
    /(^|[^\w\\])\*\*([^\n*](?:.*?[^\s*])?)\*\*(?=[^\w]|$)/g,
    "$1<strong>$2</strong>",
  );
  output = output.replace(
    /(^|[^\w\\])__([^\n_](?:.*?[^\s_])?)__(?=[^\w]|$)/g,
    "$1<strong>$2</strong>",
  );
  output = output.replace(
    /(^|[^\w\\])~~([^\n~](?:.*?[^\s~])?)~~(?=[^\w]|$)/g,
    "$1<del>$2</del>",
  );
  output = output.replace(
    /(^|[^\w\\])\*([^\n*](?:.*?[^\s*])?)\*(?=[^\w]|$)/g,
    "$1<em>$2</em>",
  );
  output = output.replace(
    /(^|[^\w\\])_([^\n_](?:.*?[^\s_])?)_(?=[^\w]|$)/g,
    "$1<em>$2</em>",
  );

  output = output.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)(?=$|[\s),.!?])/g,
    (_match, prefix: string, href: string) =>
      `${prefix}${reserve(
        `<a class="markdown-inline-link" href="${sanitizeHref(href)}" target="_blank" rel="noreferrer noopener">${href}</a>`,
      )}`,
  );

  output = output.replace(
    new RegExp(`${INLINE_TOKEN_PREFIX}(\\d+)@@`, "g"),
    (_match, indexText: string) => {
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || index >= placeholders.length) {
        return "";
      }
      return placeholders[index] ?? "";
    },
  );

  output = output.replace(
    new RegExp(`${INLINE_LITERAL_PREFIX}(\\d+)@@`, "g"),
    (_match, indexText: string) => {
      const index = Number(indexText);
      if (!Number.isFinite(index) || index < 0 || index >= literals.length) {
        return "";
      }
      return literals[index] ?? "";
    },
  );

  return output;
}

function splitTableRow(row: string): string[] {
  let text = row.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(row: string): boolean {
  const cells = splitTableRow(row);
  if (!cells.length) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseListMarker(line: string): { ordered: boolean; text: string } | null {
  const ordered = ORDERED_LIST_RE.exec(line);
  if (ordered) {
    return {
      ordered: true,
      text: ordered[2]?.trim() ?? "",
    };
  }
  const unordered = UNORDERED_LIST_RE.exec(line);
  if (!unordered) return null;
  return {
    ordered: false,
    text: unordered[1]?.trim() ?? "",
  };
}

function parseTaskItemText(text: string): { text: string; checked: boolean | null } {
  const task = /^\[( |x|X)\]\s+(.*)$/.exec(text);
  if (!task) {
    return { text, checked: null };
  }
  return {
    text: task[2]?.trim() ?? "",
    checked: String(task[1]).toLowerCase() === "x",
  };
}

function parseCodeFence(
  line: string,
): { marker: "`" | "~"; count: number; language: string } | null {
  const match = CODE_FENCE_RE.exec(line);
  if (!match) return null;
  const fence = match[1] ?? "";
  const language = (match[2] ?? "").trim();
  const marker = fence[0] === "~" ? "~" : "`";
  return {
    marker,
    count: fence.length,
    language,
  };
}

function isCodeFenceClose(
  line: string,
  marker: "`" | "~",
  minCount: number,
): boolean {
  const escapedMarker = marker === "`" ? "`" : "~";
  const closeRe = new RegExp(`^\\s*${escapedMarker}{${minCount},}\\s*$`);
  return closeRe.test(line);
}

function isBlockStarter(lines: string[], lineIndex: number): boolean {
  if (lineIndex >= lines.length) return false;
  const line = lines[lineIndex] ?? "";
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (HEADING_RE.test(line)) return true;
  if (lineIndex + 1 < lines.length && SETEXT_HEADING_RE.test(lines[lineIndex + 1] ?? "")) {
    return true;
  }
  if (HR_RE.test(line)) return true;
  if (parseCodeFence(line) !== null) return true;
  if (INDENTED_CODE_RE.test(line)) return true;
  if (parseListMarker(line) !== null) return true;
  if (BLOCK_QUOTE_RE.test(line)) return true;
  if (line.includes("|") && lineIndex + 1 < lines.length && isTableSeparator(lines[lineIndex + 1] ?? "")) {
    return true;
  }
  return false;
}

export function isMarkdownPath(path: string | null): boolean {
  if (!path) return false;
  return /\.(md|markdown|mdown|mkd|mdx)$/i.test(path);
}

export function buildMarkdownPreviewBlocks(
  content: string,
  maxBlocks = MAX_MARKDOWN_PREVIEW_BLOCKS,
): MarkdownPreviewBlock[] {
  const safeMaxBlocks = Math.max(1, maxBlocks);
  const lines = normalizeContent(content).split("\n");
  const blocks: MarkdownPreviewBlock[] = [];
  let lineIndex = 0;

  const pushBlock = (block: MarkdownPreviewBlock): boolean => {
    blocks.push(block);
    return blocks.length >= safeMaxBlocks;
  };

  while (lineIndex < lines.length) {
    const rawLine = lines[lineIndex] ?? "";
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lineIndex += 1;
      continue;
    }

    const codeFence = parseCodeFence(rawLine);
    if (codeFence) {
      const startLine = lineIndex;
      const language = codeFence.language;
      lineIndex += 1;
      const codeLines: string[] = [];
      while (lineIndex < lines.length) {
        const line = lines[lineIndex] ?? "";
        if (isCodeFenceClose(line, codeFence.marker, codeFence.count)) {
          lineIndex += 1;
          break;
        }
        codeLines.push(line);
        lineIndex += 1;
      }
      if (
        pushBlock({
          kind: "code",
          lineIndex: startLine,
          language,
          code: codeLines.join("\n"),
        })
      ) {
        break;
      }
      continue;
    }

    if (INDENTED_CODE_RE.test(rawLine)) {
      const startLine = lineIndex;
      const codeLines: string[] = [];
      while (lineIndex < lines.length) {
        const line = lines[lineIndex] ?? "";
        if (!INDENTED_CODE_RE.test(line)) break;
        codeLines.push(line.replace(/^(?:\t| {4})/, ""));
        lineIndex += 1;
      }
      if (
        pushBlock({
          kind: "code",
          lineIndex: startLine,
          language: "",
          code: codeLines.join("\n"),
        })
      ) {
        break;
      }
      continue;
    }

    if (rawLine.includes("|") && lineIndex + 1 < lines.length && isTableSeparator(lines[lineIndex + 1] ?? "")) {
      const startLine = lineIndex;
      const headers = splitTableRow(rawLine);
      lineIndex += 2;
      const rows: MarkdownTableRow[] = [];
      while (lineIndex < lines.length) {
        const rowLine = lines[lineIndex] ?? "";
        if (!rowLine.trim() || !rowLine.includes("|")) break;
        if (isTableSeparator(rowLine)) break;
        rows.push({
          lineIndex,
          cells: splitTableRow(rowLine),
        });
        lineIndex += 1;
      }
      if (
        pushBlock({
          kind: "table",
          lineIndex: startLine,
          headers,
          rows,
        })
      ) {
        break;
      }
      continue;
    }

    const heading = HEADING_RE.exec(rawLine);
    if (heading) {
      if (
        pushBlock({
          kind: "heading",
          lineIndex,
          level: Math.max(1, Math.min(6, heading[1]?.length ?? 1)),
          text: (heading[2] ?? "").trim(),
        })
      ) {
        break;
      }
      lineIndex += 1;
      continue;
    }

    if (lineIndex + 1 < lines.length) {
      const setext = SETEXT_HEADING_RE.exec(lines[lineIndex + 1] ?? "");
      if (setext) {
        if (
          pushBlock({
            kind: "heading",
            lineIndex,
            level: (setext[1] ?? "").startsWith("=") ? 1 : 2,
            text: rawLine.trim(),
          })
        ) {
          break;
        }
        lineIndex += 2;
        continue;
      }
    }

    if (HR_RE.test(rawLine)) {
      if (pushBlock({ kind: "hr", lineIndex })) break;
      lineIndex += 1;
      continue;
    }

    const quote = BLOCK_QUOTE_RE.exec(rawLine);
    if (quote) {
      const startLine = lineIndex;
      const quoteLines: string[] = [(quote[1] ?? "").trim()];
      lineIndex += 1;
      while (lineIndex < lines.length) {
        const next = BLOCK_QUOTE_RE.exec(lines[lineIndex] ?? "");
        if (!next) break;
        quoteLines.push((next[1] ?? "").trim());
        lineIndex += 1;
      }
      if (
        pushBlock({
          kind: "blockquote",
          lineIndex: startLine,
          text: quoteLines.join("\n").trim(),
        })
      ) {
        break;
      }
      continue;
    }

    const listMarker = parseListMarker(rawLine);
    if (listMarker) {
      const startLine = lineIndex;
      const items: MarkdownListItem[] = [];
      const ordered = listMarker.ordered;
      while (lineIndex < lines.length) {
        const currentLine = lines[lineIndex] ?? "";
        const marker = parseListMarker(currentLine);
        if (!marker || marker.ordered !== ordered) break;
        const parsedTask = parseTaskItemText(marker.text);
        items.push({
          lineIndex,
          text: parsedTask.text,
          checked: parsedTask.checked,
        });
        lineIndex += 1;
        while (lineIndex < lines.length) {
          const continuationLine = lines[lineIndex] ?? "";
          if (!continuationLine.trim()) break;
          if (parseListMarker(continuationLine) !== null) break;
          if (!/^\s{2,}\S/.test(continuationLine)) break;
          const tail = continuationLine.trim();
          const last = items[items.length - 1];
          if (last) {
            last.text = `${last.text}\n${tail}`.trim();
          }
          lineIndex += 1;
        }
      }
      if (pushBlock({ kind: "list", lineIndex: startLine, ordered, items })) break;
      continue;
    }

    const paragraphStart = lineIndex;
    const paragraphLines: string[] = [trimmed];
    lineIndex += 1;
    while (lineIndex < lines.length) {
      const nextLine = lines[lineIndex] ?? "";
      if (!nextLine.trim()) break;
      if (isBlockStarter(lines, lineIndex)) break;
      paragraphLines.push(nextLine.trim());
      lineIndex += 1;
    }
    if (
      pushBlock({
        kind: "paragraph",
        lineIndex: paragraphStart,
        text: paragraphLines.join("\n").trim(),
      })
    ) {
      break;
    }
  }

  return blocks;
}
