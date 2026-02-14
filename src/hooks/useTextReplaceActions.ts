import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  applyRegexReplacementTemplate,
  findNextLiteralMatch,
  findNextRegexMatch,
} from "../utils/textFind";
import { applyReplacementCasePattern, replaceTextInContent } from "../utils/textReplace";

type UseTextReplaceActionsParams = {
  textReadOnlyPreview: boolean;
  textReplaceRunning: boolean;
  textFindQuery: string;
  textContent: string;
  textReplaceValue: string;
  textFindUseRegex: boolean;
  textFindMatchCase: boolean;
  textReplacePreserveCase: boolean;
  textReplaceConfirmEach: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  setTextContent: (value: string) => void;
  resetTextFindState: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  t: (en: string, zh: string) => string;
};

export default function useTextReplaceActions({
  textReadOnlyPreview,
  textReplaceRunning,
  textFindQuery,
  textContent,
  textReplaceValue,
  textFindUseRegex,
  textFindMatchCase,
  textReplacePreserveCase,
  textReplaceConfirmEach,
  textAreaRef,
  setTextContent,
  resetTextFindState,
  setError,
  t,
}: UseTextReplaceActionsParams) {
  const [pendingTextReplace, setPendingTextReplace] = useState<{
    start: number;
    end: number;
    matchText: string;
    replacementText: string;
  } | null>(null);

  const textReplaceHasPendingConfirm = pendingTextReplace !== null;

  const focusEditorSelection = useCallback(
    (start: number, end: number) => {
      window.requestAnimationFrame(() => {
        const editor = textAreaRef.current;
        if (!editor) return;
        editor.focus();
        editor.setSelectionRange(start, end);
      });
    },
    [textAreaRef],
  );

  useEffect(() => {
    setPendingTextReplace(null);
  }, [
    textContent,
    textFindQuery,
    textReplaceValue,
    textFindUseRegex,
    textFindMatchCase,
    textReplacePreserveCase,
    textReplaceConfirmEach,
  ]);

  const runTextReplaceInChunk = useCallback(
    (replaceAll: boolean) => {
      if (!textReadOnlyPreview) return;
      if (textReplaceRunning) return;
      setPendingTextReplace(null);
      if (!textFindQuery.trim()) {
        setError(t("Find text is required.", "Find text is required."));
        return;
      }
      try {
        const result = replaceTextInContent({
          content: textContent,
          query: textFindQuery,
          replacement: textReplaceValue,
          useRegex: textFindUseRegex,
          matchCase: textFindMatchCase,
          replaceAll,
          preserveCase: textReplacePreserveCase && !textFindUseRegex,
        });
        if (result.replacedCount < 1) {
          setError(t("No matches found in current chunk.", "No matches found in current chunk."));
          return;
        }
        if (result.content !== textContent) {
          setTextContent(result.content);
        }
        resetTextFindState();
        setError(
          t(
            `Replaced ${result.replacedCount} match(es) in current chunk.`,
            `Replaced ${result.replacedCount} match(es) in current chunk.`,
          ),
        );
      } catch (err) {
        setError(t(`Invalid regex: ${String(err)}`, `Invalid regex: ${String(err)}`));
      }
    },
    [
      resetTextFindState,
      setError,
      setTextContent,
      t,
      textContent,
      textFindMatchCase,
      textFindQuery,
      textFindUseRegex,
      textReadOnlyPreview,
      textReplacePreserveCase,
      textReplaceRunning,
      textReplaceValue,
      setPendingTextReplace,
    ],
  );

  const runTextReplaceInSelection = useCallback(
    (replaceAll: boolean) => {
      if (textReplaceRunning) return;
      setPendingTextReplace(null);
      if (!textFindQuery.trim()) {
        setError(t("Find text is required.", "Find text is required."));
        return;
      }
      const editor = textAreaRef.current;
      if (!editor) {
        setError(t("Text editor is unavailable.", "Text editor is unavailable."));
        return;
      }
      const start = Math.min(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      const end = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      if (end <= start) {
        setError(t("Select text first.", "Select text first."));
        return;
      }
      const selectedContent = textContent.slice(start, end);
      try {
        const result = replaceTextInContent({
          content: selectedContent,
          query: textFindQuery,
          replacement: textReplaceValue,
          useRegex: textFindUseRegex,
          matchCase: textFindMatchCase,
          replaceAll,
          preserveCase: textReplacePreserveCase && !textFindUseRegex,
        });
        if (result.replacedCount < 1) {
          setError(
            t(
              "No matches found in current selection.",
              "No matches found in current selection.",
            ),
          );
          return;
        }
        const nextContent = `${textContent.slice(0, start)}${result.content}${textContent.slice(end)}`;
        setTextContent(nextContent);
        const nextSelectionStart = start;
        const nextSelectionEnd = start + result.content.length;
        focusEditorSelection(nextSelectionStart, nextSelectionEnd);
        resetTextFindState();
        setError(
          t(
            `Replaced ${result.replacedCount} match(es) in current selection.`,
            `Replaced ${result.replacedCount} match(es) in current selection.`,
          ),
        );
      } catch (err) {
        setError(t(`Invalid regex: ${String(err)}`, `Invalid regex: ${String(err)}`));
      }
    },
    [
      resetTextFindState,
      setError,
      setTextContent,
      t,
      textContent,
      textFindMatchCase,
      textFindQuery,
      textFindUseRegex,
      textReplacePreserveCase,
      textReplaceRunning,
      textReplaceValue,
      textAreaRef,
      setPendingTextReplace,
      focusEditorSelection,
    ],
  );

  const runTextReplaceNext = useCallback(() => {
    if (textReplaceRunning) return;
    const query = textFindQuery.trim();
    if (!query.length) {
      setError(t("Find text is required.", "Find text is required."));
      return;
    }
    const editor = textAreaRef.current;
    if (!editor) {
      setError(t("Text editor is unavailable.", "Text editor is unavailable."));
      return;
    }
    const selectionStart = Math.max(0, Math.min(editor.selectionStart ?? 0, textContent.length));
    const selectionEnd = Math.max(0, Math.min(editor.selectionEnd ?? 0, textContent.length));
    const searchStart = Math.max(selectionStart, selectionEnd);
    try {
      const match = textFindUseRegex
        ? findNextRegexMatch(textContent, query, textFindMatchCase, searchStart)
        : findNextLiteralMatch(textContent, query, textFindMatchCase, searchStart);
      if (!match) {
        setError(t("No matches found in current chunk.", "No matches found in current chunk."));
        return;
      }
      if (match.end <= match.start) {
        setError(
          t(
            "Zero-length regex matches are not supported for Replace next.",
            "Zero-length regex matches are not supported for Replace next.",
          ),
        );
        return;
      }
      const replacementText =
        textFindUseRegex && match.regexMatch
          ? applyRegexReplacementTemplate(textReplaceValue, match.regexMatch, textContent, match.start)
          : textReplacePreserveCase
            ? applyReplacementCasePattern(textReplaceValue, match.matchText)
            : textReplaceValue;
      if (textReplaceConfirmEach) {
        setPendingTextReplace({
          start: match.start,
          end: match.end,
          matchText: match.matchText,
          replacementText,
        });
        focusEditorSelection(match.start, match.end);
        setError(
          t(
            `Preview replace at ${match.start}: "${match.matchText}" -> "${replacementText}". Click Confirm replace.`,
            `Preview replace at ${match.start}: "${match.matchText}" -> "${replacementText}". Click Confirm replace.`,
          ),
        );
        return;
      }
      const nextContent = `${textContent.slice(0, match.start)}${replacementText}${textContent.slice(match.end)}`;
      setTextContent(nextContent);
      const nextSelectionStart = match.start;
      const nextSelectionEnd = match.start + replacementText.length;
      focusEditorSelection(nextSelectionStart, nextSelectionEnd);
      resetTextFindState();
      setError(
        t(
          `Replaced 1 match at ${match.start}.`,
          `Replaced 1 match at ${match.start}.`,
        ),
      );
    } catch (err) {
      setError(t(`Invalid regex: ${String(err)}`, `Invalid regex: ${String(err)}`));
    }
  }, [
    resetTextFindState,
    setError,
    setTextContent,
    t,
    textContent,
    textFindMatchCase,
    textFindQuery,
    textFindUseRegex,
    textReplaceConfirmEach,
    textReplacePreserveCase,
    textReplaceRunning,
    textReplaceValue,
    textAreaRef,
    focusEditorSelection,
  ]);

  const runTextReplaceConfirmNext = useCallback(() => {
    if (textReplaceRunning) return;
    if (!pendingTextReplace) {
      setError(
        t(
          "No pending replace preview. Click Replace next to preview first.",
          "No pending replace preview. Click Replace next to preview first.",
        ),
      );
      return;
    }
    const { start, end, matchText, replacementText } = pendingTextReplace;
    if (start < 0 || end <= start || end > textContent.length) {
      setPendingTextReplace(null);
      setError(t("Replace preview is stale. Re-run Replace next.", "Replace preview is stale. Re-run Replace next."));
      return;
    }
    const currentMatch = textContent.slice(start, end);
    if (currentMatch !== matchText) {
      setPendingTextReplace(null);
      setError(t("Replace preview is stale. Re-run Replace next.", "Replace preview is stale. Re-run Replace next."));
      return;
    }
    const nextContent = `${textContent.slice(0, start)}${replacementText}${textContent.slice(end)}`;
    setTextContent(nextContent);
    setPendingTextReplace(null);
    focusEditorSelection(start, start + replacementText.length);
    resetTextFindState();
    setError(
      t(
        `Replaced 1 match at ${start}.`,
        `Replaced 1 match at ${start}.`,
      ),
    );
  }, [
    focusEditorSelection,
    pendingTextReplace,
    resetTextFindState,
    setError,
    setTextContent,
    t,
    textContent,
    textReplaceRunning,
  ]);

  return {
    runTextReplaceInChunk,
    runTextReplaceInSelection,
    runTextReplaceNext,
    runTextReplaceConfirmNext,
    textReplaceHasPendingConfirm,
  };
}
