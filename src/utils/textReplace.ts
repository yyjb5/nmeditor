export type ReplaceTextInContentParams = {
  content: string;
  query: string;
  replacement: string;
  useRegex: boolean;
  matchCase: boolean;
  replaceAll: boolean;
  preserveCase?: boolean;
};

export type ReplaceTextInContentResult = {
  content: string;
  replacedCount: number;
};

const LETTER_RE = /[A-Za-z]/;
const WORD_RE = /[A-Za-z]+/g;

const isAllUpperCase = (value: string): boolean => LETTER_RE.test(value) && value === value.toUpperCase();

const isAllLowerCase = (value: string): boolean => LETTER_RE.test(value) && value === value.toLowerCase();

const isTitleCaseWords = (value: string): boolean => {
  const words = value.match(WORD_RE);
  if (!words?.length) return false;
  return words.every((word) => {
    if (!word.length) return false;
    return word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase();
  });
};

const toTitleCaseWords = (value: string): string =>
  value.replace(WORD_RE, (word) => {
    if (!word.length) return word;
    return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
  });

export const applyReplacementCasePattern = (replacement: string, source: string): string => {
  if (!replacement.length || !source.length) return replacement;
  if (isAllUpperCase(source)) return replacement.toUpperCase();
  if (isAllLowerCase(source)) return replacement.toLowerCase();
  if (isTitleCaseWords(source)) return toTitleCaseWords(replacement);
  return replacement;
};

const replaceLiteral = (
  content: string,
  query: string,
  replacement: string,
  matchCase: boolean,
  replaceAll: boolean,
  preserveCase: boolean,
): ReplaceTextInContentResult => {
  if (!query.length) return { content, replacedCount: 0 };

  const haystack = matchCase ? content : content.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();

  const firstIndex = haystack.indexOf(needle);
  if (firstIndex < 0) return { content, replacedCount: 0 };
  const resolveReplacement = (matchedText: string) =>
    preserveCase ? applyReplacementCasePattern(replacement, matchedText) : replacement;

  if (!replaceAll) {
    const matchedText = content.slice(firstIndex, firstIndex + query.length);
    return {
      content: `${content.slice(0, firstIndex)}${resolveReplacement(matchedText)}${content.slice(firstIndex + query.length)}`,
      replacedCount: 1,
    };
  }

  const chunks: string[] = [];
  let replacedCount = 0;
  let cursor = 0;
  let index = firstIndex;
  while (index >= 0) {
    const matchedText = content.slice(index, index + query.length);
    chunks.push(content.slice(cursor, index));
    chunks.push(resolveReplacement(matchedText));
    cursor = index + query.length;
    replacedCount += 1;
    index = haystack.indexOf(needle, cursor);
  }
  chunks.push(content.slice(cursor));
  return { content: chunks.join(""), replacedCount };
};

const replaceByRegex = (
  content: string,
  query: string,
  replacement: string,
  matchCase: boolean,
  replaceAll: boolean,
): ReplaceTextInContentResult => {
  const flags = `${replaceAll ? "g" : ""}${matchCase ? "" : "i"}`;
  const regex = new RegExp(query, flags);
  if (replaceAll) {
    const matches = content.match(regex);
    if (!matches?.length) return { content, replacedCount: 0 };
    return {
      content: content.replace(regex, replacement),
      replacedCount: matches.length,
    };
  }

  const first = regex.exec(content);
  if (!first) return { content, replacedCount: 0 };
  return {
    content: content.replace(regex, replacement),
    replacedCount: 1,
  };
};

export const replaceTextInContent = (
  params: ReplaceTextInContentParams,
): ReplaceTextInContentResult => {
  const { content, query, replacement, useRegex, matchCase, replaceAll, preserveCase = false } = params;
  if (!query) return { content, replacedCount: 0 };
  if (useRegex) {
    return replaceByRegex(content, query, replacement, matchCase, replaceAll);
  }
  return replaceLiteral(content, query, replacement, matchCase, replaceAll, preserveCase);
};
