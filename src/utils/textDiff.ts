export type LineDiffBlock = {
  id: string;
  leftStart: number;
  rightStart: number;
  leftDeleteCount: number;
  rightInsertCount: number;
  leftLines: string[];
  rightLines: string[];
};

export type LineDiffModel = {
  algorithm: "lcs" | "fallback";
  leftLineCount: number;
  rightLineCount: number;
  changedLineCount: number;
  blocks: LineDiffBlock[];
};

type DiffOp =
  | { kind: "equal"; line: string }
  | { kind: "delete"; line: string }
  | { kind: "insert"; line: string };

const DEFAULT_MAX_EXACT_LINES = 1200;
const DEFAULT_MAX_EXACT_CELLS = 1_200_000;

export function normalizeTextForDiff(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function splitTextToDiffLines(content: string): string[] {
  const normalized = normalizeTextForDiff(content);
  return normalized.split("\n");
}

export function joinDiffLines(lines: string[]): string {
  return lines.join("\n");
}

function buildDiffBlocks(ops: DiffOp[]): LineDiffBlock[] {
  const blocks: LineDiffBlock[] = [];
  let leftCursor = 0;
  let rightCursor = 0;
  let current: Omit<LineDiffBlock, "id"> | null = null;

  const flush = () => {
    if (!current) return;
    if (current.leftDeleteCount > 0 || current.rightInsertCount > 0) {
      blocks.push({
        id: `${current.leftStart}:${current.rightStart}:${blocks.length}`,
        ...current,
      });
    }
    current = null;
  };

  for (const op of ops) {
    if (op.kind === "equal") {
      flush();
      leftCursor += 1;
      rightCursor += 1;
      continue;
    }
    if (!current) {
      current = {
        leftStart: leftCursor,
        rightStart: rightCursor,
        leftDeleteCount: 0,
        rightInsertCount: 0,
        leftLines: [],
        rightLines: [],
      };
    }
    if (op.kind === "delete") {
      current.leftDeleteCount += 1;
      current.leftLines.push(op.line);
      leftCursor += 1;
      continue;
    }
    current.rightInsertCount += 1;
    current.rightLines.push(op.line);
    rightCursor += 1;
  }
  flush();
  return blocks;
}

function diffByFallback(leftLines: string[], rightLines: string[]): DiffOp[] {
  const ops: DiffOp[] = [];
  const maxLen = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxLen; i += 1) {
    const left = leftLines[i];
    const right = rightLines[i];
    if (left === right && left !== undefined) {
      ops.push({ kind: "equal", line: left });
      continue;
    }
    if (left !== undefined) {
      ops.push({ kind: "delete", line: left });
    }
    if (right !== undefined) {
      ops.push({ kind: "insert", line: right });
    }
  }
  return ops;
}

function diffByLcs(leftLines: string[], rightLines: string[]): DiffOp[] {
  const n = leftLines.length;
  const m = rightLines.length;
  const cols = m + 1;
  const dp = new Uint16Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * cols + j;

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      if (leftLines[i] === rightLines[j]) {
        dp[at(i, j)] = (dp[at(i + 1, j + 1)] + 1) as number;
      } else {
        const down = dp[at(i + 1, j)];
        const right = dp[at(i, j + 1)];
        dp[at(i, j)] = down >= right ? down : right;
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (leftLines[i] === rightLines[j]) {
      ops.push({ kind: "equal", line: leftLines[i] });
      i += 1;
      j += 1;
      continue;
    }
    if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) {
      ops.push({ kind: "delete", line: leftLines[i] });
      i += 1;
    } else {
      ops.push({ kind: "insert", line: rightLines[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ kind: "delete", line: leftLines[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ kind: "insert", line: rightLines[j] });
    j += 1;
  }
  return ops;
}

export function buildLineDiffModel(
  leftContent: string,
  rightContent: string,
  options?: {
    maxExactLines?: number;
    maxExactCells?: number;
  },
): LineDiffModel {
  const leftLines = splitTextToDiffLines(leftContent);
  const rightLines = splitTextToDiffLines(rightContent);
  const maxExactLines = options?.maxExactLines ?? DEFAULT_MAX_EXACT_LINES;
  const maxExactCells = options?.maxExactCells ?? DEFAULT_MAX_EXACT_CELLS;
  const useFallback =
    leftLines.length > maxExactLines ||
    rightLines.length > maxExactLines ||
    leftLines.length * rightLines.length > maxExactCells;

  const ops = useFallback
    ? diffByFallback(leftLines, rightLines)
    : diffByLcs(leftLines, rightLines);
  const blocks = buildDiffBlocks(ops);
  const changedLineCount = blocks.reduce(
    (sum, block) => sum + block.leftDeleteCount + block.rightInsertCount,
    0,
  );

  return {
    algorithm: useFallback ? "fallback" : "lcs",
    leftLineCount: leftLines.length,
    rightLineCount: rightLines.length,
    changedLineCount,
    blocks,
  };
}
