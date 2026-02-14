import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  applyMultiCursorEdit,
  buildBlockSelectionRanges,
  buildLineStarts,
  buildLineEndCursorRanges,
  buildVerticalCursorRanges,
  findLineIndexAtOffset,
  findAllOccurrenceRanges,
  findNextOccurrenceRange,
  measureVisualColumn,
  moveOffsetByLines,
  moveOffsetToLineBoundary,
  moveOffsetByVisualColumns,
  normalizeRanges,
} from "../../utils/multiCursor";
import {
  parseBookmarksFromImport,
  serializeBookmarksForExport,
} from "../../utils/bookmarks";
import { findBracketMatchNearCaret } from "../../utils/bracketMatching";
import {
  buildBraceFoldRanges,
  detectSyntaxLanguageFromPath,
  renderSyntaxHighlightedHtml,
} from "../../utils/syntaxHighlight";
import type { TextModeWorkspaceProps } from "./types";
import "./styles.css";

const MAX_RENDERED_MULTI_CURSOR_MARKERS = 128;
const BOOKMARK_STORAGE_KEY_PREFIX = "text-bookmarks:v1:";
const BRACKET_SCAN_DISTANCE = 500_000;
const MAX_SYNTAX_PREVIEW_CHARS = 250_000;
const MAX_INLINE_SYNTAX_CHARS = 120_000;
const CodeMirrorPreview = lazy(() => import("../CodeMirrorPreview"));

