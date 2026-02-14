export type SyntaxLanguage =
  | "plain"
  | "javascript"
  | "typescript"
  | "json"
  | "python"
  | "rust"
  | "sql";

export type FoldRange = {
  startLine: number;
  endLine: number;
};

const JS_KEYWORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "switch",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "async",
  "await",
  "interface",
  "type",
  "enum",
  "implements",
  "private",
  "protected",
  "public",
  "readonly",
  "namespace",
  "declare",
  "module",
  "as",
  "from",
]);

const RUST_KEYWORDS = new Set([
  "as",
  "break",
  "const",
  "continue",
  "crate",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
]);

const PYTHON_KEYWORDS = new Set([
  "and",
  "as",
  "assert",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "False",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "None",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "True",
  "try",
  "while",
  "with",
  "yield",
]);

const SQL_KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "insert",
  "into",
  "update",
  "delete",
  "join",
  "inner",
  "left",
  "right",
  "full",
  "on",
  "group",
  "by",
  "order",
  "limit",
  "offset",
  "having",
  "distinct",
  "union",
  "all",
  "as",
  "and",
  "or",
  "not",
  "is",
  "null",
  "create",
  "table",
  "alter",
  "drop",
  "view",
  "index",
  "case",
  "when",
  "then",
  "else",
  "end",
]);

type Token = {
  text: string;
  kind:
    | "plain"
    | "comment"
    | "string"
    | "number"
    | "keyword"
    | "boolean"
    | "null"
    | "property";
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const isIdentifierStart = (char: string): boolean =>
  (char >= "a" && char <= "z") ||
  (char >= "A" && char <= "Z") ||
  char === "_" ||
  char === "$";

const isIdentifierPart = (char: string): boolean =>
  isIdentifierStart(char) || (char >= "0" && char <= "9");

const isDigit = (char: string): boolean => char >= "0" && char <= "9";

const readStringToken = (
  content: string,
  start: number,
  quote: "'" | '"' | "`",
): { token: Token; nextIndex: number } => {
  let index = start + 1;
  while (index < content.length) {
    const char = content[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) {
      index += 1;
      break;
    }
    index += 1;
  }
  return {
    token: { text: content.slice(start, index), kind: "string" },
    nextIndex: index,
  };
};

const tokenizeJsLike = (content: string, keywords: Set<string>): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    const next = index + 1 < content.length ? content[index + 1] : "";
    if (char === "/" && next === "/") {
      const lineEnd = content.indexOf("\n", index);
      const end = lineEnd >= 0 ? lineEnd : content.length;
      tokens.push({ text: content.slice(index, end), kind: "comment" });
      index = end;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = content.indexOf("*/", index + 2);
      const end = close >= 0 ? close + 2 : content.length;
      tokens.push({ text: content.slice(index, end), kind: "comment" });
      index = end;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      const { token, nextIndex } = readStringToken(
        content,
        index,
        char as "'" | '"' | "`",
      );
      tokens.push(token);
      index = nextIndex;
      continue;
    }
    if (isDigit(char)) {
      let end = index + 1;
      while (
        end < content.length &&
        (isDigit(content[end]) ||
          content[end] === "." ||
          content[end] === "_" ||
          content[end].toLowerCase() === "x" ||
          (content[end].toLowerCase() >= "a" && content[end].toLowerCase() <= "f"))
      ) {
        end += 1;
      }
      tokens.push({ text: content.slice(index, end), kind: "number" });
      index = end;
      continue;
    }
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < content.length && isIdentifierPart(content[end])) {
        end += 1;
      }
      const text = content.slice(index, end);
      if (text === "true" || text === "false") {
        tokens.push({ text, kind: "boolean" });
      } else if (text === "null" || text === "undefined") {
        tokens.push({ text, kind: "null" });
      } else if (keywords.has(text)) {
        tokens.push({ text, kind: "keyword" });
      } else {
        tokens.push({ text, kind: "plain" });
      }
      index = end;
      continue;
    }
    tokens.push({ text: char, kind: "plain" });
    index += 1;
  }
  return tokens;
};

const tokenizePython = (content: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    if (char === "#") {
      const lineEnd = content.indexOf("\n", index);
      const end = lineEnd >= 0 ? lineEnd : content.length;
      tokens.push({ text: content.slice(index, end), kind: "comment" });
      index = end;
      continue;
    }
    if (char === "'" || char === '"') {
      const { token, nextIndex } = readStringToken(content, index, char as "'" | '"');
      tokens.push(token);
      index = nextIndex;
      continue;
    }
    if (isDigit(char)) {
      let end = index + 1;
      while (end < content.length && (isDigit(content[end]) || content[end] === ".")) {
        end += 1;
      }
      tokens.push({ text: content.slice(index, end), kind: "number" });
      index = end;
      continue;
    }
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < content.length && isIdentifierPart(content[end])) {
        end += 1;
      }
      const text = content.slice(index, end);
      if (text === "True" || text === "False") {
        tokens.push({ text, kind: "boolean" });
      } else if (text === "None") {
        tokens.push({ text, kind: "null" });
      } else if (PYTHON_KEYWORDS.has(text)) {
        tokens.push({ text, kind: "keyword" });
      } else {
        tokens.push({ text, kind: "plain" });
      }
      index = end;
      continue;
    }
    tokens.push({ text: char, kind: "plain" });
    index += 1;
  }
  return tokens;
};

