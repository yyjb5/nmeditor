export type BookmarkExportPayload = {
  version: 1;
  path: string | null;
  savedAt: string;
  bookmarks: number[];
};

const normalizeZeroBasedLines = (
  values: number[],
  maxLineIndex: number,
): number[] => {
  if (maxLineIndex < 0) return [];
  const unique = new Set<number>();
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    const normalized = Math.trunc(value);
    if (normalized < 0 || normalized > maxLineIndex) continue;
    unique.add(normalized);
  }
  return [...unique].sort((a, b) => a - b);
};

export const serializeBookmarksForExport = (
  zeroBasedLines: number[],
  path: string | null,
): string => {
  const payload: BookmarkExportPayload = {
    version: 1,
    path,
    savedAt: new Date().toISOString(),
    bookmarks: [...new Set(zeroBasedLines)]
      .map((value) => Math.trunc(value))
      .filter((value) => value >= 0)
      .sort((a, b) => a - b)
      .map((value) => value + 1),
  };
  return JSON.stringify(payload, null, 2);
};

export const parseBookmarksFromImport = (
  raw: string,
  maxLineIndex: number,
): number[] => {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    const oneBased = parsed.map((value) =>
      typeof value === "number" ? value - 1 : Number.NaN,
    );
    return normalizeZeroBasedLines(oneBased, maxLineIndex);
  }
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const candidate = parsed as { bookmarks?: unknown };
  if (!Array.isArray(candidate.bookmarks)) {
    return [];
  }
  const oneBased = candidate.bookmarks.map((value) =>
    typeof value === "number" ? value - 1 : Number.NaN,
  );
  return normalizeZeroBasedLines(oneBased, maxLineIndex);
};