export default function TextModeWorkspace({
  t,
  textPath,
  textDirty,
  textEncoding,
  textReadOnlyPreview,
  textLoading,
  textReplaceRunning,
  textPreviewHasPrev,
  textPreviewHasNext,
  textChunkJumpInput,
  textTotalBytes,
  textFindQuery,
  textFindRunning,
  textReplaceValue,
  textReplacePreserveCase,
  textReplaceConfirmEach,
  textReplaceHasPendingConfirm,
  textFindUseRegex,
  textFindMatchCase,
  textFindHitsLength,
  textPreviewOffset,
  textPreviewBytes,
  largeTextPreviewBytes,
  largeTextFileThresholdBytes,
  textReplaceProgress,
  textReplaceAppliedCount,
  textReplaceElapsedMs,
  textFindProgress,
  textFindMatchedCount,
  textFindHasMore,
  activeTextFindIndex,
  textContent,
  error,
  textAreaRef,
  findResultsPanel,
  formatByteSize,
  setTextEncoding,
  setTextChunkJumpInput,
  setTextFindQuery,
  setTextReplaceValue,
  setTextReplacePreserveCase,
  setTextReplaceConfirmEach,
  setTextFindUseRegex,
  setTextFindMatchCase,
  setTextContent,
  saveCurrent,
  saveTextAs,
  loadPrevTextPreviewChunk,
  loadNextTextPreviewChunk,
  jumpToTextChunk,
  runTextFind,
  runTextReplaceInChunk,
  runTextReplaceNext,
  runTextReplaceConfirmNext,
  runTextReplaceInSelection,
  runTextReplaceInFile,
  jumpTextFindPrev,
  jumpTextFindNext,
  cancelTextReplaceJobInternal,
  cancelTextFindJobInternal,
}: TextModeWorkspaceProps) {
  const [multiCursorRanges, setMultiCursorRanges] = useState<Array<{ start: number; end: number }>>(
    [],
  );
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [editorScrollLeft, setEditorScrollLeft] = useState(0);
  const [editorLineHeight, setEditorLineHeight] = useState(20);
  const [editorCharWidth, setEditorCharWidth] = useState(8);
  const [editorPaddingTop, setEditorPaddingTop] = useState(10);
  const [editorPaddingLeft, setEditorPaddingLeft] = useState(12);
  const [editorClientHeight, setEditorClientHeight] = useState(0);
  const [editorClientWidth, setEditorClientWidth] = useState(0);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });
  const [showSyntaxPreview, setShowSyntaxPreview] = useState(false);
  const [syntaxPreviewEngine, setSyntaxPreviewEngine] = useState<"native" | "light">("native");
  const [enableInlineSyntax, setEnableInlineSyntax] = useState(false);
  const [collapsedFoldStarts, setCollapsedFoldStarts] = useState<number[]>([]);
  const [gotoLineColumnInput, setGotoLineColumnInput] = useState("");
  const [bookmarkFilterInput, setBookmarkFilterInput] = useState("");
  const [bookmarkNotice, setBookmarkNotice] = useState("");
  const [bookmarkedLines, setBookmarkedLines] = useState<number[]>([]);
  const bookmarkImportInputRef = useRef<HTMLInputElement | null>(null);
  const blockSelectionAnchorRef = useRef<number | null>(null);
  const blockSelectionStateRef = useRef<{ anchor: number; focus: number } | null>(null);
  const normalizedMultiCursorRanges = useMemo(
    () => normalizeRanges(multiCursorRanges),
    [multiCursorRanges],
  );
  const multiCursorCount = normalizedMultiCursorRanges.length;
  const multiCursorActive = multiCursorCount > 1;
  const multiCursorPreview = useMemo(
    () =>
      normalizedMultiCursorRanges.slice(0, 6).map((range, index) => ({
        id: `${range.start}:${range.end}:${index}`,
        text: `#${index + 1}@${range.start}`,
      })),
    [normalizedMultiCursorRanges],
  );
  const hasBlockSelection = useMemo(
    () => normalizedMultiCursorRanges.some((range) => range.end > range.start),
    [normalizedMultiCursorRanges],
  );
  const blockSelectionClipboardText = useMemo(() => {
    if (!hasBlockSelection) return "";
    return normalizedMultiCursorRanges
      .map((range) => textContent.slice(range.start, range.end))
      .join("\n");
  }, [hasBlockSelection, normalizedMultiCursorRanges, textContent]);
  const maxLineIndex = useMemo(
    () => Math.max(0, buildLineStarts(textContent).length - 1),
    [textContent],
  );
  const syntaxLanguage = useMemo(
    () => detectSyntaxLanguageFromPath(textPath ?? null),
    [textPath],
  );
  const syntaxPreviewSupported = syntaxLanguage !== "plain";
  const inlineSyntaxTooLarge = textContent.length > MAX_INLINE_SYNTAX_CHARS;
  const inlineSyntaxAvailable =
    syntaxPreviewSupported && !inlineSyntaxTooLarge && !textReadOnlyPreview;
  const showInlineSyntax =
    enableInlineSyntax && inlineSyntaxAvailable && textContent.length > 0;
  const inlineSyntaxHtml = useMemo(() => {
    if (!showInlineSyntax) return "";
    return renderSyntaxHighlightedHtml(textContent, syntaxLanguage);
  }, [showInlineSyntax, syntaxLanguage, textContent]);
  const syntaxPreviewTooLarge = textContent.length > MAX_SYNTAX_PREVIEW_CHARS;
  const syntaxPreviewContent = useMemo(() => {
    if (!syntaxPreviewTooLarge) return textContent;
    return textContent.slice(0, MAX_SYNTAX_PREVIEW_CHARS);
  }, [syntaxPreviewTooLarge, textContent]);
  const syntaxPreviewLines = useMemo(
    () => syntaxPreviewContent.split("\n"),
    [syntaxPreviewContent],
  );
  const syntaxPreviewLineHtml = useMemo(() => {
    if (!syntaxPreviewSupported) return [];
    return syntaxPreviewLines.map((line) =>
      line.length
        ? renderSyntaxHighlightedHtml(line, syntaxLanguage)
        : "&nbsp;",
    );
  }, [syntaxLanguage, syntaxPreviewLines, syntaxPreviewSupported]);
  const syntaxFoldRanges = useMemo(() => {
    if (!syntaxPreviewSupported) return [];
    return buildBraceFoldRanges(syntaxPreviewContent, 2_000);
  }, [syntaxPreviewContent, syntaxPreviewSupported]);
  const syntaxFoldRangeByStartLine = useMemo(() => {
    const map = new Map<number, { startLine: number; endLine: number }>();
    for (const range of syntaxFoldRanges) {
      const current = map.get(range.startLine);
      if (!current || range.endLine > current.endLine) {
        map.set(range.startLine, range);
      }
    }
    return map;
  }, [syntaxFoldRanges]);
  const syntaxFoldStartLines = useMemo(
    () => Array.from(syntaxFoldRangeByStartLine.keys()).sort((a, b) => a - b),
    [syntaxFoldRangeByStartLine],
  );
  const syntaxPreviewRenderedRows = useMemo(() => {
    const collapsed = new Set(collapsedFoldStarts);
    const rows: Array<
      | {
          kind: "line";
          lineIndex: number;
          html: string;
          foldRange: { startLine: number; endLine: number } | null;
          collapsed: boolean;
        }
      | {
          kind: "collapsed";
          lineIndex: number;
          hiddenLines: number;
        }
    > = [];
    let lineIndex = 0;
    while (lineIndex < syntaxPreviewLines.length) {
      const foldRange = syntaxFoldRangeByStartLine.get(lineIndex) ?? null;
      const isCollapsed = foldRange ? collapsed.has(lineIndex) : false;
      rows.push({
        kind: "line",
        lineIndex,
        html: syntaxPreviewLineHtml[lineIndex] ?? "&nbsp;",
        foldRange,
        collapsed: isCollapsed,
      });
      if (foldRange && isCollapsed) {
        const hiddenLines = Math.max(0, foldRange.endLine - lineIndex);
        rows.push({
          kind: "collapsed",
          lineIndex,
          hiddenLines,
        });
        lineIndex = foldRange.endLine + 1;
      } else {
        lineIndex += 1;
      }
    }
    return rows;
  }, [
    collapsedFoldStarts,
    syntaxFoldRangeByStartLine,
    syntaxPreviewLineHtml,
    syntaxPreviewLines.length,
  ]);

  const syncEditorMetrics = useCallback(() => {
    const editor = textAreaRef.current;
    if (!editor) return;
    const computed = window.getComputedStyle(editor);
    const parsePx = (value: string, fallback: number): number => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const lineHeight = parsePx(
      computed.lineHeight,
      parsePx(computed.fontSize, 13) * 1.5,
    );
    const paddingTop = parsePx(computed.paddingTop, 10);
    const paddingLeft = parsePx(computed.paddingLeft, 12);
    const probe = document.createElement("span");
    probe.textContent = "M";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "pre";
    probe.style.font = computed.font;
    document.body.appendChild(probe);
    const measuredWidth = probe.getBoundingClientRect().width || 8;
    probe.remove();
    setEditorLineHeight(lineHeight);
    setEditorPaddingTop(paddingTop);
    setEditorPaddingLeft(paddingLeft);
    setEditorCharWidth(measuredWidth);
    setEditorClientHeight(editor.clientHeight);
    setEditorClientWidth(editor.clientWidth);
    setEditorScrollTop(editor.scrollTop);
    setEditorScrollLeft(editor.scrollLeft);
  }, [textAreaRef]);

  const syncEditorSelection = useCallback(() => {
    const editor = textAreaRef.current;
    if (!editor) return;
    const nextStart = Math.max(0, editor.selectionStart ?? 0);
    const nextEnd = Math.max(0, editor.selectionEnd ?? 0);
    setEditorSelection((current) => {
      if (current.start === nextStart && current.end === nextEnd) {
        return current;
      }
      return { start: nextStart, end: nextEnd };
    });
  }, [textAreaRef]);

  useLayoutEffect(() => {
    syncEditorMetrics();
    syncEditorSelection();
    const editor = textAreaRef.current;
    if (!editor) return;
    const handleResize = () => syncEditorMetrics();
    window.addEventListener("resize", handleResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncEditorMetrics());
      observer.observe(editor);
    }
    return () => {
      window.removeEventListener("resize", handleResize);
      observer?.disconnect();
    };
  }, [syncEditorMetrics, syncEditorSelection, textAreaRef]);

  useEffect(() => {
    setMultiCursorRanges([]);
    blockSelectionAnchorRef.current = null;
    blockSelectionStateRef.current = null;
    syncEditorSelection();
  }, [syncEditorSelection, textPath, textPreviewOffset]);

  useEffect(() => {
    if (!syntaxPreviewSupported && showSyntaxPreview) {
      setShowSyntaxPreview(false);
    }
  }, [showSyntaxPreview, syntaxPreviewSupported]);

  useEffect(() => {
    if (!inlineSyntaxAvailable && enableInlineSyntax) {
      setEnableInlineSyntax(false);
    }
  }, [enableInlineSyntax, inlineSyntaxAvailable]);

  useEffect(() => {
    setCollapsedFoldStarts([]);
  }, [syntaxLanguage, textPath]);

  useEffect(() => {
    setGotoLineColumnInput("");
    setBookmarkFilterInput("");
    setBookmarkNotice("");
    if (!textPath) {
      setBookmarkedLines([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`${BOOKMARK_STORAGE_KEY_PREFIX}${textPath}`);
      if (!raw) {
        setBookmarkedLines([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setBookmarkedLines([]);
        return;
      }
      const normalized = parsed
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);
      setBookmarkedLines(normalized);
    } catch {
      setBookmarkedLines([]);
    }
  }, [textPath]);

  useEffect(() => {
    if (!multiCursorCount) return;
    syncEditorMetrics();
  }, [multiCursorCount, syncEditorMetrics]);

  useEffect(() => {
    setBookmarkedLines((current) =>
      current.filter((lineIndex) => lineIndex >= 0 && lineIndex <= maxLineIndex),
    );
  }, [maxLineIndex]);

  useEffect(() => {
    if (!textPath) return;
    const key = `${BOOKMARK_STORAGE_KEY_PREFIX}${textPath}`;
    try {
      if (!bookmarkedLines.length) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(bookmarkedLines));
    } catch {
      // Ignore storage errors (quota/private mode).
    }
  }, [bookmarkedLines, textPath]);

  const focusCursorRange = useCallback(
    (start: number, end: number) => {
      window.requestAnimationFrame(() => {
        const editor = textAreaRef.current;
        if (!editor) return;
        editor.focus();
        editor.setSelectionRange(start, end);
        setEditorSelection({ start, end });
      });
    },
    [textAreaRef],
  );

  const clearMultiCursors = useCallback(() => {
    blockSelectionStateRef.current = null;
    setMultiCursorRanges([]);
  }, []);

  const getCaretOffset = useCallback(() => {
    return Math.max(editorSelection.start, editorSelection.end);
  }, [editorSelection.end, editorSelection.start]);

  const getCurrentCaretLineIndex = useCallback(() => {
    const lineStarts = buildLineStarts(textContent);
    const offset = getCaretOffset();
    return findLineIndexAtOffset(lineStarts, offset);
  }, [getCaretOffset, textContent]);

  const jumpToOffset = useCallback(
    (offset: number) => {
      const safeOffset = Math.max(0, Math.min(offset, textContent.length));
      focusCursorRange(safeOffset, safeOffset);
    },
    [focusCursorRange, textContent.length],
  );

  const navigateToOffset = useCallback(
    (offset: number) => {
      const safeOffset = Math.max(0, Math.min(offset, textContent.length));
      const block = blockSelectionStateRef.current;
      if (block) {
        const ranges = buildBlockSelectionRanges(textContent, block.anchor, safeOffset);
        if (ranges.length) {
          blockSelectionStateRef.current = { anchor: block.anchor, focus: safeOffset };
          setMultiCursorRanges(ranges);
          const tail = ranges[ranges.length - 1];
          if (tail) {
            focusCursorRange(tail.start, tail.end);
          }
          return;
        }
      }
      jumpToOffset(safeOffset);
    },
    [focusCursorRange, jumpToOffset, textContent],
  );

  const jumpToLineIndex = useCallback(
    (lineIndex: number) => {
      const lineStarts = buildLineStarts(textContent);
      if (!lineStarts.length) return;
      const safeLineIndex = Math.max(0, Math.min(lineIndex, lineStarts.length - 1));
      navigateToOffset(lineStarts[safeLineIndex] ?? 0);
    },
    [navigateToOffset, textContent],
  );

  const toggleCurrentLineBookmark = useCallback(() => {
    const lineIndex = getCurrentCaretLineIndex();
    setBookmarkedLines((current) => {
      if (current.includes(lineIndex)) {
        return current.filter((item) => item !== lineIndex);
      }
      return [...current, lineIndex].sort((a, b) => a - b);
    });
  }, [getCurrentCaretLineIndex]);

  const jumpNextBookmark = useCallback(() => {
    if (!bookmarkedLines.length) return;
    const lineIndex = getCurrentCaretLineIndex();
    const next = bookmarkedLines.find((item) => item > lineIndex) ?? bookmarkedLines[0];
    jumpToLineIndex(next);
  }, [bookmarkedLines, getCurrentCaretLineIndex, jumpToLineIndex]);

  const jumpPrevBookmark = useCallback(() => {
    if (!bookmarkedLines.length) return;
    const lineIndex = getCurrentCaretLineIndex();
    const reversed = [...bookmarkedLines].reverse();
    const prev = reversed.find((item) => item < lineIndex) ?? reversed[0];
    jumpToLineIndex(prev);
  }, [bookmarkedLines, getCurrentCaretLineIndex, jumpToLineIndex]);

  const jumpToLineColumn = useCallback(() => {
    const raw = gotoLineColumnInput.trim();
    if (!raw) return;
    const match = raw.match(/^(\d+)(?:\s*[:.,]\s*(\d+))?$/);
    if (!match) return;
    const lineOneBased = Number.parseInt(match[1], 10);
    const columnOneBased = match[2] ? Number.parseInt(match[2], 10) : 1;
    if (!Number.isFinite(lineOneBased) || lineOneBased <= 0) return;
    if (!Number.isFinite(columnOneBased) || columnOneBased <= 0) return;
    const lineStarts = buildLineStarts(textContent);
    if (!lineStarts.length) return;
    const lineIndex = Math.max(0, Math.min(lineOneBased - 1, lineStarts.length - 1));
    const lineStart = lineStarts[lineIndex] ?? 0;
    const lineEnd =
      lineIndex + 1 < lineStarts.length
        ? Math.max(lineStart, lineStarts[lineIndex + 1] - 1)
        : textContent.length;
    const targetOffset = Math.max(
      lineStart,
      Math.min(lineStart + columnOneBased - 1, lineEnd),
    );
    navigateToOffset(targetOffset);
  }, [gotoLineColumnInput, navigateToOffset, textContent]);

  const jumpToBookmarkLine = useCallback(
    (lineIndex: number) => {
      jumpToLineIndex(lineIndex);
    },
    [jumpToLineIndex],
  );

  const removeBookmarkLine = useCallback((lineIndex: number) => {
    setBookmarkedLines((current) => current.filter((item) => item !== lineIndex));
  }, []);

  const clearAllBookmarks = useCallback(() => {
    setBookmarkedLines([]);
    setBookmarkNotice(t("Bookmarks cleared.", "书签已清空。"));
  }, [t]);

  const openBookmarkImportDialog = useCallback(() => {
    bookmarkImportInputRef.current?.click();
  }, []);

  const handleBookmarkExport = useCallback(() => {
    if (!bookmarkedLines.length) {
      setBookmarkNotice(t("No bookmarks to export.", "没有可导出的书签。"));
      return;
    }
    const exportRaw = serializeBookmarksForExport(bookmarkedLines, textPath ?? null);
    const blob = new Blob([exportRaw], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fileBase =
      textPath?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "text";
    anchor.href = url;
    anchor.download = `${fileBase}.bookmarks.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 0);
    setBookmarkNotice(
      t(
        `Exported ${bookmarkedLines.length} bookmarks.`,
        `已导出 ${bookmarkedLines.length} 个书签。`,
      ),
    );
  }, [bookmarkedLines, t, textPath]);

  const handleBookmarkImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const raw = await file.text();
        const lines = parseBookmarksFromImport(raw, maxLineIndex);
        setBookmarkedLines(lines);
        setBookmarkNotice(
          t(`Imported ${lines.length} bookmarks.`, `已导入 ${lines.length} 个书签。`),
        );
      } catch {
        setBookmarkNotice(t("Failed to import bookmarks.", "导入书签失败。"));
      }
    },
    [maxLineIndex, t],
  );

  const currentCaretLineIndex = useMemo(
    () => getCurrentCaretLineIndex(),
    [getCurrentCaretLineIndex, textContent],
  );
  const bookmarkItems = useMemo(() => {
    const lines = textContent.split("\n");
    return bookmarkedLines.map((lineIndex) => {
      const lineText = lines[lineIndex] ?? "";
      const preview = lineText.length > 48 ? `${lineText.slice(0, 48)}...` : lineText;
      return {
        lineIndex,
        lineNumber: lineIndex + 1,
        preview,
      };
    });
  }, [bookmarkedLines, textContent]);
  const filteredBookmarkItems = useMemo(() => {
    const query = bookmarkFilterInput.trim().toLowerCase();
    if (!query) return bookmarkItems;
    return bookmarkItems.filter((item) => {
      if (String(item.lineNumber).includes(query)) return true;
      return item.preview.toLowerCase().includes(query);
    });
  }, [bookmarkFilterInput, bookmarkItems]);

  const popMultiCursor = useCallback(() => {
    blockSelectionStateRef.current = null;
    setMultiCursorRanges((current) => {
      const normalized = normalizeRanges(current);
      if (normalized.length <= 1) return [];
      return normalized.slice(0, normalized.length - 1);
    });
  }, []);

  const addNextMultiCursor = useCallback(() => {
    if (textReplaceRunning) return;
    blockSelectionStateRef.current = null;
    const editor = textAreaRef.current;
    if (!editor) return;
    let baseRanges = normalizedMultiCursorRanges;
    if (!baseRanges.length) {
      const start = Math.min(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      const end = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      if (end <= start) return;
      baseRanges = [{ start, end }];
    }
    const first = baseRanges[0];
    const query = textContent.slice(first.start, first.end);
    if (!query) return;
    const next = findNextOccurrenceRange(textContent, query, baseRanges);
    if (!next) {
      setMultiCursorRanges(baseRanges);
      return;
    }
    const nextRanges = normalizeRanges([...baseRanges, next]);
    setMultiCursorRanges(nextRanges);
    focusCursorRange(next.start, next.end);
  }, [
    focusCursorRange,
    normalizedMultiCursorRanges,
    textAreaRef,
    textContent,
    textReplaceRunning,
  ]);

  const addLineEndMultiCursors = useCallback(() => {
    if (textReplaceRunning) return;
    blockSelectionStateRef.current = null;
    const editor = textAreaRef.current;
    if (!editor) return;
    const start = Math.min(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
    const end = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
    if (end <= start) return;
    const ranges = buildLineEndCursorRanges(textContent, start, end);
    if (!ranges.length) return;
    setMultiCursorRanges(ranges);
    const tail = ranges[ranges.length - 1];
    focusCursorRange(tail.start, tail.end);
  }, [focusCursorRange, textAreaRef, textContent, textReplaceRunning]);

  const addAllMatchingMultiCursors = useCallback(() => {
    if (textReplaceRunning) return;
    blockSelectionStateRef.current = null;
    const editor = textAreaRef.current;
    if (!editor) return;
    let query = "";
    if (normalizedMultiCursorRanges.length) {
      const first = normalizedMultiCursorRanges[0];
      query = textContent.slice(first.start, first.end);
    } else {
      const start = Math.min(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      const end = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      if (end <= start) return;
      query = textContent.slice(start, end);
    }
    if (!query) return;
    const ranges = findAllOccurrenceRanges(textContent, query);
    if (!ranges.length) return;
    setMultiCursorRanges(ranges);
    const tail = ranges[ranges.length - 1];
    focusCursorRange(tail.start, tail.end);
  }, [
    focusCursorRange,
    normalizedMultiCursorRanges,
    textAreaRef,
    textContent,
    textReplaceRunning,
  ]);

  const addVerticalMultiCursors = useCallback(
    (direction: -1 | 1) => {
      if (textReplaceRunning) return;
      blockSelectionStateRef.current = null;
      const editor = textAreaRef.current;
      if (!editor) return;
      let baseRanges = normalizedMultiCursorRanges;
      if (!baseRanges.length) {
        const caret = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
        baseRanges = [{ start: caret, end: caret }];
      }
      const verticalRanges = buildVerticalCursorRanges(textContent, baseRanges, direction);
      if (!verticalRanges.length) {
        setMultiCursorRanges(baseRanges);
        return;
      }
      const nextRanges = normalizeRanges([...baseRanges, ...verticalRanges]);
      setMultiCursorRanges(nextRanges);
      const target =
        direction > 0
          ? verticalRanges[verticalRanges.length - 1]
          : verticalRanges[0];
      if (target) {
        focusCursorRange(target.start, target.end);
      }
    },
    [
      focusCursorRange,
      normalizedMultiCursorRanges,
      textAreaRef,
      textContent,
      textReplaceRunning,
    ],
  );

  const runMultiCursorEdit = useCallback(
    (
      operation:
        | { kind: "insert"; text: string }
        | { kind: "insert_per_range"; texts: string[] }
        | { kind: "backspace" }
        | { kind: "delete" },
    ) => {
      if (!multiCursorActive) return false;
      blockSelectionStateRef.current = null;
      const result = applyMultiCursorEdit(textContent, normalizedMultiCursorRanges, operation);
      if (result.content === textContent) return true;
      setTextContent(result.content);
      setMultiCursorRanges(result.ranges);
      const tail = result.ranges[result.ranges.length - 1];
      if (tail) {
        focusCursorRange(tail.start, tail.end);
      }
      return true;
    },
    [
      focusCursorRange,
      multiCursorActive,
      normalizedMultiCursorRanges,
      setTextContent,
      textContent,
    ],
  );

  const applyBlockSelection = useCallback(
    (anchor: number, focus: number) => {
      const ranges = buildBlockSelectionRanges(textContent, anchor, focus);
      if (!ranges.length) {
        return false;
      }
      blockSelectionStateRef.current = { anchor, focus };
      setMultiCursorRanges(ranges);
      const tail = ranges[ranges.length - 1];
      if (tail) {
        focusCursorRange(tail.start, tail.end);
      }
      return true;
    },
    [focusCursorRange, textContent],
  );

  const extendBlockSelectionByKey = useCallback(
    (
      key:
        | "ArrowLeft"
        | "ArrowRight"
        | "ArrowUp"
        | "ArrowDown"
        | "Home"
        | "End"
        | "PageUp"
        | "PageDown",
    ) => {
      const editor = textAreaRef.current;
      if (!editor) return false;
      let block = blockSelectionStateRef.current;
      if (!block) {
        const anchor = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
        block = { anchor, focus: anchor };
      }
      const pageLineStep = Math.max(
        1,
        Math.floor(editorClientHeight / Math.max(1, editorLineHeight)) - 1,
      );
      let nextFocus = block.focus;
      if (key === "ArrowLeft") {
        nextFocus = moveOffsetByVisualColumns(textContent, nextFocus, -1);
      } else if (key === "ArrowRight") {
        nextFocus = moveOffsetByVisualColumns(textContent, nextFocus, 1);
      } else if (key === "ArrowUp") {
        nextFocus = moveOffsetByLines(textContent, nextFocus, -1);
      } else if (key === "ArrowDown") {
        nextFocus = moveOffsetByLines(textContent, nextFocus, 1);
      } else if (key === "Home") {
        nextFocus = moveOffsetToLineBoundary(textContent, nextFocus, "start");
      } else if (key === "End") {
        nextFocus = moveOffsetToLineBoundary(textContent, nextFocus, "end");
      } else if (key === "PageUp") {
        nextFocus = moveOffsetByLines(textContent, nextFocus, -pageLineStep);
      } else {
        nextFocus = moveOffsetByLines(textContent, nextFocus, pageLineStep);
      }
      if (nextFocus === block.focus) {
        return false;
      }
      return applyBlockSelection(block.anchor, nextFocus);
    },
    [
      applyBlockSelection,
      editorClientHeight,
      editorLineHeight,
      textAreaRef,
      textContent,
    ],
  );

  const bracketMatch = useMemo(
    () =>
      findBracketMatchNearCaret(
        textContent,
        editorSelection.start,
        editorSelection.end,
        BRACKET_SCAN_DISTANCE,
      ),
    [editorSelection.end, editorSelection.start, textContent],
  );

  const handleTextAreaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === "F2") {
        event.preventDefault();
        toggleCurrentLineBookmark();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "F2") {
        event.preventDefault();
        if (event.shiftKey) {
          jumpPrevBookmark();
          return;
        }
        jumpNextBookmark();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key === "\\") {
        if (!bracketMatch) return;
        event.preventDefault();
        navigateToOffset(bracketMatch.matchOffset);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        popMultiCursor();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && event.altKey && event.shiftKey && event.key.toLowerCase() === "i") {
        event.preventDefault();
        addLineEndMultiCursors();
        return;
      }
      if (!event.ctrlKey && !event.metaKey && event.altKey && event.shiftKey) {
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "Home" ||
          event.key === "End" ||
          event.key === "PageUp" ||
          event.key === "PageDown"
        ) {
          const isArrowUpOrDown = event.key === "ArrowUp" || event.key === "ArrowDown";
          if (
            blockSelectionStateRef.current ||
            event.key === "ArrowLeft" ||
            event.key === "ArrowRight" ||
            event.key === "Home" ||
            event.key === "End" ||
            event.key === "PageUp" ||
            event.key === "PageDown"
          ) {
            event.preventDefault();
            void extendBlockSelectionByKey(
              event.key as
                | "ArrowLeft"
                | "ArrowRight"
                | "ArrowUp"
                | "ArrowDown"
                | "Home"
                | "End"
                | "PageUp"
                | "PageDown",
            );
            return;
          }
          if (isArrowUpOrDown && event.key === "ArrowUp") {
            event.preventDefault();
            addVerticalMultiCursors(-1);
            return;
          }
          if (isArrowUpOrDown) {
            event.preventDefault();
            addVerticalMultiCursors(1);
            return;
          }
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addAllMatchingMultiCursors();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        addNextMultiCursor();
        return;
      }
      if (event.key === "Escape" && multiCursorCount) {
        event.preventDefault();
        clearMultiCursors();
        return;
      }
      if (!multiCursorActive) return;
      if (event.nativeEvent.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        runMultiCursorEdit({ kind: "backspace" });
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        runMultiCursorEdit({ kind: "delete" });
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        runMultiCursorEdit({ kind: "insert", text: "\n" });
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        runMultiCursorEdit({ kind: "insert", text: "\t" });
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        runMultiCursorEdit({ kind: "insert", text: event.key });
      }
    },
    [
      addNextMultiCursor,
      addLineEndMultiCursors,
      addVerticalMultiCursors,
      addAllMatchingMultiCursors,
      clearMultiCursors,
      extendBlockSelectionByKey,
      jumpNextBookmark,
      jumpPrevBookmark,
      multiCursorActive,
      multiCursorCount,
      popMultiCursor,
      runMultiCursorEdit,
      bracketMatch,
      navigateToOffset,
      toggleCurrentLineBookmark,
    ],
  );

  const handleTextAreaPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!multiCursorActive) return;
      const text = event.clipboardData.getData("text");
      event.preventDefault();
      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (normalized.includes("\n")) {
        const lines = normalized.split("\n");
        if (lines.length > 1) {
          runMultiCursorEdit({ kind: "insert_per_range", texts: lines });
          return;
        }
      }
      runMultiCursorEdit({ kind: "insert", text: normalized });
    },
    [multiCursorActive, runMultiCursorEdit],
  );

  const handleTextAreaCopy = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!multiCursorActive || !hasBlockSelection || !blockSelectionClipboardText) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", blockSelectionClipboardText);
    },
    [blockSelectionClipboardText, hasBlockSelection, multiCursorActive],
  );

  const handleTextAreaCut = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      if (!multiCursorActive || !hasBlockSelection || !blockSelectionClipboardText) return;
      if (textReplaceRunning) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", blockSelectionClipboardText);
      runMultiCursorEdit({ kind: "delete" });
    },
    [
      blockSelectionClipboardText,
      hasBlockSelection,
      multiCursorActive,
      runMultiCursorEdit,
      textReplaceRunning,
    ],
  );

  const handleTextAreaScroll = useCallback(() => {
    const editor = textAreaRef.current;
    if (!editor) return;
    setEditorScrollTop(editor.scrollTop);
    setEditorScrollLeft(editor.scrollLeft);
  }, [textAreaRef]);

  const handleTextAreaSelectionChange = useCallback(() => {
    syncEditorSelection();
  }, [syncEditorSelection]);

  const handleTextAreaMouseDown = useCallback(
    (event: MouseEvent<HTMLTextAreaElement>) => {
      if (event.altKey) {
        blockSelectionStateRef.current = null;
        window.requestAnimationFrame(() => {
          const editor = textAreaRef.current;
          if (!editor) return;
          blockSelectionAnchorRef.current = Math.max(
            editor.selectionStart ?? 0,
            editor.selectionEnd ?? 0,
          );
        });
        return;
      }
      blockSelectionAnchorRef.current = null;
      if (!multiCursorCount) return;
      if (event.ctrlKey || event.metaKey) return;
      clearMultiCursors();
    },
    [clearMultiCursors, multiCursorCount, textAreaRef],
  );

  const handleTextAreaMouseMove = useCallback(
    (event: MouseEvent<HTMLTextAreaElement>) => {
      if (!event.altKey) return;
      const anchor = blockSelectionAnchorRef.current;
      if (anchor === null) return;
      const editor = textAreaRef.current;
      if (!editor) return;
      const focus = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
      if (focus === anchor) return;
      void applyBlockSelection(anchor, focus);
    },
    [applyBlockSelection, textAreaRef],
  );

  const handleTextAreaMouseUp = useCallback(() => {
    const anchor = blockSelectionAnchorRef.current;
    blockSelectionAnchorRef.current = null;
    if (anchor === null) return;
    const editor = textAreaRef.current;
    if (!editor) return;
    const focus = Math.max(editor.selectionStart ?? 0, editor.selectionEnd ?? 0);
    void applyBlockSelection(anchor, focus);
    syncEditorSelection();
  }, [applyBlockSelection, syncEditorSelection, textAreaRef]);

  const toggleSyntaxFoldStart = useCallback((lineIndex: number) => {
    setCollapsedFoldStarts((current) => {
      if (current.includes(lineIndex)) {
        return current.filter((item) => item !== lineIndex);
      }
      return [...current, lineIndex].sort((a, b) => a - b);
    });
  }, []);

  const collapseAllSyntaxFolds = useCallback(() => {
    setCollapsedFoldStarts(syntaxFoldStartLines);
  }, [syntaxFoldStartLines]);

  const expandAllSyntaxFolds = useCallback(() => {
    setCollapsedFoldStarts([]);
  }, []);

  const blockSelectionHighlights = useMemo(() => {
    if (!multiCursorCount) return [];
    const lineStarts = buildLineStarts(textContent);
    return normalizedMultiCursorRanges
      .slice(0, MAX_RENDERED_MULTI_CURSOR_MARKERS)
      .map((range, index) => {
        if (range.end <= range.start) return null;
        const startLineIndex = findLineIndexAtOffset(lineStarts, range.start);
        const endLineIndex = findLineIndexAtOffset(lineStarts, range.end);
        if (startLineIndex !== endLineIndex) {
          return null;
        }
        const lineStart = lineStarts[startLineIndex] ?? 0;
        const startColumn = measureVisualColumn(textContent, lineStart, range.start);
        const endColumn = measureVisualColumn(textContent, lineStart, range.end);
        const top = editorPaddingTop + startLineIndex * editorLineHeight - editorScrollTop;
        const left = editorPaddingLeft + startColumn * editorCharWidth - editorScrollLeft;
        const width = Math.max(2, (endColumn - startColumn) * editorCharWidth);
        const visible =
          top >= -editorLineHeight &&
          top <= editorClientHeight + editorLineHeight &&
          left + width >= -24 &&
          left <= editorClientWidth + 24;
        return {
          key: `block:${range.start}:${range.end}:${index}`,
          top,
          left,
          width,
          visible,
        };
      })
      .filter((item): item is { key: string; top: number; left: number; width: number; visible: boolean } =>
        Boolean(item?.visible),
      );
  }, [
    editorCharWidth,
    editorClientHeight,
    editorClientWidth,
    editorLineHeight,
    editorPaddingLeft,
    editorPaddingTop,
    editorScrollLeft,
    editorScrollTop,
    multiCursorCount,
    normalizedMultiCursorRanges,
    textContent,
  ]);

  const multiCursorMarkers = useMemo(() => {
    if (!multiCursorCount) return [];
    const lineStarts = buildLineStarts(textContent);
    return normalizedMultiCursorRanges
      .slice(0, MAX_RENDERED_MULTI_CURSOR_MARKERS)
      .map((range, index) => {
        const anchor = Math.max(range.start, range.end);
        const lineIndex = findLineIndexAtOffset(lineStarts, anchor);
        const lineStart = lineStarts[lineIndex] ?? 0;
        const visualColumn = measureVisualColumn(textContent, lineStart, anchor);
        const top = editorPaddingTop + lineIndex * editorLineHeight - editorScrollTop;
        const left = editorPaddingLeft + visualColumn * editorCharWidth - editorScrollLeft;
        const visible =
          top >= -editorLineHeight &&
          top <= editorClientHeight + editorLineHeight &&
          left >= -24 &&
          left <= editorClientWidth + 24;
        return {
          key: `${range.start}:${range.end}:${index}`,
          top,
          left,
          visible,
          active: index === multiCursorCount - 1,
        };
      })
      .filter((marker) => marker.visible);
  }, [
    editorCharWidth,
    editorClientHeight,
    editorClientWidth,
    editorLineHeight,
    editorPaddingLeft,
    editorPaddingTop,
    editorScrollLeft,
    editorScrollTop,
    multiCursorCount,
    normalizedMultiCursorRanges,
    textContent,
  ]);

  const bracketMatchHighlights = useMemo(() => {
    if (multiCursorActive) return [];
    if (editorSelection.start !== editorSelection.end) return [];
    if (!bracketMatch) return [];
    const lineStarts = buildLineStarts(textContent);
    const toRect = (offset: number, role: "anchor" | "pair") => {
      const lineIndex = findLineIndexAtOffset(lineStarts, offset);
      const lineStart = lineStarts[lineIndex] ?? 0;
      const visualColumn = measureVisualColumn(textContent, lineStart, offset);
      const top = editorPaddingTop + lineIndex * editorLineHeight - editorScrollTop;
      const left = editorPaddingLeft + visualColumn * editorCharWidth - editorScrollLeft;
      const visible =
        top >= -editorLineHeight &&
        top <= editorClientHeight + editorLineHeight &&
        left + editorCharWidth >= -24 &&
        left <= editorClientWidth + 24;
      return {
        key: `bracket-${role}-${offset}`,
        top,
        left,
        role,
        visible,
      };
    };
    return [
      toRect(bracketMatch.anchorOffset, "anchor"),
      toRect(bracketMatch.matchOffset, "pair"),
    ].filter((item) => item.visible);
  }, [
    bracketMatch,
    editorCharWidth,
    editorClientHeight,
    editorClientWidth,
    editorLineHeight,
    editorPaddingLeft,
    editorPaddingTop,
    editorScrollLeft,
    editorScrollTop,
    editorSelection.end,
    editorSelection.start,
    multiCursorActive,
    textContent,
  ]);

  return (
    <section className="surface text-mode-workspace">
      <div className="text-toolbar">
        <div className="text-meta">
          <span className="label">{t("Text file", "文本文件")}</span>
          <span className="value">{textPath ?? t("Select a file", "选择文件")}</span>
          {textDirty ? <span className="dirty">{t("(modified)", "(已修�?")}</span> : null}
        </div>
        <div className="text-actions">
          <label className="text-field">
            <span>{t("Encoding", "编码")}</span>
            <select
              value={textEncoding}
              onChange={(e) => setTextEncoding(e.target.value as "UTF-8" | "UTF-16LE")}
              disabled={textReadOnlyPreview}
            >
              <option value="UTF-8">UTF-8</option>
              <option value="UTF-16LE">UTF-16 LE</option>
            </select>
          </label>
          <button onClick={saveCurrent} disabled={textLoading || (!textDirty && Boolean(textPath))}>
            {t("Save", "保存")}
          </button>
          <button onClick={saveTextAs} disabled={textLoading}>
            {t("Save As", "另存�?")}
          </button>
          <div className="text-multi-cursor-tools">
            <button
              onClick={addNextMultiCursor}
              disabled={textLoading || textReplaceRunning || !textContent.length}
            >
              {t("Add cursor", "添加光标")}
            </button>
            <button
              onClick={addAllMatchingMultiCursors}
              disabled={textLoading || textReplaceRunning || !textContent.length}
            >
              {t("All matches", "全部匹配")}
            </button>
            <button
              onClick={addLineEndMultiCursors}
              disabled={textLoading || textReplaceRunning}
            >
              {t("Line cursors", "按行加光标")}
            </button>
            <button
              onClick={() => addVerticalMultiCursors(-1)}
              disabled={textLoading || textReplaceRunning}
            >
              {t("Cursor up", "上方光标")}
            </button>
            <button
              onClick={() => addVerticalMultiCursors(1)}
              disabled={textLoading || textReplaceRunning}
            >
              {t("Cursor down", "下方光标")}
            </button>
            <button onClick={popMultiCursor} disabled={!multiCursorCount}>
              {t("Undo cursor", "撤销光标")}
            </button>
            <button onClick={clearMultiCursors} disabled={!multiCursorCount}>
              {t("Clear cursors", "清除光标")}
            </button>
            {multiCursorCount ? (
              <span>
                {multiCursorActive
                  ? t(`${multiCursorCount} cursors`, `${multiCursorCount} 个光标`)
                  : t("single selection", "单选区")}
              </span>
            ) : null}
          </div>
          <div className="text-bookmark-tools">
            <button onClick={toggleCurrentLineBookmark} disabled={textLoading || textReplaceRunning}>
              {t("Toggle bookmark", "切换书签")}
            </button>
            <button onClick={openBookmarkImportDialog} disabled={textLoading}>
              {t("Import", "导入")}
            </button>
            <button onClick={handleBookmarkExport} disabled={textLoading || !bookmarkedLines.length}>
              {t("Export", "导出")}
            </button>
            <button onClick={jumpPrevBookmark} disabled={textLoading || !bookmarkedLines.length}>
              {t("Prev bookmark", "上一个书签")}
            </button>
            <button onClick={jumpNextBookmark} disabled={textLoading || !bookmarkedLines.length}>
              {t("Next bookmark", "下一个书签")}
            </button>
            {bookmarkedLines.length ? (
              <span>{t(`${bookmarkedLines.length} bookmarks`, `${bookmarkedLines.length} 个书签`)}</span>
            ) : null}
          </div>
          {bracketMatch ? (
            <span className="text-bracket-status">
              {t("Bracket", "括号")} {bracketMatch.anchorChar}
              {bracketMatch.matchChar} {bracketMatch.anchorOffset + 1}→
              {bracketMatch.matchOffset + 1} ·
              {t("Ctrl/Meta+Shift+\\ jump", "Ctrl/Meta+Shift+\\ 跳转")}
            </span>
          ) : null}
          {syntaxPreviewSupported ? (
            <div className="text-syntax-tools">
              <button
                onClick={() => setEnableInlineSyntax((current) => !current)}
                disabled={!inlineSyntaxAvailable || textLoading}
              >
                {showInlineSyntax
                  ? t("Inline off", "内联高亮关")
                  : t("Inline on", "内联高亮开")}
              </button>
              <button
                onClick={() => setShowSyntaxPreview((current) => !current)}
                disabled={textLoading}
              >
                {showSyntaxPreview
                  ? t("Hide syntax", "隐藏高亮")
                  : t("Show syntax", "显示高亮")}
              </button>
              <button
                onClick={() =>
                  setSyntaxPreviewEngine((current) =>
                    current === "native" ? "light" : "native",
                  )
                }
                disabled={textLoading}
              >
                {syntaxPreviewEngine === "native"
                  ? t("Engine: Native", "引擎: 原生")
                  : t("Engine: Light", "引擎: 轻量")}
              </button>
              <span>{t(`Lang: ${syntaxLanguage}`, `语言: ${syntaxLanguage}`)}</span>
              {inlineSyntaxTooLarge ? (
                <span>
                  {t(
                    `Inline disabled over ${MAX_INLINE_SYNTAX_CHARS} chars`,
                    `超过 ${MAX_INLINE_SYNTAX_CHARS} 字符时禁用内联高亮`,
                  )}
                </span>
              ) : null}
            </div>
          ) : null}
          <input
            ref={bookmarkImportInputRef}
            className="text-bookmark-import-input"
            type="file"
            accept=".json,application/json,text/json"
            onChange={handleBookmarkImportFileChange}
          />
          {bookmarkNotice ? <span className="text-bookmark-notice-inline">{bookmarkNotice}</span> : null}
          <label className="text-jump">
            <span>{t("Go line:col", "转到行列")}</span>
            <input
              value={gotoLineColumnInput}
              onChange={(event) => setGotoLineColumnInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                jumpToLineColumn();
              }}
              disabled={textLoading || textReplaceRunning}
              placeholder={t("e.g. 120:8", "例如 120:8")}
            />
          </label>
          <button
            onClick={jumpToLineColumn}
            disabled={textLoading || textReplaceRunning || !gotoLineColumnInput.trim()}
          >
            {t("Go LC", "跳转")}
          </button>
          {textReadOnlyPreview ? (
            <div className="text-preview-nav">
              <button
                onClick={() => void loadPrevTextPreviewChunk()}
                disabled={textLoading || textReplaceRunning || !textPreviewHasPrev}
              >
                {t("Prev chunk", "上一�?")}
              </button>
              <button
                onClick={() => void loadNextTextPreviewChunk()}
                disabled={textLoading || textReplaceRunning || !textPreviewHasNext}
              >
                {t("Next chunk", "下一�?")}
              </button>
              <label className="text-jump">
                <span>{t("Offset", "偏移")}</span>
                <input
                  value={textChunkJumpInput}
                  onChange={(event) => setTextChunkJumpInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void jumpToTextChunk();
                  }}
                  inputMode="numeric"
                  disabled={textLoading || textReplaceRunning}
                />
              </label>
              <button
                onClick={() => void jumpToTextChunk()}
                disabled={textLoading || textReplaceRunning || textTotalBytes === null}
              >
                {t("Go", "跳转")}
              </button>
              <label className="text-find">
                <span>{t("Find", "查找")}</span>
                <input
                  value={textFindQuery}
                  onChange={(event) => setTextFindQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void runTextFind();
                  }}
                  disabled={textLoading || textFindRunning || textReplaceRunning}
                  placeholder={t("text", "文本")}
                />
              </label>
              <label className="text-find">
                <span>{t("Replace", "替换")}</span>
                <input
                  value={textReplaceValue}
                  onChange={(event) => setTextReplaceValue(event.target.value)}
                  disabled={textLoading || textFindRunning || textReplaceRunning}
                  placeholder={t("replacement", "替换文本")}
                />
              </label>
              <label className="text-find-check">
                <input
                  type="checkbox"
                  checked={textFindUseRegex}
                  onChange={(event) => setTextFindUseRegex(event.target.checked)}
                  disabled={textLoading || textFindRunning || textReplaceRunning}
                />
                <span>{t("Regex", "正则")}</span>
              </label>
              <label className="text-find-check">
                <input
                  type="checkbox"
                  checked={textFindMatchCase}
                  onChange={(event) => setTextFindMatchCase(event.target.checked)}
                  disabled={textLoading || textFindRunning || textReplaceRunning}
                />
                <span>{t("Case", "区分大小�?")}</span>
              </label>
              <label className="text-find-check">
                <input
                  type="checkbox"
                  checked={textReplacePreserveCase}
                  onChange={(event) => setTextReplacePreserveCase(event.target.checked)}
                  disabled={
                    textLoading ||
                    textFindRunning ||
                    textReplaceRunning ||
                    textFindUseRegex
                  }
                />
                <span>{t("Preserve case", "保留大小写")}</span>
              </label>
              <label className="text-find-check">
                <input
                  type="checkbox"
                  checked={textReplaceConfirmEach}
                  onChange={(event) => setTextReplaceConfirmEach(event.target.checked)}
                  disabled={textLoading || textFindRunning || textReplaceRunning}
                />
                <span>{t("Confirm each", "逐条确认")}</span>
              </label>
              <button
                onClick={() => void runTextFind()}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textFindQuery.trim()
                }
              >
                {t("Find", "查找")}
              </button>
              <button
                onClick={() => runTextReplaceInChunk(false)}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textFindQuery.trim()
                }
              >
                {t("Replace", "替换")}
              </button>
              <button
                onClick={runTextReplaceNext}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textFindQuery.trim()
                }
              >
                {textReplaceConfirmEach
                  ? t("Preview next", "预览下一条")
                  : t("Replace next", "替换下一条")}
              </button>
              <button
                onClick={runTextReplaceConfirmNext}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textReplaceHasPendingConfirm
                }
              >
                {t("Confirm replace", "确认替换")}
              </button>
              <button
                onClick={() => runTextReplaceInChunk(true)}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  textReplaceConfirmEach ||
                  !textFindQuery.trim()
                }
              >
                {t("Replace all", "全部替换")}
              </button>
              <button
                onClick={() => runTextReplaceInSelection(true)}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textFindQuery.trim()
                }
              >
                {t("Replace in selection", "替换选区")}
              </button>
              <button
                onClick={() => void runTextReplaceInFile()}
                disabled={
                  textLoading ||
                  textFindRunning ||
                  textReplaceRunning ||
                  !textFindQuery.trim()
                }
              >
                {t("Replace all (file)", "全文件替�?")}
              </button>
              <button
                onClick={jumpTextFindPrev}
                disabled={textLoading || textReplaceRunning || !textFindHitsLength}
              >
                {t("Prev hit", "上一个命�?")}
              </button>
              <button
                onClick={jumpTextFindNext}
                disabled={textLoading || textReplaceRunning || !textFindHitsLength}
              >
                {t("Next hit", "下一个命�?")}
              </button>
              <button
                onClick={() => {
                  if (textReplaceRunning) {
                    void cancelTextReplaceJobInternal(true);
                    return;
                  }
                  void cancelTextFindJobInternal(true);
                }}
                disabled={!textFindRunning && !textReplaceRunning}
              >
                {t("Cancel", "取消")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {multiCursorCount ? (
        <div className="text-multi-cursor-status">
          <span className="label">
            {t(
              `Multi-cursor active (${multiCursorCount})`,
              `多光标已启用（${multiCursorCount}）`,
            )}
          </span>
          <span className="hint">{t("Ctrl/Meta+D next", "Ctrl/Meta+D 下一处")}</span>
          <span className="hint">{t("Ctrl/Meta+Shift+L all", "Ctrl/Meta+Shift+L 全部")}</span>
          <span className="hint">{t("Ctrl/Meta+Shift+D undo", "Ctrl/Meta+Shift+D 撤销")}</span>
          <span className="hint">{t("Alt+Shift+I line ends", "Alt+Shift+I 行尾光标")}</span>
          <span className="hint">{t("Alt+Shift+Up/Down vertical", "Alt+Shift+上下 垂直加光标")}</span>
          <span className="hint">{t("Alt+drag block", "Alt+拖拽 列块选区")}</span>
          <span className="hint">{t("F2 next / Shift+F2 prev bookmark", "F2下一个 / Shift+F2上一个书签")}</span>
          <span className="hint">{t("Ctrl/Meta+F2 toggle bookmark", "Ctrl/Meta+F2 切换书签")}</span>
          <span className="hint">{t("Go/Bookmark keeps block selection", "跳转时保持列块选区")}</span>
          {hasBlockSelection ? (
            <span className="hint">
              {t(
                "Alt+Shift+Arrows/Home/End/Page extend block",
                "Alt+Shift+方向/Home/End/Page 扩展列块",
              )}
            </span>
          ) : null}
          {hasBlockSelection ? (
            <span className="hint">
              {t("Ctrl/Meta+C/X block copy-cut", "Ctrl/Meta+C/X 列块复制剪切")}
            </span>
          ) : null}
          <span className="hint">{t("Esc clear", "Esc 清空")}</span>
          <div className="positions">
            {multiCursorPreview.map((item) => (
              <code key={item.id}>{item.text}</code>
            ))}
            {multiCursorCount > multiCursorPreview.length ? (
              <span>{t(`+${multiCursorCount - multiCursorPreview.length} more`, `另有 ${multiCursorCount - multiCursorPreview.length} 个`)}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {bookmarkItems.length ? (
        <div className="text-bookmark-panel">
          <div className="text-bookmark-panel-head">
            <strong>{t("Bookmarks", "书签")}</strong>
            <span>{t(`${bookmarkItems.length} entries`, `${bookmarkItems.length} 项`)}</span>
            <button onClick={handleBookmarkExport}>{t("Export", "导出")}</button>
            <button onClick={openBookmarkImportDialog}>{t("Import", "导入")}</button>
            <button onClick={clearAllBookmarks}>{t("Clear all", "清空书签")}</button>
          </div>
          <label className="text-bookmark-filter">
            <span>{t("Filter", "筛选")}</span>
            <input
              value={bookmarkFilterInput}
              onChange={(event) => setBookmarkFilterInput(event.target.value)}
              placeholder={t("line or text", "行号或文本")}
            />
          </label>
          <div className="text-bookmark-panel-list">
            {filteredBookmarkItems.map((item) => (
              <div
                key={`bookmark-${item.lineIndex}`}
                className={`text-bookmark-item${item.lineIndex === currentCaretLineIndex ? " active" : ""}`}
              >
                <button
                  className="text-bookmark-jump"
                  onClick={() => jumpToBookmarkLine(item.lineIndex)}
                >
                  <span className="line">#{item.lineNumber}</span>
                  <span className="preview">{item.preview || t("(empty line)", "(空行)")}</span>
                </button>
                <button
                  className="text-bookmark-remove"
                  onClick={() => removeBookmarkLine(item.lineIndex)}
                >
                  {t("Remove", "移除")}
                </button>
              </div>
            ))}
            {!filteredBookmarkItems.length ? (
              <div className="text-bookmark-empty">{t("No bookmark matches.", "没有匹配的书签。")}</div>
            ) : null}
          </div>
          {bookmarkNotice ? (
            <div className="text-bookmark-notice">{bookmarkNotice}</div>
          ) : null}
        </div>
      ) : null}
      {textReadOnlyPreview ? (
        <div className="text-readonly-banner">
          {t(
            `Large file chunk mode: showing ${formatByteSize(textPreviewOffset)} - ${formatByteSize(textPreviewOffset + (textPreviewBytes ?? 0))} of ${formatByteSize(textTotalBytes)} (chunk ${formatByteSize(largeTextPreviewBytes)}). Edits and Save apply to the current chunk; navigating chunks auto-saves current edits.`,
            `Large file chunk mode: showing ${formatByteSize(textPreviewOffset)} - ${formatByteSize(textPreviewOffset + (textPreviewBytes ?? 0))} of ${formatByteSize(textTotalBytes)} (chunk ${formatByteSize(largeTextPreviewBytes)}). Edits and Save apply to the current chunk; navigating chunks auto-saves current edits.`,
          )}
          {" "}
          {t(
            `Auto preview threshold: ${formatByteSize(largeTextFileThresholdBytes)}.`,
            `Auto preview threshold: ${formatByteSize(largeTextFileThresholdBytes)}.`,
          )}
          {" "}
          {textReplaceRunning
            ? t(
                `Replacing... ${Math.round(textReplaceProgress * 100)}%`,
                `替换�?.. ${Math.round(textReplaceProgress * 100)}%`,
              )
            : textReplaceAppliedCount !== null
              ? t(
                  `Replaced: ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                  `替换�?{textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                )
              : textFindRunning
                ? t(
                    `Finding... ${Math.round(textFindProgress * 100)}%`,
                    `查找�?.. ${Math.round(textFindProgress * 100)}%`,
                  )
                : textFindMatchedCount !== null
                  ? t(
                      `Hits: ${textFindMatchedCount}${textFindHasMore ? "+" : ""}${
                        textFindHitsLength
                          ? `, current ${activeTextFindIndex + 1}/${textFindHitsLength}`
                          : ""
                      }`,
                      `Hits: ${textFindMatchedCount}${textFindHasMore ? "+" : ""}${
                        textFindHitsLength
                          ? `, current ${activeTextFindIndex + 1}/${textFindHitsLength}`
                          : ""
                      }`,
                    )
                  : null}
        </div>
      ) : null}
      {findResultsPanel}
      {showSyntaxPreview && syntaxPreviewSupported ? (
        <section className="text-syntax-preview">
          <div className="text-syntax-preview-head">
            <strong>{t("Syntax Preview", "语法高亮预览")}</strong>
            <span>{t(`Language: ${syntaxLanguage}`, `语言: ${syntaxLanguage}`)}</span>
            {syntaxPreviewEngine === "light" && syntaxFoldStartLines.length ? (
              <>
                <button onClick={collapseAllSyntaxFolds}>
                  {t("Collapse all", "全部折叠")}
                </button>
                <button onClick={expandAllSyntaxFolds}>
                  {t("Expand all", "全部展开")}
                </button>
                <span>
                  {t(
                    `${syntaxFoldStartLines.length} fold blocks`,
                    `${syntaxFoldStartLines.length} 个可折叠块`,
                  )}
                </span>
              </>
            ) : null}
            {syntaxPreviewEngine === "native" ? (
              <span>{t("Native fold: use gutter arrows", "原生折叠：使用左侧箭头")}</span>
            ) : null}
            {syntaxPreviewTooLarge ? (
              <span>
                {t(
                  `Truncated to ${MAX_SYNTAX_PREVIEW_CHARS} chars for memory safety.`,
                  `为控制内存，已截断为 ${MAX_SYNTAX_PREVIEW_CHARS} 字符。`,
                )}
              </span>
            ) : null}
          </div>
          {syntaxPreviewEngine === "native" ? (
            <Suspense
              fallback={
                <div className="text-syntax-preview-loading">
                  {t("Loading native syntax engine...", "正在加载原生语法引擎...")}
                </div>
              }
            >
              <CodeMirrorPreview
                className="text-syntax-preview-cm"
                value={syntaxPreviewContent}
                language={syntaxLanguage}
                activeLine={currentCaretLineIndex}
                onLineClick={jumpToLineIndex}
              />
            </Suspense>
          ) : (
            <div className="text-syntax-preview-body">
              {syntaxPreviewRenderedRows.map((row) => {
                if (row.kind === "collapsed") {
                  const collapsedActive =
                    currentCaretLineIndex > row.lineIndex &&
                    currentCaretLineIndex <= row.lineIndex + row.hiddenLines;
                  return (
                    <div
                      key={`collapsed-${row.lineIndex}`}
                      className={`text-syntax-fold-placeholder${collapsedActive ? " active" : ""}`}
                    >
                      <span>...</span>
                      <span>
                        {t(
                          `${row.hiddenLines} lines hidden`,
                          `已折叠 ${row.hiddenLines} 行`,
                        )}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`line-${row.lineIndex}`}
                    className={`text-syntax-line${row.lineIndex === currentCaretLineIndex ? " active" : ""}`}
                  >
                    {row.foldRange ? (
                      <button
                        className="text-syntax-fold-toggle"
                        onClick={() => toggleSyntaxFoldStart(row.lineIndex)}
                        title={
                          row.collapsed
                            ? t("Expand block", "展开代码块")
                            : t("Collapse block", "折叠代码块")
                        }
                      >
                        {row.collapsed ? "▸" : "▾"}
                      </button>
                    ) : (
                      <span className="text-syntax-fold-gap" />
                    )}
                    <button
                      className="text-syntax-line-number"
                      onClick={() => jumpToLineIndex(row.lineIndex)}
                      title={t("Jump to line", "跳转到该行")}
                    >
                      {row.lineIndex + 1}
                    </button>
                    <code
                      className="text-syntax-line-code"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: row.html }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
      <div className="text-area-shell">
        {showInlineSyntax ? (
          <div className="text-syntax-inline" aria-hidden="true">
            <pre
              className="text-syntax-inline-code"
              style={{
                transform: `translate(${-editorScrollLeft}px, ${-editorScrollTop}px)`,
              }}
            >
              <code
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: inlineSyntaxHtml }}
              />
            </pre>
          </div>
        ) : null}
        <textarea
          ref={textAreaRef}
          className={`text-area${textReadOnlyPreview ? " chunked" : ""}${showInlineSyntax ? " syntax-overlay" : ""}`}
          value={textContent}
          onChange={(event) => setTextContent(event.target.value)}
          onKeyDown={handleTextAreaKeyDown}
          onPaste={handleTextAreaPaste}
          onCopy={handleTextAreaCopy}
          onCut={handleTextAreaCut}
          onScroll={handleTextAreaScroll}
          onMouseDown={handleTextAreaMouseDown}
          onMouseMove={handleTextAreaMouseMove}
          onMouseUp={handleTextAreaMouseUp}
          onSelect={handleTextAreaSelectionChange}
          onKeyUp={handleTextAreaSelectionChange}
          onClick={handleTextAreaSelectionChange}
          placeholder={t("Open a text file to start editing", "打开文本文件开始编�?")}
          spellCheck={false}
          readOnly={textReplaceRunning}
        />
        {multiCursorCount || bracketMatchHighlights.length ? (
          <div className="text-multi-cursor-overlay" aria-hidden="true">
            {bracketMatchHighlights.map((item) => (
              <span
                key={item.key}
                className={`text-bracket-match${item.role === "anchor" ? " anchor" : " pair"}`}
                style={{
                  left: `${item.left}px`,
                  top: `${item.top}px`,
                  width: `${Math.max(editorCharWidth, 8)}px`,
                  height: `${Math.max(12, editorLineHeight - 1)}px`,
                }}
              />
            ))}
            {blockSelectionHighlights.map((item) => (
              <span
                key={item.key}
                className="text-multi-cursor-block"
                style={{
                  left: `${item.left}px`,
                  top: `${item.top}px`,
                  width: `${item.width}px`,
                  height: `${Math.max(12, editorLineHeight - 1)}px`,
                }}
              />
            ))}
            {multiCursorMarkers.map((marker) => (
              <span
                key={marker.key}
                className={`text-multi-cursor-marker${marker.active ? " active" : ""}`}
                style={{
                  left: `${marker.left}px`,
                  top: `${marker.top}px`,
                  height: `${Math.max(12, editorLineHeight - 1)}px`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}