const tokenizeSql = (content: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    const next = index + 1 < content.length ? content[index + 1] : "";
    if (char === "-" && next === "-") {
      const lineEnd = content.indexOf("\n", index);
      const end = lineEnd >= 0 ? lineEnd : content.length;
      tokens.push({ text: content.slice(index, end), kind: "comment" });
      index = end;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = content.indexOf("*/", index + 2);
      const end = close >= 0 ? close + 2 : content.length;
      tokens.push({ text: content.slice(index, end), kind: "comment" });
      index = end;
      continue;
    }
    if (char === "'") {
      const { token, nextIndex } = readStringToken(content, index, "'");
      tokens.push(token);
      index = nextIndex;
      continue;
    }
    if (isDigit(char)) {
      let end = index + 1;
      while (end < content.length && (isDigit(content[end]) || content[end] === ".")) {
        end += 1;
      }
      tokens.push({ text: content.slice(index, end), kind: "number" });
      index = end;
      continue;
    }
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < content.length && isIdentifierPart(content[end])) {
        end += 1;
      }
      const text = content.slice(index, end);
      const lower = text.toLowerCase();
      if (lower === "true" || lower === "false") {
        tokens.push({ text, kind: "boolean" });
      } else if (lower === "null") {
        tokens.push({ text, kind: "null" });
      } else if (SQL_KEYWORDS.has(lower)) {
        tokens.push({ text, kind: "keyword" });
      } else {
        tokens.push({ text, kind: "plain" });
      }
      index = end;
      continue;
    }
    tokens.push({ text: char, kind: "plain" });
    index += 1;
  }
  return tokens;
};

const tokenizeJson = (content: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < content.length) {
    const char = content[index];
    if (char === '"') {
      const { token, nextIndex } = readStringToken(content, index, '"');
      let lookahead = nextIndex;
      while (lookahead < content.length && /\s/.test(content[lookahead] ?? "")) {
        lookahead += 1;
      }
      const kind = content[lookahead] === ":" ? "property" : "string";
      tokens.push({ ...token, kind });
      index = nextIndex;
      continue;
    }
    if (isDigit(char) || char === "-") {
      let end = index + 1;
      while (
        end < content.length &&
        (isDigit(content[end]) ||
          content[end] === "." ||
          content[end] === "e" ||
          content[end] === "E" ||
          content[end] === "+" ||
          content[end] === "-")
      ) {
        end += 1;
      }
      tokens.push({ text: content.slice(index, end), kind: "number" });
      index = end;
      continue;
    }
    if (isIdentifierStart(char)) {
      let end = index + 1;
      while (end < content.length && isIdentifierPart(content[end])) {
        end += 1;
      }
      const text = content.slice(index, end);
      if (text === "true" || text === "false") {
        tokens.push({ text, kind: "boolean" });
      } else if (text === "null") {
        tokens.push({ text, kind: "null" });
      } else {
        tokens.push({ text, kind: "plain" });
      }
      index = end;
      continue;
    }
    tokens.push({ text: char, kind: "plain" });
    index += 1;
  }
  return tokens;
};

const tokensToHtml = (tokens: Token[]): string =>
  tokens
    .map((token) => {
      const escaped = escapeHtml(token.text);
      if (token.kind === "plain") {
        return escaped;
      }
      return `<span class="syn-${token.kind}">${escaped}</span>`;
    })
    .join("");

export const detectSyntaxLanguageFromPath = (path: string | null): SyntaxLanguage => {
  if (!path) return "plain";
  const lower = path.toLowerCase();
  if (
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs")
  ) {
    return "javascript";
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return "typescript";
  }
  if (lower.endsWith(".json")) {
    return "json";
  }
  if (lower.endsWith(".py")) {
    return "python";
  }
  if (lower.endsWith(".rs")) {
    return "rust";
  }
  if (lower.endsWith(".sql")) {
    return "sql";
  }
  return "plain";
};

export const renderSyntaxHighlightedHtml = (
  content: string,
  language: SyntaxLanguage,
): string => {
  if (!content.length || language === "plain") {
    return escapeHtml(content);
  }
  if (language === "json") {
    return tokensToHtml(tokenizeJson(content));
  }
  if (language === "python") {
    return tokensToHtml(tokenizePython(content));
  }
  if (language === "rust") {
    return tokensToHtml(tokenizeJsLike(content, RUST_KEYWORDS));
  }
  if (language === "sql") {
    return tokensToHtml(tokenizeSql(content));
  }
  if (language === "typescript" || language === "javascript") {
    return tokensToHtml(tokenizeJsLike(content, JS_KEYWORDS));
  }
  return escapeHtml(content);
};

export const buildBraceFoldRanges = (
  content: string,
  maxRanges = 5_000,
): FoldRange[] => {
  const stack: number[] = [];
  const ranges: FoldRange[] = [];
  let line = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let inString: "'" | '"' | "`" | null = null;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index] ?? "";
    const next = index + 1 < content.length ? content[index + 1] ?? "" : "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        line += 1;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "\n") {
        line += 1;
        continue;
      }
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (char === "\\") {
        if (next === "\n") {
          line += 1;
        }
        index += 1;
        continue;
      }
      if (char === "\n") {
        line += 1;
        if (inString !== "`") {
          inString = null;
        }
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "\n") {
      line += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (char === "#" || (char === "-" && next === "-")) {
      inLineComment = true;
      if (char === "-") {
        index += 1;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char as "'" | '"' | "`";
      continue;
    }
    if (char === "{") {
      stack.push(line);
      continue;
    }
    if (char === "}") {
      const startLine = stack.pop();
      if (typeof startLine === "number" && line > startLine) {
        ranges.push({ startLine, endLine: line });
        if (ranges.length >= maxRanges) {
          break;
        }
      }
    }
  }

  ranges.sort((a, b) => {
    if (a.startLine === b.startLine) {
      return b.endLine - a.endLine;
    }
    return a.startLine - b.startLine;
  });
  return ranges;
};
