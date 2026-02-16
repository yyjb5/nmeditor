import type { SyntaxLanguage } from "./syntaxHighlight";

export type MinimapSegment = {
  startLine: number;
  endLine: number;
  density: number;
};

export type StructureItem = {
  lineIndex: number;
  lineNumber: number;
  depth: number;
  kind: "heading" | "function" | "class" | "struct" | "section";
  label: string;
};

export function buildTextMinimapSegments(
  content: string,
  maxSegments = 320,
): MinimapSegment[] {
  const lines = content.split("\n");
  const lineCount = Math.max(1, lines.length);
  const segmentCount = Math.max(1, Math.min(maxSegments, lineCount));
  const linesPerSegment = Math.ceil(lineCount / segmentCount);
  const segments: MinimapSegment[] = [];

  for (let seg = 0; seg < segmentCount; seg += 1) {
    const startLine = seg * linesPerSegment;
    const endLine = Math.min(lineCount - 1, startLine + linesPerSegment - 1);
    let nonEmpty = 0;
    let total = 0;
    for (let i = startLine; i <= endLine; i += 1) {
      total += 1;
      if ((lines[i] ?? "").trim().length > 0) nonEmpty += 1;
    }
    const density = total > 0 ? nonEmpty / total : 0;
    segments.push({ startLine, endLine, density });
  }
  return segments;
}

export function buildDocumentStructureItems(
  content: string,
  language: SyntaxLanguage,
  limit = 400,
): StructureItem[] {
  const lines = content.split("\n");
  const items: StructureItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (items.length >= limit) break;
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      items.push({
        lineIndex: i,
        lineNumber: i + 1,
        depth: heading[1].length,
        kind: "heading",
        label: heading[2],
      });
      continue;
    }

    const section = trimmed.match(/^(\/\/|#|--)\s*(region|section|chapter)\b[:\s-]*(.+)?$/i);
    if (section) {
      items.push({
        lineIndex: i,
        lineNumber: i + 1,
        depth: 1,
        kind: "section",
        label: section[3]?.trim() || trimmed,
      });
      continue;
    }

    if (language === "javascript" || language === "typescript") {
      const cls = trimmed.match(/^(export\s+)?class\s+([A-Za-z_$][\w$]*)/);
      if (cls) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 1,
          kind: "class",
          label: cls[2],
        });
        continue;
      }
      const fn =
        trimmed.match(/^(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)/) ??
        trimmed.match(/^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?\(/) ??
        trimmed.match(/^(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(async\s*)?[^=]*=>/);
      if (fn) {
        const name = fn[3] || fn[2] || trimmed;
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 1,
          kind: "function",
          label: name,
        });
        continue;
      }
    }

    if (language === "python") {
      const pyClass = trimmed.match(/^class\s+([A-Za-z_]\w*)/);
      if (pyClass) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 1,
          kind: "class",
          label: pyClass[1],
        });
        continue;
      }
      const pyFn = trimmed.match(/^def\s+([A-Za-z_]\w*)/);
      if (pyFn) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 2,
          kind: "function",
          label: pyFn[1],
        });
        continue;
      }
    }

    if (language === "rust") {
      const rustStruct = trimmed.match(/^(pub\s+)?(struct|enum|trait)\s+([A-Za-z_]\w*)/);
      if (rustStruct) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 1,
          kind: "struct",
          label: rustStruct[3],
        });
        continue;
      }
      const rustFn = trimmed.match(/^(pub\s+)?(async\s+)?fn\s+([A-Za-z_]\w*)/);
      if (rustFn) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 2,
          kind: "function",
          label: rustFn[3],
        });
        continue;
      }
    }

    if (language === "sql") {
      const sqlObj = trimmed.match(
        /^(create|alter)\s+(table|view|function|procedure)\s+([A-Za-z_][\w.]*)/i,
      );
      if (sqlObj) {
        items.push({
          lineIndex: i,
          lineNumber: i + 1,
          depth: 1,
          kind: "struct",
          label: sqlObj[3],
        });
        continue;
      }
    }
  }

  return items;
}
