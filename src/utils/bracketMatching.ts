const OPEN_TO_CLOSE: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

const CLOSE_TO_OPEN: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

export type BracketMatch = {
  anchorOffset: number;
  anchorChar: string;
  matchOffset: number;
  matchChar: string;
};

const hasOwn = (record: Record<string, string>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isOpenBracket = (char: string): boolean => hasOwn(OPEN_TO_CLOSE, char);
const isCloseBracket = (char: string): boolean => hasOwn(CLOSE_TO_OPEN, char);

const findForwardMatch = (
  content: string,
  anchorOffset: number,
  maxScanDistance: number,
): BracketMatch | null => {
  const anchorChar = content[anchorOffset];
  if (!isOpenBracket(anchorChar)) return null;
  const targetChar = OPEN_TO_CLOSE[anchorChar];
  let depth = 1;
  let scanned = 0;
  for (let index = anchorOffset + 1; index < content.length; index += 1) {
    scanned += 1;
    if (scanned > maxScanDistance) return null;
    const char = content[index];
    if (char === anchorChar) {
      depth += 1;
      continue;
    }
    if (char === targetChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          anchorOffset,
          anchorChar,
          matchOffset: index,
          matchChar: char,
        };
      }
    }
  }
  return null;
};

const findBackwardMatch = (
  content: string,
  anchorOffset: number,
  maxScanDistance: number,
): BracketMatch | null => {
  const anchorChar = content[anchorOffset];
  if (!isCloseBracket(anchorChar)) return null;
  const targetChar = CLOSE_TO_OPEN[anchorChar];
  let depth = 1;
  let scanned = 0;
  for (let index = anchorOffset - 1; index >= 0; index -= 1) {
    scanned += 1;
    if (scanned > maxScanDistance) return null;
    const char = content[index];
    if (char === anchorChar) {
      depth += 1;
      continue;
    }
    if (char === targetChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          anchorOffset,
          anchorChar,
          matchOffset: index,
          matchChar: char,
        };
      }
    }
  }
  return null;
};

export const findBracketMatchNearCaret = (
  content: string,
  selectionStart: number,
  selectionEnd: number,
  maxScanDistance = 1_000_000,
): BracketMatch | null => {
  if (selectionStart !== selectionEnd) return null;
  if (!content.length) return null;

  const caret = Math.max(0, Math.min(selectionEnd, content.length));
  const candidates: number[] = [];
  if (caret < content.length) candidates.push(caret);
  if (caret > 0) candidates.push(caret - 1);

  for (const offset of candidates) {
    const char = content[offset];
    if (isOpenBracket(char)) {
      const match = findForwardMatch(content, offset, maxScanDistance);
      if (match) return match;
    } else if (isCloseBracket(char)) {
      const match = findBackwardMatch(content, offset, maxScanDistance);
      if (match) return match;
    }
  }
  return null;
};
