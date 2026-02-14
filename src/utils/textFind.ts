export const TEXT_FIND_RESULTS_PANEL_LIMIT = 200;
export const TEXT_FIND_CONTEXT_BATCH_SIZE = 24;
export const TEXT_FIND_CONTEXT_CACHE_LIMIT = 2048;
export const TEXT_FIND_CONTEXT_ACTIVE_NEIGHBOR = 64;
export const TEXT_FIND_GROUP_RENDER_BATCH = 12;
export const TEXT_FIND_GROUP_ITEMS_BATCH = 80;
export const TEXT_FIND_GROUPS_COLLAPSE_STORAGE_PREFIX = "nmeditor.textFindGroupsCollapse";

export type NextTextMatch = {
  start: number;
  end: number;
  matchText: string;
  regexMatch: RegExpExecArray | null;
};

export const findNextLiteralMatch = (
  content: string,
  query: string,
  matchCase: boolean,
  startIndex: number,
): NextTextMatch | null => {
  if (!query.length) return null;
  const haystack = matchCase ? content : content.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  const safeStart = Math.max(0, Math.min(startIndex, haystack.length));
  let index = haystack.indexOf(needle, safeStart);
  if (index < 0 && safeStart > 0) {
    index = haystack.indexOf(needle, 0);
  }
  if (index < 0) return null;
  return {
    start: index,
    end: index + query.length,
    matchText: content.slice(index, index + query.length),
    regexMatch: null,
  };
};

export const findNextRegexMatch = (
  content: string,
  query: string,
  matchCase: boolean,
  startIndex: number,
): NextTextMatch | null => {
  const flags = matchCase ? "g" : "gi";
  const regex = new RegExp(query, flags);
  const safeStart = Math.max(0, Math.min(startIndex, content.length));
  regex.lastIndex = safeStart;
  let match = regex.exec(content);
  if (!match && safeStart > 0) {
    regex.lastIndex = 0;
    match = regex.exec(content);
  }
  if (!match) return null;
  const start = match.index ?? -1;
  if (start < 0) return null;
  const end = start + match[0].length;
  return {
    start,
    end,
    matchText: match[0],
    regexMatch: match,
  };
};

export const applyRegexReplacementTemplate = (
  template: string,
  match: RegExpExecArray,
  input: string,
  start: number,
): string => {
  const full = match[0] ?? "";
  const end = start + full.length;
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (_raw, token: string) => {
    if (token === "$") return "$";
    if (token === "&") return full;
    if (token === "`") return input.slice(0, start);
    if (token === "'") return input.slice(end);
    if (token.startsWith("<") && token.endsWith(">")) {
      const groupName = token.slice(1, -1);
      const groups = match.groups as Record<string, string> | undefined;
      if (!groups) return "";
      return groups[groupName] ?? "";
    }
    const groupIndex = Number.parseInt(token, 10);
    if (!Number.isFinite(groupIndex) || groupIndex < 0) return "";
    return match[groupIndex] ?? "";
  });
};

export const pruneTextFindContextCache = (
  cache: Record<number, string>,
  pinnedIndices: Set<number>,
  limit: number,
  anchorIndex: number,
): Record<number, string> => {
  if (limit <= 0) return {};
  const keys = Object.keys(cache)
    .map((key) => Number.parseInt(key, 10))
    .filter((index) => Number.isFinite(index));
  if (keys.length <= limit) return cache;

  const distance = (index: number) => (anchorIndex >= 0 ? Math.abs(index - anchorIndex) : index);
  const pinned = keys
    .filter((index) => pinnedIndices.has(index))
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, limit);
  const keep = new Set<number>(pinned);

  if (keep.size < limit) {
    const remainder = keys
      .filter((index) => !keep.has(index))
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, limit - keep.size);
    remainder.forEach((index) => keep.add(index));
  }

  if (keep.size >= keys.length) return cache;
  const next: Record<number, string> = {};
  keep.forEach((index) => {
    const value = cache[index];
    if (value !== undefined) {
      next[index] = value;
    }
  });
  return next;
};
