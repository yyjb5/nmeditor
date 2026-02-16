export type TextEolMode = "CRLF" | "LF" | "MIXED" | "NONE";
export type TextEolTarget = "CRLF" | "LF";

export type TextWhitespaceStats = {
  lineCount: number;
  crlfCount: number;
  lfCount: number;
  tabCount: number;
  trailingWhitespaceLines: number;
  trailingWhitespaceChars: number;
};

export const MAX_WHITESPACE_PREVIEW_CHARS = 200_000;

export function detectTextEolMode(content: string): TextEolMode {
  const { crlfCount, lfCount } = analyzeTextWhitespace(content);
  if (crlfCount > 0 && lfCount === 0) return "CRLF";
  if (lfCount > 0 && crlfCount === 0) return "LF";
  if (crlfCount > 0 || lfCount > 0) return "MIXED";
  return "NONE";
}

export function convertTextEol(content: string, target: TextEolTarget): string {
  const lfNormalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (target === "LF") return lfNormalized;
  return lfNormalized.replace(/\n/g, "\r\n");
}

export function trimTrailingWhitespace(content: string): {
  content: string;
  removedChars: number;
  affectedLines: number;
} {
  let removedChars = 0;
  let affectedLines = 0;
  const next = content.replace(/[ \t]+(?=\r\n|\n|\r|$)/g, (match) => {
    removedChars += match.length;
    affectedLines += 1;
    return "";
  });
  return {
    content: next,
    removedChars,
    affectedLines,
  };
}

export function analyzeTextWhitespace(content: string): TextWhitespaceStats {
  let crlfCount = 0;
  let lfCount = 0;
  let tabCount = 0;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "\t") {
      tabCount += 1;
      continue;
    }
    if (ch === "\r") {
      if (content[i + 1] === "\n") {
        crlfCount += 1;
        i += 1;
      } else {
        lfCount += 1;
      }
      continue;
    }
    if (ch === "\n") {
      lfCount += 1;
    }
  }

  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  let trailingWhitespaceLines = 0;
  let trailingWhitespaceChars = 0;
  for (const line of lines) {
    const match = line.match(/[ \t]+$/);
    if (!match) continue;
    trailingWhitespaceLines += 1;
    trailingWhitespaceChars += match[0].length;
  }

  return {
    lineCount: lines.length,
    crlfCount,
    lfCount,
    tabCount,
    trailingWhitespaceLines,
    trailingWhitespaceChars,
  };
}

export function buildWhitespaceVisiblePreview(
  content: string,
  maxChars = MAX_WHITESPACE_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const truncated = content.length > maxChars;
  const source = truncated ? content.slice(0, maxChars) : content;
  let out = "";
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === " ") {
      out += "·";
      continue;
    }
    if (ch === "\t") {
      out += "⇥";
      continue;
    }
    if (ch === "\r") {
      if (source[i + 1] === "\n") {
        out += "␍␊\n";
        i += 1;
      } else {
        out += "␍\n";
      }
      continue;
    }
    if (ch === "\n") {
      out += "␊\n";
      continue;
    }
    out += ch;
  }
  return { preview: out, truncated };
}
