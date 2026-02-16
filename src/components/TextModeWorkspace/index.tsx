import {
  Suspense,
  useDeferredValue,
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
import {
  MAX_WHITESPACE_PREVIEW_CHARS,
  analyzeTextWhitespace,
  buildWhitespaceVisiblePreview,
  convertTextEol,
  detectTextEolMode,
  trimTrailingWhitespace,
  type TextEolTarget,
} from "../../utils/textEol";
import {
  buildLineDiffModel,
  joinDiffLines,
  splitTextToDiffLines,
  type LineDiffBlock,
} from "../../utils/textDiff";
import {
  buildDocumentStructureItems,
  buildTextMinimapSegments,
} from "../../utils/textMinimap";
import {
  buildMarkdownPreviewBlocks,
  isMarkdownPath,
  type MarkdownPreviewBlock,
} from "../../utils/markdownPreview";
import { renderMarkdownBlockHtml } from "../../utils/markdownRender";
import {
  buildHexApplyRanges,
  isPrintableAscii,
  parseHexByte,
  toHexByte,
} from "../../utils/textHex";
import {
  confirmDialog,
  invokeCmd,
  messageDialog,
  openFileDialog,
  readBinaryFile,
  statFile,
} from "../../tauriBridge";
import {
  createTextExtensionRuntime,
  TEXT_EXTENSION_PERMISSION_VALUES,
  type TextExtensionHost,
  type TextExtensionPermission,
  type TextExtensionSelection,
} from "../../utils/textExtensionRuntime";
import type { TextEncoding } from "../../types";
import type { TextModeWorkspaceProps } from "./types";
import "./styles.css";

const MAX_RENDERED_MULTI_CURSOR_MARKERS = 128;
const BOOKMARK_STORAGE_KEY_PREFIX = "text-bookmarks:v1:";
const BRACKET_SCAN_DISTANCE = 500_000;
const MAX_SYNTAX_PREVIEW_CHARS = 250_000;
const MAX_INLINE_SYNTAX_CHARS = 120_000;
const MAX_DIFF_PREVIEW_BLOCKS = 120;
const DIFF_MAX_COMPARE_BYTES = 8 * 1024 * 1024;
const MAX_MINIMAP_SEGMENTS = 320;
const MAX_STRUCTURE_ITEMS = 400;
const HEX_WINDOW_BYTES = 1024;
const HEX_BYTES_PER_ROW = 16;
const MAX_MARKDOWN_PREVIEW_CHARS = 300_000;
const EXTENSION_SCRIPT_MAX_BYTES = 1024 * 1024;
const CodeMirrorPreview = lazy(() => import("../CodeMirrorPreview"));

const buildDefaultExtensionPermissionState = (): Record<TextExtensionPermission, boolean> => {
  const state = {} as Record<TextExtensionPermission, boolean>;
  for (const permission of TEXT_EXTENSION_PERMISSION_VALUES) {
    state[permission] = true;
  }
  return state;
};

type CommandPaletteItem = {
  id: string;
  title: string;
  description: string;
  shortcut: string;
  keywords: string;
  disabled: boolean;
  run: () => void | Promise<void>;
};

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
  const [markdownSourceMode, setMarkdownSourceMode] = useState(false);
  const [syntaxPreviewEngine, setSyntaxPreviewEngine] = useState<"native" | "light">("native");
  const [enableInlineSyntax, setEnableInlineSyntax] = useState(false);
  const [enableNativeSyntaxEdit, setEnableNativeSyntaxEdit] = useState(false);
  const [nativeFocusVersion, setNativeFocusVersion] = useState(0);
  const [collapsedFoldStarts, setCollapsedFoldStarts] = useState<number[]>([]);
  const [gotoLineColumnInput, setGotoLineColumnInput] = useState("");
  const [bookmarkFilterInput, setBookmarkFilterInput] = useState("");
  const [bookmarkNotice, setBookmarkNotice] = useState("");
  const [bookmarkedLines, setBookmarkedLines] = useState<number[]>([]);
  const [showWhitespacePreview, setShowWhitespacePreview] = useState(false);
  const [targetEolMode, setTargetEolMode] = useState<TextEolTarget>("LF");
  const [showDocMapPanel, setShowDocMapPanel] = useState(false);
  const [structureFilterInput, setStructureFilterInput] = useState("");
  const [showDiffMergePanel, setShowDiffMergePanel] = useState(false);
  const [diffComparePath, setDiffComparePath] = useState<string | null>(null);
  const [diffCompareContent, setDiffCompareContent] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffNotice, setDiffNotice] = useState("");
  const [showHexPanel, setShowHexPanel] = useState(false);
  const [hexLoading, setHexLoading] = useState(false);
  const [hexNotice, setHexNotice] = useState("");
  const [hexBaseOffset, setHexBaseOffset] = useState(0);
  const [hexOffsetInput, setHexOffsetInput] = useState("0");
  const [hexWindowBytes, setHexWindowBytes] = useState<Uint8Array>(new Uint8Array());
  const [hexTotalBytes, setHexTotalBytes] = useState<number | null>(null);
  const [hexSelectedIndex, setHexSelectedIndex] = useState<number | null>(null);
  const [hexEditInput, setHexEditInput] = useState("");
  const [hexEdits, setHexEdits] = useState<Record<number, number>>({});
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionRunning, setExtensionRunning] = useState(false);
  const [extensionNotice, setExtensionNotice] = useState("");
  const [extensionSourceId, setExtensionSourceId] = useState<string | null>(null);
  const [extensionCommands, setExtensionCommands] = useState<
    Array<{
      id: string;
      title: string;
      description: string;
      permissions: TextExtensionPermission[];
      sourceId: string;
    }>
  >([]);
  const [activeExtensionCommandId, setActiveExtensionCommandId] = useState("");
  const [extensionPermissionGrants, setExtensionPermissionGrants] = useState<
    Record<TextExtensionPermission, boolean>
  >(buildDefaultExtensionPermissionState);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [commandPaletteActiveIndex, setCommandPaletteActiveIndex] = useState(0);
  const bookmarkImportInputRef = useRef<HTMLInputElement | null>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);
  const blockSelectionAnchorRef = useRef<number | null>(null);
  const blockSelectionStateRef = useRef<{ anchor: number; focus: number } | null>(null);
  const extensionHostRef = useRef<TextExtensionHost | null>(null);
  const extensionRuntimeRef = useRef(
    createTextExtensionRuntime(() => {
      const host = extensionHostRef.current;
      if (!host) {
        throw new Error("Extension host is not ready.");
      }
      return host;
    }),
  );
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
  const markdownPathActive = useMemo(() => isMarkdownPath(textPath), [textPath]);
  const markdownRenderedActive = markdownPathActive && !markdownSourceMode;
  const syntaxPreviewSupported = syntaxLanguage !== "plain";
  const inlineSyntaxTooLarge = textContent.length > MAX_INLINE_SYNTAX_CHARS;
  const syntaxPreviewTooLarge = textContent.length > MAX_SYNTAX_PREVIEW_CHARS;
  const inlineSyntaxAvailable =
    syntaxPreviewSupported && !inlineSyntaxTooLarge && !textReadOnlyPreview;
  const nativeSyntaxEditAvailable =
    syntaxPreviewSupported &&
    syntaxPreviewEngine === "native" &&
    !textReadOnlyPreview &&
    !syntaxPreviewTooLarge;
  const nativeSyntaxEditEnabled = nativeSyntaxEditAvailable && enableNativeSyntaxEdit;
  const showInlineSyntax =
    enableInlineSyntax &&
    inlineSyntaxAvailable &&
    textContent.length > 0 &&
    !nativeSyntaxEditEnabled;
  const inlineSyntaxHtml = useMemo(() => {
    if (!showInlineSyntax) return "";
    return renderSyntaxHighlightedHtml(textContent, syntaxLanguage);
  }, [showInlineSyntax, syntaxLanguage, textContent]);
  const syntaxPreviewContent = useMemo(() => {
    if (!syntaxPreviewTooLarge) return textContent;
    return textContent.slice(0, MAX_SYNTAX_PREVIEW_CHARS);
  }, [syntaxPreviewTooLarge, textContent]);
  const markdownPreviewTooLarge = textContent.length > MAX_MARKDOWN_PREVIEW_CHARS;
  const markdownPreviewContent = useMemo(() => {
    if (!markdownPreviewTooLarge) return textContent;
    return textContent.slice(0, MAX_MARKDOWN_PREVIEW_CHARS);
  }, [markdownPreviewTooLarge, textContent]);
  const deferredMarkdownPreviewContent = useDeferredValue(markdownPreviewContent);
  const markdownPreviewBlocks = useMemo(
    () => buildMarkdownPreviewBlocks(deferredMarkdownPreviewContent, 600),
    [deferredMarkdownPreviewContent],
  );
  const markdownPreviewDeferred = deferredMarkdownPreviewContent !== markdownPreviewContent;
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
  const whitespaceStats = useMemo(
    () => analyzeTextWhitespace(textContent),
    [textContent],
  );
  const textEolMode = useMemo(() => detectTextEolMode(textContent), [textContent]);
  const whitespacePreview = useMemo(() => {
    if (!showWhitespacePreview) return null;
    return buildWhitespaceVisiblePreview(textContent, MAX_WHITESPACE_PREVIEW_CHARS);
  }, [showWhitespacePreview, textContent]);
  const eolModeLabel = useMemo(() => {
    if (textEolMode === "CRLF") return "CRLF";
    if (textEolMode === "LF") return "LF";
    if (textEolMode === "MIXED") return t("Mixed", "混合");
    return t("None", "无");
  }, [t, textEolMode]);
  const diffModel = useMemo(
    () => buildLineDiffModel(textContent, diffCompareContent),
    [diffCompareContent, textContent],
  );
  const visibleDiffBlocks = useMemo(
    () => diffModel.blocks.slice(0, MAX_DIFF_PREVIEW_BLOCKS),
    [diffModel.blocks],
  );
  const lineCount = useMemo(
    () => Math.max(1, textContent.split("\n").length),
    [textContent],
  );
  const minimapSegments = useMemo(
    () => buildTextMinimapSegments(textContent, MAX_MINIMAP_SEGMENTS),
    [textContent],
  );
  const structureItems = useMemo(
    () => buildDocumentStructureItems(textContent, syntaxLanguage, MAX_STRUCTURE_ITEMS),
    [syntaxLanguage, textContent],
  );
  const currentCaretLineIndexForMap = useMemo(() => {
    const starts = buildLineStarts(textContent);
    const offset = Math.max(editorSelection.start, editorSelection.end);
    return findLineIndexAtOffset(starts, offset);
  }, [editorSelection.end, editorSelection.start, textContent]);
  const filteredStructureItems = useMemo(() => {
    const query = structureFilterInput.trim().toLowerCase();
    if (!query) return structureItems;
    return structureItems.filter((item) => {
      if (String(item.lineNumber).includes(query)) return true;
      return item.label.toLowerCase().includes(query);
    });
  }, [structureFilterInput, structureItems]);
  const activeStructureLine = useMemo(() => {
    let active = -1;
    for (const item of structureItems) {
      if (item.lineIndex <= currentCaretLineIndexForMap) {
        active = item.lineIndex;
        continue;
      }
      break;
    }
    return active;
  }, [currentCaretLineIndexForMap, structureItems]);
  const visibleStartLine = useMemo(
    () => Math.max(0, Math.floor(editorScrollTop / Math.max(editorLineHeight, 1))),
    [editorLineHeight, editorScrollTop],
  );
  const visibleLineSpan = useMemo(
    () => Math.max(1, Math.ceil(editorClientHeight / Math.max(editorLineHeight, 1))),
    [editorClientHeight, editorLineHeight],
  );
  const visibleEndLine = useMemo(
    () => Math.min(lineCount - 1, visibleStartLine + visibleLineSpan - 1),
    [lineCount, visibleLineSpan, visibleStartLine],
  );
  const minimapViewportTopPct = useMemo(
    () => (visibleStartLine / Math.max(1, lineCount)) * 100,
    [lineCount, visibleStartLine],
  );
  const minimapViewportHeightPct = useMemo(
    () => Math.max((visibleLineSpan / Math.max(1, lineCount)) * 100, 2),
    [lineCount, visibleLineSpan],
  );
  const minimapCaretTopPct = useMemo(
    () =>
      ((Math.min(Math.max(currentCaretLineIndexForMap, 0), lineCount - 1) + 0.5) /
        Math.max(1, lineCount)) *
      100,
    [currentCaretLineIndexForMap, lineCount],
  );
  const activeMarkdownBlockIndex = useMemo(() => {
    if (!markdownPreviewBlocks.length) return -1;
    for (let index = 0; index < markdownPreviewBlocks.length; index += 1) {
      const block = markdownPreviewBlocks[index];
      const nextLine =
        index + 1 < markdownPreviewBlocks.length
          ? markdownPreviewBlocks[index + 1]?.lineIndex ?? lineCount
          : lineCount;
      if (
        currentCaretLineIndexForMap >= block.lineIndex &&
        currentCaretLineIndexForMap < nextLine
      ) {
        return index;
      }
    }
    return -1;
  }, [currentCaretLineIndexForMap, lineCount, markdownPreviewBlocks]);
  const hexEditedCount = useMemo(() => Object.keys(hexEdits).length, [hexEdits]);
  const hexRows = useMemo(() => {
    const rows: Array<{
      rowOffset: number;
      values: Array<{ index: number; value: number; edited: boolean }>;
      ascii: string;
    }> = [];
    for (let rowStart = 0; rowStart < hexWindowBytes.length; rowStart += HEX_BYTES_PER_ROW) {
      const values: Array<{ index: number; value: number; edited: boolean }> = [];
      let ascii = "";
      for (let col = 0; col < HEX_BYTES_PER_ROW; col += 1) {
        const index = rowStart + col;
        if (index >= hexWindowBytes.length) break;
        const editedValue = Object.prototype.hasOwnProperty.call(hexEdits, index)
          ? hexEdits[index]
          : null;
        const value = editedValue ?? hexWindowBytes[index];
        const edited = editedValue !== null;
        values.push({ index, value, edited });
        ascii += isPrintableAscii(value) ? String.fromCharCode(value) : ".";
      }
      rows.push({
        rowOffset: rowStart,
        values,
        ascii,
      });
    }
    return rows;
  }, [hexEdits, hexWindowBytes]);
  const selectedExtensionCommand = useMemo(
    () =>
      extensionCommands.find((command) => command.id === activeExtensionCommandId) ?? null,
    [activeExtensionCommandId, extensionCommands],
  );
  const selectedExtensionPermissions = useMemo(
    () => selectedExtensionCommand?.permissions ?? [],
    [selectedExtensionCommand],
  );
  const selectedExtensionMissingPermissions = useMemo(
    () =>
      selectedExtensionPermissions.filter((permission) => !extensionPermissionGrants[permission]),
    [extensionPermissionGrants, selectedExtensionPermissions],
  );

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

  const syncShadowTextSelection = useCallback(
    (start: number, end: number) => {
      const editor = textAreaRef.current;
      if (!editor) return;
      const safeStart = Math.max(0, Math.min(start, textContent.length));
      const safeEnd = Math.max(0, Math.min(end, textContent.length));
      if (editor.selectionStart === safeStart && editor.selectionEnd === safeEnd) return;
      try {
        editor.setSelectionRange(safeStart, safeEnd);
      } catch {
        // Ignore hidden/readonly selection sync errors.
      }
    },
    [textAreaRef, textContent.length],
  );

  const handleNativeSelectionChange = useCallback(
    (
      start: number,
      end: number,
      ranges: Array<{ start: number; end: number }>,
    ) => {
      const safeStart = Math.max(0, Math.min(start, textContent.length));
      const safeEnd = Math.max(0, Math.min(end, textContent.length));
      const normalizedNativeRanges = normalizeRanges(
        ranges.map((range) => ({
          start: Math.max(0, Math.min(range.start, textContent.length)),
          end: Math.max(0, Math.min(range.end, textContent.length)),
        })),
      );
      const nextMultiCursorRanges =
        normalizedNativeRanges.length > 1 ? normalizedNativeRanges : [];
      const hasNativeBlockSelection = nextMultiCursorRanges.some(
        (range) => range.end > range.start,
      );
      if (hasNativeBlockSelection) {
        const first = nextMultiCursorRanges[0];
        const last = nextMultiCursorRanges[nextMultiCursorRanges.length - 1];
        if (first && last) {
          blockSelectionStateRef.current = {
            anchor: first.start,
            focus: last.end,
          };
        }
      } else {
        blockSelectionStateRef.current = null;
      }
      setMultiCursorRanges((current) => {
        if (current.length === nextMultiCursorRanges.length) {
          const unchanged = current.every(
            (range, index) =>
              range.start === nextMultiCursorRanges[index]?.start &&
              range.end === nextMultiCursorRanges[index]?.end,
          );
          if (unchanged) return current;
        }
        return nextMultiCursorRanges;
      });
      setEditorSelection((current) => {
        if (current.start === safeStart && current.end === safeEnd) return current;
        return { start: safeStart, end: safeEnd };
      });
      syncShadowTextSelection(safeStart, safeEnd);
    },
    [syncShadowTextSelection, textContent.length],
  );

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
    if (nativeSyntaxEditAvailable) return;
    if (!enableNativeSyntaxEdit) return;
    setEnableNativeSyntaxEdit(false);
  }, [enableNativeSyntaxEdit, nativeSyntaxEditAvailable]);

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
    setStructureFilterInput("");
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
    if (textEolMode === "CRLF") {
      setTargetEolMode("CRLF");
      return;
    }
    setTargetEolMode("LF");
  }, [textEolMode, textPath, textPreviewOffset]);

  useEffect(() => {
    setBookmarkedLines((current) =>
      current.filter((lineIndex) => lineIndex >= 0 && lineIndex <= maxLineIndex),
    );
  }, [maxLineIndex]);

  useEffect(() => {
    if (!textPath) {
      setDiffComparePath(null);
      setDiffCompareContent("");
      setDiffNotice("");
      setShowHexPanel(false);
      setHexWindowBytes(new Uint8Array());
      setHexBaseOffset(0);
      setHexOffsetInput("0");
      setHexTotalBytes(null);
      setHexSelectedIndex(null);
      setHexEditInput("");
      setHexEdits({});
      setHexNotice("");
      return;
    }
    setDiffNotice("");
  }, [textPath, textPreviewOffset]);

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
      if (nativeSyntaxEditEnabled) {
        const safeStart = Math.max(0, Math.min(start, textContent.length));
        const safeEnd = Math.max(0, Math.min(end, textContent.length));
        syncShadowTextSelection(safeStart, safeEnd);
        setEditorSelection({ start: safeStart, end: safeEnd });
        setNativeFocusVersion((version) => version + 1);
        return;
      }
      window.requestAnimationFrame(() => {
        const editor = textAreaRef.current;
        if (!editor) return;
        editor.focus();
        editor.setSelectionRange(start, end);
        setEditorSelection({ start, end });
      });
    },
    [nativeSyntaxEditEnabled, syncShadowTextSelection, textAreaRef, textContent.length],
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

  const jumpToLineByRatio = useCallback(
    (ratio: number) => {
      const normalized = Math.max(0, Math.min(1, ratio));
      const targetLine = Math.floor(normalized * Math.max(0, lineCount - 1));
      jumpToLineIndex(targetLine);
    },
    [jumpToLineIndex, lineCount],
  );

  const handleMinimapPointer = useCallback(
    (clientY: number, track: HTMLDivElement) => {
      const rect = track.getBoundingClientRect();
      if (rect.height <= 0) return;
      const ratio = (clientY - rect.top) / rect.height;
      jumpToLineByRatio(ratio);
    },
    [jumpToLineByRatio],
  );

  const handleMinimapMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      handleMinimapPointer(event.clientY, event.currentTarget);
    },
    [handleMinimapPointer],
  );

  const handleMinimapMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if ((event.buttons & 1) !== 1) return;
      handleMinimapPointer(event.clientY, event.currentTarget);
    },
    [handleMinimapPointer],
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

  const applyTextTransform = useCallback(
    (nextContent: string) => {
      if (nextContent === textContent) return false;
      const editor = textAreaRef.current;
      const currentSelectionStart = editor?.selectionStart ?? editorSelection.start;
      const currentSelectionEnd = editor?.selectionEnd ?? editorSelection.end;
      setTextContent(nextContent);
      const safeStart = Math.max(0, Math.min(currentSelectionStart, nextContent.length));
      const safeEnd = Math.max(0, Math.min(currentSelectionEnd, nextContent.length));
      setEditorSelection({ start: safeStart, end: safeEnd });
      window.requestAnimationFrame(() => {
        const currentEditor = textAreaRef.current;
        if (!currentEditor) return;
        try {
          currentEditor.setSelectionRange(safeStart, safeEnd);
        } catch {
          // Ignore selection restore errors for hidden/readonly states.
        }
      });
      return true;
    },
    [editorSelection.end, editorSelection.start, setTextContent, textAreaRef, textContent],
  );

  const applySelectionRange = useCallback(
    (start: number, end: number, contentLength = textContent.length) => {
      const safeStart = Math.max(0, Math.min(start, contentLength));
      const safeEnd = Math.max(0, Math.min(end, contentLength));
      setEditorSelection({ start: safeStart, end: safeEnd });
      window.requestAnimationFrame(() => {
        syncShadowTextSelection(safeStart, safeEnd);
      });
    },
    [syncShadowTextSelection, textContent.length],
  );

  const replaceTextSelection = useCallback(
    (replacement: string): boolean => {
      const start = Math.max(0, Math.min(editorSelection.start, editorSelection.end));
      const end = Math.max(start, Math.max(editorSelection.start, editorSelection.end));
      const nextContent = `${textContent.slice(0, start)}${replacement}${textContent.slice(end)}`;
      if (nextContent === textContent) {
        applySelectionRange(start + replacement.length, start + replacement.length);
        return false;
      }
      setTextContent(nextContent);
      const nextCaret = start + replacement.length;
      applySelectionRange(nextCaret, nextCaret, nextContent.length);
      return true;
    },
    [applySelectionRange, editorSelection.end, editorSelection.start, setTextContent, textContent],
  );

  const applyEolConversion = useCallback(() => {
    const converted = convertTextEol(textContent, targetEolMode);
    void applyTextTransform(converted);
  }, [applyTextTransform, targetEolMode, textContent]);

  const trimTextTrailingWhitespace = useCallback(() => {
    const trimmed = trimTrailingWhitespace(textContent);
    void applyTextTransform(trimmed.content);
  }, [applyTextTransform, textContent]);

  const decodeBytesByEncoding = useCallback(
    (bytes: Uint8Array): string => {
      if (textEncoding === "UTF-16LE") {
        const hasBom =
          bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
        return new TextDecoder("utf-16le").decode(hasBom ? bytes.subarray(2) : bytes);
      }
      if (textEncoding === "GBK") {
        return new TextDecoder("gbk").decode(bytes);
      }
      if (textEncoding === "SHIFT-JIS") {
        return new TextDecoder("shift_jis").decode(bytes);
      }
      const hasBom =
        bytes.length >= 3 &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf;
      return new TextDecoder("utf-8").decode(hasBom ? bytes.subarray(3) : bytes);
    },
    [textEncoding],
  );

  const loadCompareFileForDiff = useCallback(async () => {
    setDiffNotice("");
    const selected = await openFileDialog({
      multiple: false,
      directory: false,
      title: t("Select file to compare", "选择对比文件"),
    });
    const comparePath =
      typeof selected === "string" ? selected : Array.isArray(selected) ? selected[0] : null;
    if (!comparePath) return;
    setDiffLoading(true);
    try {
      const info = await statFile(comparePath).catch(() => ({ size: undefined }));
      if (
        typeof info.size === "number" &&
        info.size > DIFF_MAX_COMPARE_BYTES
      ) {
        setDiffNotice(
          t(
            `Compare file exceeds ${formatByteSize(DIFF_MAX_COMPARE_BYTES)}; please use a smaller file for preview diff.`,
            `对比文件超过 ${formatByteSize(DIFF_MAX_COMPARE_BYTES)}，请使用更小文件进行预览对比。`,
          ),
        );
        return;
      }
      const bytes = await readBinaryFile(comparePath);
      setDiffComparePath(comparePath);
      setDiffCompareContent(decodeBytesByEncoding(bytes));
      setShowDiffMergePanel(true);
      setDiffNotice("");
    } catch (err) {
      setDiffNotice(String(err));
    } finally {
      setDiffLoading(false);
    }
  }, [decodeBytesByEncoding, formatByteSize, t]);

  const clearDiffCompare = useCallback(() => {
    setDiffComparePath(null);
    setDiffCompareContent("");
    setDiffNotice("");
  }, []);

  const applyDiffBlockFromRight = useCallback(
    (block: LineDiffBlock) => {
      const leftLines = splitTextToDiffLines(textContent);
      const nextLines = [
        ...leftLines.slice(0, block.leftStart),
        ...block.rightLines,
        ...leftLines.slice(block.leftStart + block.leftDeleteCount),
      ];
      let next = joinDiffLines(nextLines);
      if (textEolMode === "CRLF") {
        next = convertTextEol(next, "CRLF");
      } else if (textEolMode === "LF") {
        next = convertTextEol(next, "LF");
      }
      void applyTextTransform(next);
    },
    [applyTextTransform, textContent, textEolMode],
  );

  const applyAllFromCompare = useCallback(() => {
    if (!diffComparePath) return;
    void applyTextTransform(diffCompareContent);
  }, [applyTextTransform, diffCompareContent, diffComparePath]);

  const loadHexWindowAtOffset = useCallback(
    async (path: string, requestedOffset: number) => {
      setHexLoading(true);
      try {
        const info = await statFile(path).catch(() => ({ size: undefined }));
        const total = typeof info.size === "number" ? Math.max(0, info.size) : null;
        const clampedOffset =
          total === null
            ? Math.max(0, requestedOffset)
            : total <= 0
              ? 0
              : Math.max(0, Math.min(requestedOffset, Math.max(0, total - 1)));
        const raw = await invokeCmd<number[]>("read_file_bytes_range", {
          path,
          offset: clampedOffset,
          maxBytes: HEX_WINDOW_BYTES,
        });
        const bytes = Uint8Array.from(raw);
        setHexBaseOffset(clampedOffset);
        setHexOffsetInput(String(clampedOffset));
        setHexWindowBytes(bytes);
        setHexTotalBytes(total ?? bytes.length);
        setHexSelectedIndex(null);
        setHexEditInput("");
        setHexEdits({});
        setHexNotice("");
      } catch (err) {
        setHexNotice(String(err));
      } finally {
        setHexLoading(false);
      }
    },
    [],
  );

  const loadHexFromInputOffset = useCallback(async () => {
    if (!textPath) return;
    const raw = hexOffsetInput.trim();
    if (!raw) return;
    const parsed = raw.toLowerCase().startsWith("0x")
      ? Number.parseInt(raw.slice(2), 16)
      : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setHexNotice(t("Invalid offset.", "偏移无效。"));
      return;
    }
    await loadHexWindowAtOffset(textPath, parsed);
  }, [hexOffsetInput, loadHexWindowAtOffset, t, textPath]);

  const loadPrevHexWindow = useCallback(async () => {
    if (!textPath) return;
    await loadHexWindowAtOffset(textPath, Math.max(0, hexBaseOffset - HEX_WINDOW_BYTES));
  }, [hexBaseOffset, loadHexWindowAtOffset, textPath]);

  const loadNextHexWindow = useCallback(async () => {
    if (!textPath) return;
    await loadHexWindowAtOffset(textPath, hexBaseOffset + HEX_WINDOW_BYTES);
  }, [hexBaseOffset, loadHexWindowAtOffset, textPath]);

  const handleSelectHexByte = useCallback(
    (index: number) => {
      const staged = Object.prototype.hasOwnProperty.call(hexEdits, index)
        ? hexEdits[index]
        : hexWindowBytes[index];
      setHexSelectedIndex(index);
      setHexEditInput(toHexByte(staged ?? 0));
    },
    [hexEdits, hexWindowBytes],
  );

  const stageHexByteEdit = useCallback(() => {
    if (hexSelectedIndex === null) return;
    const parsed = parseHexByte(hexEditInput);
    if (parsed === null) {
      setHexNotice(t("Enter a hex byte like 0A or FF.", "请输入十六进制字节，例如 0A 或 FF。"));
      return;
    }
    setHexEdits((current) => ({
      ...current,
      [hexSelectedIndex]: parsed,
    }));
    setHexEditInput(toHexByte(parsed));
    setHexNotice(
      t(
        `Staged edit @ 0x${(hexBaseOffset + hexSelectedIndex).toString(16).toUpperCase()}.`,
        `已暂存修改 @ 0x${(hexBaseOffset + hexSelectedIndex).toString(16).toUpperCase()}。`,
      ),
    );
  }, [hexBaseOffset, hexEditInput, hexSelectedIndex, t]);

  const discardHexEdits = useCallback(() => {
    setHexEdits({});
    setHexNotice("");
  }, []);

  const applyHexEdits = useCallback(async () => {
    if (!textPath) return;
    if (textDirty) {
      setHexNotice(t("Save text edits before applying hex edits.", "请先保存文本修改，再应用 Hex 修改。"));
      return;
    }
    const ranges = buildHexApplyRanges(hexWindowBytes, hexEdits);
    if (!ranges.length) return;
    setHexLoading(true);
    try {
      for (const range of ranges) {
        await invokeCmd<void>("replace_file_bytes_range", {
          sourcePath: textPath,
          targetPath: textPath,
          offset: hexBaseOffset + range.start,
          deleteLen: range.bytes.length,
          insertBytes: range.bytes,
        });
      }
      await loadHexWindowAtOffset(textPath, hexBaseOffset);
      setHexNotice(
        t(
          `Applied ${ranges.length} byte range edits.`,
          `已应用 ${ranges.length} 个字节区段修改。`,
        ),
      );
    } catch (err) {
      setHexNotice(String(err));
    } finally {
      setHexLoading(false);
    }
  }, [hexBaseOffset, hexEdits, hexWindowBytes, loadHexWindowAtOffset, t, textDirty, textPath]);

  useEffect(() => {
    if (!showHexPanel || !textPath) return;
    void loadHexWindowAtOffset(textPath, hexBaseOffset);
  }, [hexBaseOffset, loadHexWindowAtOffset, showHexPanel, textPath, textPreviewOffset]);

  const refreshExtensionCommands = useCallback(() => {
    const listed = extensionRuntimeRef.current.listCommands();
    setExtensionCommands(listed);
    setActiveExtensionCommandId((current) => {
      if (current && listed.some((command) => command.id === current)) return current;
      return listed[0]?.id ?? "";
    });
  }, []);

  const handleLoadExtensionScript = useCallback(async () => {
    setExtensionNotice("");
    const selected = await openFileDialog({
      multiple: false,
      directory: false,
      title: t("Select extension script", "选择扩展脚本"),
      filters: [{ name: "Script", extensions: ["js", "mjs", "txt"] }],
    });
    const scriptPath =
      typeof selected === "string" ? selected : Array.isArray(selected) ? selected[0] : null;
    if (!scriptPath) return;
    setExtensionLoading(true);
    try {
      const info = await statFile(scriptPath).catch(() => ({ size: undefined }));
      if (typeof info.size === "number" && info.size > EXTENSION_SCRIPT_MAX_BYTES) {
        setExtensionNotice(
          t(
            `Script exceeds ${formatByteSize(EXTENSION_SCRIPT_MAX_BYTES)} limit.`,
            `脚本超过 ${formatByteSize(EXTENSION_SCRIPT_MAX_BYTES)} 限制。`,
          ),
        );
        return;
      }
      const bytes = await readBinaryFile(scriptPath);
      const scriptSource = new TextDecoder("utf-8").decode(bytes);
      const sourceId = `file:${scriptPath}`;
      if (extensionSourceId && extensionSourceId !== sourceId) {
        extensionRuntimeRef.current.unloadSource(extensionSourceId);
      }
      const loaded = extensionRuntimeRef.current.loadScript(scriptSource, sourceId);
      setExtensionSourceId(sourceId);
      refreshExtensionCommands();
      setExtensionNotice(
        t(
          `Loaded ${loaded.length} command(s) from script.`,
          `已从脚本加载 ${loaded.length} 个命令。`,
        ),
      );
    } catch (err) {
      setExtensionNotice(String(err));
    } finally {
      setExtensionLoading(false);
    }
  }, [extensionSourceId, formatByteSize, refreshExtensionCommands, t]);

  const handleUnloadExtensionScript = useCallback(() => {
    if (!extensionSourceId) return;
    const removed = extensionRuntimeRef.current.unloadSource(extensionSourceId);
    setExtensionSourceId(null);
    refreshExtensionCommands();
    setExtensionNotice(
      t(
        `Unloaded ${removed} command(s).`,
        `已卸载 ${removed} 个命令。`,
      ),
    );
  }, [extensionSourceId, refreshExtensionCommands, t]);

  const runExtensionCommandById = useCallback(
    async (
      commandId: string,
      grantedPermissions?: TextExtensionPermission[],
    ) => {
      if (!commandId) return;
      setExtensionRunning(true);
      setExtensionNotice("");
      try {
        await extensionRuntimeRef.current.runCommand(commandId, grantedPermissions);
        setExtensionNotice(t("Extension command finished.", "扩展命令执行完成。"));
      } catch (err) {
        setExtensionNotice(String(err));
      } finally {
        setExtensionRunning(false);
      }
    },
    [t],
  );

  const handleRunExtensionCommand = useCallback(async () => {
    if (!activeExtensionCommandId) return;
    const granted = selectedExtensionPermissions.filter(
      (permission) => extensionPermissionGrants[permission],
    );
    await runExtensionCommandById(activeExtensionCommandId, granted);
  }, [
    activeExtensionCommandId,
    extensionPermissionGrants,
    runExtensionCommandById,
    selectedExtensionPermissions,
  ]);

  const openCommandPalette = useCallback(() => {
    setShowCommandPalette(true);
    setCommandPaletteQuery("");
    setCommandPaletteActiveIndex(0);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
    setCommandPaletteQuery("");
    setCommandPaletteActiveIndex(0);
    if (nativeSyntaxEditEnabled) {
      setNativeFocusVersion((version) => version + 1);
      return;
    }
    window.requestAnimationFrame(() => {
      textAreaRef.current?.focus();
    });
  }, [nativeSyntaxEditEnabled, textAreaRef]);

  const executeCommandPaletteItem = useCallback(
    async (item: CommandPaletteItem) => {
      if (item.disabled) return;
      try {
        await item.run();
      } finally {
        closeCommandPalette();
      }
    },
    [closeCommandPalette],
  );

  useEffect(() => {
    if (!showCommandPalette) return;
    const timer = window.setTimeout(() => {
      commandPaletteInputRef.current?.focus();
      commandPaletteInputRef.current?.select();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [showCommandPalette]);

  useEffect(() => {
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        if (showCommandPalette) {
          closeCommandPalette();
          return;
        }
        openCommandPalette();
        return;
      }
      if (showCommandPalette && event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
      }
    };
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [closeCommandPalette, openCommandPalette, showCommandPalette]);

  const handleToggleExtensionPermission = useCallback((permission: TextExtensionPermission) => {
    setExtensionPermissionGrants((current) => ({
      ...current,
      [permission]: !current[permission],
    }));
  }, []);

  useEffect(() => {
    const runtime = extensionRuntimeRef.current;
    runtime.registerCommand(
      {
        id: "builtin.selection.uppercase",
        title: t("Selection to uppercase", "选区转大写"),
        description: t("Uppercase current selection text.", "将当前选区文本转为大写。"),
        permissions: ["text.read", "selection.read", "selection.write", "text.write"],
        run: ({ getSelection, getText, replaceSelection }) => {
          const selection = getSelection();
          if (selection.start === selection.end) return;
          const selectedText = getText().slice(selection.start, selection.end);
          replaceSelection(selectedText.toUpperCase());
        },
      },
      "builtin",
    );
    runtime.registerCommand(
      {
        id: "builtin.selection.lowercase",
        title: t("Selection to lowercase", "选区转小写"),
        description: t("Lowercase current selection text.", "将当前选区文本转为小写。"),
        permissions: ["text.read", "selection.read", "selection.write", "text.write"],
        run: ({ getSelection, getText, replaceSelection }) => {
          const selection = getSelection();
          if (selection.start === selection.end) return;
          const selectedText = getText().slice(selection.start, selection.end);
          replaceSelection(selectedText.toLowerCase());
        },
      },
      "builtin",
    );
    refreshExtensionCommands();
  }, [refreshExtensionCommands, t]);

  useEffect(() => {
    extensionHostRef.current = {
      path: textPath,
      getText: () => textContent,
      replaceText: (nextText: string) => applyTextTransform(nextText),
      getSelection: () => {
        const start = Math.max(0, Math.min(editorSelection.start, editorSelection.end));
        const end = Math.max(start, Math.max(editorSelection.start, editorSelection.end));
        return { start, end };
      },
      setSelection: (selection: TextExtensionSelection) => {
        applySelectionRange(selection.start, selection.end);
      },
      replaceSelection: (text: string) => replaceTextSelection(text),
      showMessage: async (message: string, title?: string) => {
        await messageDialog(message, {
          title: title ?? t("Extension", "扩展"),
          kind: "info",
        });
      },
      confirm: async (message: string, title?: string) =>
        confirmDialog(message, { title: title ?? t("Extension", "扩展") }),
    };
  }, [
    applySelectionRange,
    applyTextTransform,
    editorSelection.end,
    editorSelection.start,
    replaceTextSelection,
    t,
    textContent,
    textPath,
  ]);

  useEffect(() => {
    setMarkdownSourceMode(false);
  }, [textPath]);

  useEffect(() => {
    setShowAdvancedTools(false);
  }, [textPath]);

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
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        openCommandPalette();
        return;
      }
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
      openCommandPalette,
      popMultiCursor,
      runMultiCursorEdit,
      bracketMatch,
      navigateToOffset,
      toggleCurrentLineBookmark,
    ],
  );

  const handleNativePreviewKeyDown = useCallback(
    (event: globalThis.KeyboardEvent): boolean => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "p"
      ) {
        event.preventDefault();
        openCommandPalette();
        return true;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === "F2"
      ) {
        event.preventDefault();
        toggleCurrentLineBookmark();
        return true;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "F2") {
        event.preventDefault();
        if (event.shiftKey) {
          jumpPrevBookmark();
          return true;
        }
        jumpNextBookmark();
        return true;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        !event.altKey &&
        event.key === "\\"
      ) {
        if (!bracketMatch) return false;
        event.preventDefault();
        navigateToOffset(bracketMatch.matchOffset);
        return true;
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
            return Boolean(
              extendBlockSelectionByKey(
                event.key as
                  | "ArrowLeft"
                  | "ArrowRight"
                  | "ArrowUp"
                  | "ArrowDown"
                  | "Home"
                  | "End"
                  | "PageUp"
                  | "PageDown",
              ),
            );
          }
          if (isArrowUpOrDown) {
            return false;
          }
        }
      }
      return false;
    },
    [
      bracketMatch,
      extendBlockSelectionByKey,
      jumpNextBookmark,
      jumpPrevBookmark,
      navigateToOffset,
      openCommandPalette,
      toggleCurrentLineBookmark,
    ],
  );

  const handleToggleNativeSyntaxEdit = useCallback(() => {
    setEnableNativeSyntaxEdit((current) => {
      const next = !current;
      if (next) {
        setNativeFocusVersion((version) => version + 1);
      }
      return next;
    });
  }, []);

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

  const commandPaletteItems = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [
      {
        id: "text.save",
        title: t("Save", "保存"),
        description: t("Save current text file.", "保存当前文本文件。"),
        shortcut: "Ctrl/Meta+S",
        keywords: "save file text",
        disabled: textLoading || (!textDirty && Boolean(textPath)),
        run: async () => {
          await saveCurrent();
        },
      },
      {
        id: "text.saveAs",
        title: t("Save As", "另存为"),
        description: t("Save to another path.", "另存到其他路径。"),
        shortcut: "Ctrl/Meta+Shift+S",
        keywords: "save as export path",
        disabled: textLoading,
        run: async () => {
          await saveTextAs();
        },
      },
      {
        id: "text.map.toggle",
        title: showDocMapPanel
          ? t("Hide Document Map", "隐藏文档地图")
          : t("Show Document Map", "显示文档地图"),
        description: t("Toggle minimap and structure map panel.", "切换 minimap 与结构地图面板。"),
        shortcut: "",
        keywords: "map minimap structure outline",
        disabled: false,
        run: () => setShowDocMapPanel((current) => !current),
      },
      {
        id: "text.syntax.toggle",
        title: showSyntaxPreview
          ? t("Hide Syntax Preview", "隐藏语法预览")
          : t("Show Syntax Preview", "显示语法预览"),
        description: t("Toggle syntax highlighted preview panel.", "切换语法高亮预览面板。"),
        shortcut: "",
        keywords: "syntax preview highlight",
        disabled: textLoading || !syntaxPreviewSupported,
        run: () => setShowSyntaxPreview((current) => !current),
      },
      {
        id: "text.markdown.source.toggle",
        title: markdownSourceMode
          ? t("Markdown: Render Mode", "Markdown：渲染模式")
          : t("Markdown: Source Mode", "Markdown：源码模式"),
        description: t(
          "Toggle between markdown rendered editing view and plain source text mode.",
          "在 Markdown 渲染编辑视图与纯源码文本模式之间切换。",
        ),
        shortcut: "",
        keywords: "markdown source mode render mode plain text",
        disabled: textLoading || !markdownPathActive,
        run: () => setMarkdownSourceMode((current) => !current),
      },
      {
        id: "text.hex.toggle",
        title: showHexPanel ? t("Hide Hex Panel", "隐藏 Hex 面板") : t("Show Hex Panel", "显示 Hex 面板"),
        description: t("Toggle hex view/edit panel.", "切换 Hex 查看/编辑面板。"),
        shortcut: "",
        keywords: "hex binary bytes",
        disabled: !textPath || textLoading,
        run: async () => {
          if (showHexPanel) {
            setShowHexPanel(false);
            return;
          }
          if (!textPath) return;
          setShowHexPanel(true);
          await loadHexWindowAtOffset(textPath, hexBaseOffset);
        },
      },
      {
        id: "text.diff.select",
        title: t("Select Compare File", "选择对比文件"),
        description: t("Choose a file for diff/merge panel.", "选择用于对比/合并的文件。"),
        shortcut: "",
        keywords: "diff merge compare",
        disabled: textLoading || diffLoading,
        run: async () => {
          await loadCompareFileForDiff();
        },
      },
      {
        id: "text.find.run",
        title: t("Run Find", "执行查找"),
        description: t("Run text find in current chunk.", "在当前分块中执行文本查找。"),
        shortcut: "Enter (Find field)",
        keywords: "find search",
        disabled: textLoading || textFindRunning || textReplaceRunning || !textFindQuery.trim(),
        run: async () => {
          await runTextFind();
        },
      },
      {
        id: "text.bookmark.toggle",
        title: t("Toggle Bookmark", "切换书签"),
        description: t("Toggle bookmark at current caret line.", "在当前光标行切换书签。"),
        shortcut: "Ctrl/Meta+F2",
        keywords: "bookmark mark line",
        disabled: textLoading || textReplaceRunning,
        run: () => toggleCurrentLineBookmark(),
      },
      {
        id: "text.cursor.next",
        title: t("Add Next Cursor", "添加下一光标"),
        description: t("Add next match to multi-cursor set.", "将下一处匹配加入多光标。"),
        shortcut: "Ctrl/Meta+D",
        keywords: "multi cursor next",
        disabled: textLoading || textReplaceRunning || !textContent.length,
        run: () => addNextMultiCursor(),
      },
      {
        id: "text.cursor.all",
        title: t("Add All Match Cursors", "添加全部匹配光标"),
        description: t("Add cursors to all matches of selection.", "为选中文本全部匹配添加光标。"),
        shortcut: "Ctrl/Meta+Shift+L",
        keywords: "multi cursor all",
        disabled: textLoading || textReplaceRunning || !textContent.length,
        run: () => addAllMatchingMultiCursors(),
      },
      {
        id: "text.extension.load",
        title: t("Load Extension Script", "加载扩展脚本"),
        description: t("Load commands from a local script file.", "从本地脚本文件加载命令。"),
        shortcut: "",
        keywords: "extension plugin script load",
        disabled: extensionLoading,
        run: async () => {
          await handleLoadExtensionScript();
        },
      },
    ];
    for (const command of extensionCommands) {
      items.push({
        id: `ext:${command.id}`,
        title: `${t("Run Extension", "运行扩展")}: ${command.title}`,
        description: command.description || command.id,
        shortcut: "",
        keywords: `extension script ${command.id} ${command.title} ${command.description}`,
        disabled: extensionRunning,
        run: async () => {
          await runExtensionCommandById(command.id, command.permissions);
        },
      });
    }
    return items;
  }, [
    addAllMatchingMultiCursors,
    addNextMultiCursor,
    diffLoading,
    extensionCommands,
    extensionLoading,
    extensionRunning,
    handleLoadExtensionScript,
    hexBaseOffset,
    loadCompareFileForDiff,
    loadHexWindowAtOffset,
    markdownPathActive,
    markdownSourceMode,
    runExtensionCommandById,
    runTextFind,
    saveCurrent,
    saveTextAs,
    showDocMapPanel,
    showHexPanel,
    showSyntaxPreview,
    syntaxPreviewSupported,
    t,
    textContent.length,
    textFindQuery,
    textFindRunning,
    textLoading,
    textPath,
    textReplaceRunning,
    textDirty,
    toggleCurrentLineBookmark,
  ]);

  const filteredCommandPaletteItems = useMemo(() => {
    const query = commandPaletteQuery.trim().toLowerCase();
    if (!query) return commandPaletteItems;
    return commandPaletteItems.filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.shortcut} ${item.keywords}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [commandPaletteItems, commandPaletteQuery]);

  useEffect(() => {
    setCommandPaletteActiveIndex((current) => {
      if (!filteredCommandPaletteItems.length) return 0;
      return Math.max(0, Math.min(current, filteredCommandPaletteItems.length - 1));
    });
  }, [filteredCommandPaletteItems.length]);

  const handleCommandPaletteInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCommandPaletteActiveIndex((current) =>
          Math.min(current + 1, Math.max(0, filteredCommandPaletteItems.length - 1)),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCommandPaletteActiveIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = filteredCommandPaletteItems[commandPaletteActiveIndex];
        if (!item) return;
        void executeCommandPaletteItem(item);
      }
    },
    [
      closeCommandPalette,
      commandPaletteActiveIndex,
      executeCommandPaletteItem,
      filteredCommandPaletteItems,
    ],
  );

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
          {textDirty ? <span className="dirty">{t("(modified)", "(已修改)")}</span> : null}
        </div>
        <div className="text-actions">
          <div className="text-primary-tools">
            <button onClick={saveCurrent} disabled={textLoading || (!textDirty && Boolean(textPath))}>
              {t("Save", "保存")}
            </button>
            <button onClick={saveTextAs} disabled={textLoading}>
              {t("Save As", "另存为")}
            </button>
            <label className="text-find-compact">
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
            <div className="text-command-tools">
              <span className="label">{t("Cmd", "命令")}</span>
              <button onClick={openCommandPalette}>
                {t("Palette", "命令面板")}
              </button>
              <span className="current">{t("Ctrl/Meta+Shift+P", "Ctrl/Meta+Shift+P")}</span>
            </div>
            <button
              className="text-more-toggle"
              onClick={() => setShowAdvancedTools((current) => !current)}
            >
              {showAdvancedTools ? t("Less", "收起") : t("More", "更多")}
            </button>
          </div>
          {showAdvancedTools ? (
            <div className="text-advanced-tools">
          <label className="text-field">
            <span>{t("Encoding", "编码")}</span>
            <select
              value={textEncoding}
              onChange={(e) => setTextEncoding(e.target.value as TextEncoding)}
              disabled={textReadOnlyPreview}
            >
              <option value="UTF-8">UTF-8</option>
              <option value="UTF-16LE">UTF-16 LE</option>
              <option value="GBK">GBK</option>
              <option value="SHIFT-JIS">Shift-JIS</option>
            </select>
          </label>
          <div className="text-clean-tools">
            <span className="label">{t("Clean", "清洗")}</span>
            <label className="text-field">
              <span>{t("EOL", "换行")}</span>
              <select
                value={targetEolMode}
                onChange={(event) => setTargetEolMode(event.target.value as TextEolTarget)}
                disabled={textReadOnlyPreview || textLoading || textReplaceRunning}
              >
                <option value="LF">LF</option>
                <option value="CRLF">CRLF</option>
              </select>
            </label>
            <button
              onClick={applyEolConversion}
              disabled={
                textReadOnlyPreview ||
                textLoading ||
                textReplaceRunning ||
                !textContent.length ||
                (targetEolMode === "LF" && textEolMode === "LF") ||
                (targetEolMode === "CRLF" && textEolMode === "CRLF")
              }
            >
              {t("Convert EOL", "转换换行")}
            </button>
            <button
              onClick={trimTextTrailingWhitespace}
              disabled={
                textReadOnlyPreview ||
                textLoading ||
                textReplaceRunning ||
                whitespaceStats.trailingWhitespaceChars === 0
              }
            >
              {t("Trim trailing", "清理行尾空白")}
            </button>
            <label className="text-find-check">
              <input
                type="checkbox"
                checked={showWhitespacePreview}
                onChange={(event) => setShowWhitespacePreview(event.target.checked)}
              />
              <span>{t("Show whitespace", "显示空白符")}</span>
            </label>
            <span className="current">
              {t(
                `Now ${eolModeLabel} · trailing ${whitespaceStats.trailingWhitespaceLines}`,
                `当前 ${eolModeLabel} · 行尾空白 ${whitespaceStats.trailingWhitespaceLines}`,
              )}
            </span>
          </div>
          <div className="text-diff-tools">
            <span className="label">{t("Diff/Merge", "对比/合并")}</span>
            <button
              onClick={() => void loadCompareFileForDiff()}
              disabled={textLoading || diffLoading}
            >
              {diffLoading ? t("Loading...", "加载中...") : t("Select compare", "选择对比文件")}
            </button>
            <button
              onClick={() => setShowDiffMergePanel((current) => !current)}
              disabled={!diffComparePath}
            >
              {showDiffMergePanel ? t("Hide panel", "隐藏面板") : t("Show panel", "显示面板")}
            </button>
            <button onClick={applyAllFromCompare} disabled={!diffComparePath || textReadOnlyPreview}>
              {t("Take all right", "整份采用右侧")}
            </button>
            <button onClick={clearDiffCompare} disabled={!diffComparePath}>
              {t("Clear compare", "清除对比")}
            </button>
            <span className="current">
              {diffComparePath
                ? t(
                    `${diffModel.blocks.length} blocks · ${diffModel.changedLineCount} lines`,
                    `${diffModel.blocks.length} 块 · ${diffModel.changedLineCount} 行`,
                  )
                : t("No compare file", "未选择对比文件")}
            </span>
          </div>
          <div className="text-hex-tools">
            <span className="label">{t("Hex", "Hex")}</span>
            <button
              onClick={() => {
                if (showHexPanel) {
                  setShowHexPanel(false);
                  return;
                }
                if (!textPath) return;
                setShowHexPanel(true);
                void loadHexWindowAtOffset(textPath, hexBaseOffset);
              }}
              disabled={!textPath || textLoading}
            >
              {showHexPanel ? t("Hide hex", "隐藏 Hex") : t("Show hex", "显示 Hex")}
            </button>
            <button
              onClick={() => {
                if (!textPath) return;
                void loadHexWindowAtOffset(textPath, hexBaseOffset);
              }}
              disabled={!showHexPanel || !textPath || hexLoading}
            >
              {hexLoading ? t("Loading...", "加载中...") : t("Reload", "刷新")}
            </button>
            <span className="current">
              {showHexPanel
                ? t(
                    `offset ${hexBaseOffset} · ${hexWindowBytes.length} bytes · edits ${hexEditedCount}`,
                    `偏移 ${hexBaseOffset} · ${hexWindowBytes.length} 字节 · 修改 ${hexEditedCount}`,
                  )
                : t("Hex panel off", "Hex 面板关闭")}
            </span>
          </div>
          <div className="text-map-tools">
            <span className="label">{t("Map", "地图")}</span>
            <button onClick={() => setShowDocMapPanel((current) => !current)}>
              {showDocMapPanel ? t("Hide map", "隐藏地图") : t("Show map", "显示地图")}
            </button>
            <span className="current">
              {t(
                `${lineCount} lines · ${structureItems.length} items`,
                `${lineCount} 行 · ${structureItems.length} 项`,
              )}
            </span>
          </div>
          {markdownPathActive ? (
            <div className="text-markdown-tools">
              <span className="label">Markdown</span>
              <button onClick={() => setMarkdownSourceMode((current) => !current)}>
                {markdownSourceMode
                  ? t("Render mode", "渲染模式")
                  : t("Source mode", "源码模式")}
              </button>
              <span className="current">
                {markdownSourceMode
                  ? t("source editing", "源码编辑")
                  : t(
                      `${markdownPreviewBlocks.length} blocks · realtime`,
                      `${markdownPreviewBlocks.length} 块 · 实时预览`,
                    )}
              </span>
              {markdownPreviewDeferred && !markdownSourceMode ? (
                <span className="current">{t("rendering...", "渲染中...")}</span>
              ) : null}
              <span className="current">
                {markdownPreviewTooLarge && !markdownSourceMode
                  ? t(
                      `truncated at ${MAX_MARKDOWN_PREVIEW_CHARS} chars`,
                      `已截断至 ${MAX_MARKDOWN_PREVIEW_CHARS} 字符`,
                    )
                  : t("full content", "完整内容")}
              </span>
            </div>
          ) : null}
          <div className="text-extension-tools">
            <span className="label">{t("Ext", "扩展")}</span>
            <button onClick={() => void handleLoadExtensionScript()} disabled={extensionLoading}>
              {extensionLoading
                ? t("Loading...", "加载中...")
                : t("Load script", "加载脚本")}
            </button>
            <button onClick={handleUnloadExtensionScript} disabled={!extensionSourceId}>
              {t("Unload", "卸载")}
            </button>
            <label className="text-field">
              <span>{t("Command", "命令")}</span>
              <select
                value={activeExtensionCommandId}
                onChange={(event) => setActiveExtensionCommandId(event.target.value)}
              >
                {!extensionCommands.length ? (
                  <option value="">{t("No command", "无命令")}</option>
                ) : null}
                {extensionCommands.map((command) => (
                  <option key={command.id} value={command.id}>
                    {command.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => void handleRunExtensionCommand()}
              disabled={
                !activeExtensionCommandId ||
                extensionRunning ||
                textLoading ||
                textReplaceRunning
              }
            >
              {extensionRunning ? t("Running...", "执行中...") : t("Run", "运行")}
            </button>
            <span className="current">
              {t(
                `${extensionCommands.length} cmds`,
                `${extensionCommands.length} 个命令`,
              )}
            </span>
          </div>
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
              {syntaxPreviewEngine === "native" ? (
                <button
                  onClick={handleToggleNativeSyntaxEdit}
                  disabled={textLoading || textReadOnlyPreview || syntaxPreviewTooLarge}
                >
                  {nativeSyntaxEditEnabled
                    ? t("Native edit off", "原生编辑关")
                    : t("Native edit on", "原生编辑开")}
                </button>
              ) : null}
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
                {t("Prev chunk", "上一段")}
              </button>
              <button
                onClick={() => void loadNextTextPreviewChunk()}
                disabled={textLoading || textReplaceRunning || !textPreviewHasNext}
              >
                {t("Next chunk", "下一段")}
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
                <span>{t("Case", "区分大小写")}</span>
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
                {t("Replace all (file)", "全文件替换")}
              </button>
              <button
                onClick={jumpTextFindPrev}
                disabled={textLoading || textReplaceRunning || !textFindHitsLength}
              >
                {t("Prev hit", "上一个命中")}
              </button>
              <button
                onClick={jumpTextFindNext}
                disabled={textLoading || textReplaceRunning || !textFindHitsLength}
              >
                {t("Next hit", "下一个命中")}
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
          ) : null}
        </div>
      </div>
      {diffNotice && !showDiffMergePanel ? (
        <div className="text-diff-notice">{diffNotice}</div>
      ) : null}
      {showAdvancedTools && (selectedExtensionCommand || extensionNotice) ? (
        <section className="text-extension-panel">
          <div className="text-extension-panel-head">
            <strong>{t("Extension Command", "扩展命令")}</strong>
            {selectedExtensionCommand ? (
              <span>
                {selectedExtensionCommand.title} · {selectedExtensionCommand.id}
              </span>
            ) : (
              <span>{t("No active command", "没有激活命令")}</span>
            )}
          </div>
          {selectedExtensionCommand?.description ? (
            <div className="text-extension-description">
              {selectedExtensionCommand.description}
            </div>
          ) : null}
          {selectedExtensionPermissions.length ? (
            <div className="text-extension-permissions">
              <span className="label">{t("Permissions", "权限")}</span>
              {selectedExtensionPermissions.map((permission) => (
                <label key={`perm-${permission}`} className="text-find-check">
                  <input
                    type="checkbox"
                    checked={extensionPermissionGrants[permission]}
                    onChange={() => handleToggleExtensionPermission(permission)}
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="text-extension-permissions">
              <span>{t("This command does not request permissions.", "该命令未声明权限。")}</span>
            </div>
          )}
          {selectedExtensionMissingPermissions.length ? (
            <div className="text-extension-warning">
              {t(
                `Missing grants: ${selectedExtensionMissingPermissions.join(", ")}`,
                `缺少授权: ${selectedExtensionMissingPermissions.join(", ")}`,
              )}
            </div>
          ) : null}
          {extensionNotice ? <div className="text-extension-notice">{extensionNotice}</div> : null}
          <div className="text-extension-hint">
            {t(
              "Script API: registerCommand({ id, title, permissions, run(ctx) { ... } })",
              "脚本 API: registerCommand({ id, title, permissions, run(ctx) { ... } })",
            )}
          </div>
        </section>
      ) : null}
      {showCommandPalette ? (
        <div
          className="text-command-palette-backdrop"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            closeCommandPalette();
          }}
        >
          <section className="text-command-palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="text-command-palette-head">
              <strong>{t("Command Palette", "命令面板")}</strong>
              <span>{t("Enter run · Esc close", "回车执行 · Esc 关闭")}</span>
            </div>
            <input
              ref={commandPaletteInputRef}
              className="text-command-palette-input"
              value={commandPaletteQuery}
              onChange={(event) => {
                setCommandPaletteQuery(event.target.value);
                setCommandPaletteActiveIndex(0);
              }}
              onKeyDown={handleCommandPaletteInputKeyDown}
              placeholder={t("Search commands and shortcuts...", "搜索命令和快捷键...")}
            />
            <div className="text-command-palette-list">
              {filteredCommandPaletteItems.map((item, index) => (
                <button
                  key={`cmd-${item.id}`}
                  className={`text-command-palette-item${index === commandPaletteActiveIndex ? " active" : ""}`}
                  disabled={item.disabled}
                  onMouseEnter={() => setCommandPaletteActiveIndex(index)}
                  onClick={() => {
                    void executeCommandPaletteItem(item);
                  }}
                >
                  <span className="title">{item.title}</span>
                  {item.shortcut ? <span className="shortcut">{item.shortcut}</span> : null}
                  <span className="description">{item.description}</span>
                </button>
              ))}
              {!filteredCommandPaletteItems.length ? (
                <div className="text-command-palette-empty">
                  {t("No command matched.", "没有匹配命令。")}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
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
                `替换中... ${Math.round(textReplaceProgress * 100)}%`,
              )
            : textReplaceAppliedCount !== null
              ? t(
                  `Replaced: ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                  `替换 ${textReplaceAppliedCount} · ${textReplaceElapsedMs ?? 0}ms`,
                )
              : textFindRunning
                ? t(
                    `Finding... ${Math.round(textFindProgress * 100)}%`,
                    `查找中... ${Math.round(textFindProgress * 100)}%`,
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
      {showDiffMergePanel && diffComparePath ? (
        <section className="text-diff-panel">
          <div className="text-diff-panel-head">
            <strong>{t("Diff/Merge Panel", "对比/合并面板")}</strong>
            <span>{t(`Left: ${textPath ?? "-"}`, `左侧: ${textPath ?? "-"}`)}</span>
            <span>{t(`Right: ${diffComparePath}`, `右侧: ${diffComparePath}`)}</span>
            <span>
              {t(
                `Algorithm: ${diffModel.algorithm} · blocks ${diffModel.blocks.length}`,
                `算法: ${diffModel.algorithm} · 差异块 ${diffModel.blocks.length}`,
              )}
            </span>
            {diffModel.blocks.length > MAX_DIFF_PREVIEW_BLOCKS ? (
              <span>
                {t(
                  `Showing first ${MAX_DIFF_PREVIEW_BLOCKS} blocks.`,
                  `仅显示前 ${MAX_DIFF_PREVIEW_BLOCKS} 个差异块。`,
                )}
              </span>
            ) : null}
          </div>
          {diffNotice ? <div className="text-diff-notice">{diffNotice}</div> : null}
          {!diffModel.blocks.length ? (
            <div className="text-diff-empty">{t("No differences.", "未发现差异。")}</div>
          ) : (
            <div className="text-diff-list">
              {visibleDiffBlocks.map((block) => (
                <article key={block.id} className="text-diff-block">
                  <header>
                    <strong>
                      {t(
                        `L${block.leftStart + 1} → R${block.rightStart + 1}`,
                        `左 ${block.leftStart + 1} → 右 ${block.rightStart + 1}`,
                      )}
                    </strong>
                    <span>
                      {t(
                        `-${block.leftDeleteCount} +${block.rightInsertCount}`,
                        `删 ${block.leftDeleteCount} / 增 ${block.rightInsertCount}`,
                      )}
                    </span>
                    <button
                      onClick={() => applyDiffBlockFromRight(block)}
                      disabled={textReadOnlyPreview}
                    >
                      {t("Take right block", "采用右侧块")}
                    </button>
                  </header>
                  <div className="text-diff-block-body">
                    <pre className="left">{block.leftLines.join("\n") || "∅"}</pre>
                    <pre className="right">{block.rightLines.join("\n") || "∅"}</pre>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
      {showHexPanel ? (
        <section className="text-hex-panel">
          <div className="text-hex-head">
            <strong>{t("Hex View / Edit", "Hex 查看/编辑")}</strong>
            <span>
              {t(
                `Window ${HEX_WINDOW_BYTES} bytes · ${HEX_BYTES_PER_ROW} columns`,
                `窗口 ${HEX_WINDOW_BYTES} 字节 · 每行 ${HEX_BYTES_PER_ROW} 列`,
              )}
            </span>
            <span>
              {t(
                `Total ${formatByteSize(hexTotalBytes)} · current ${hexWindowBytes.length} bytes`,
                `总计 ${formatByteSize(hexTotalBytes)} · 当前 ${hexWindowBytes.length} 字节`,
              )}
            </span>
          </div>
          <div className="text-hex-tools-row">
            <button
              onClick={() => void loadPrevHexWindow()}
              disabled={hexLoading || hexBaseOffset <= 0}
            >
              {t("Prev window", "上一窗口")}
            </button>
            <button
              onClick={() => void loadNextHexWindow()}
              disabled={
                hexLoading ||
                (hexTotalBytes !== null && hexBaseOffset + hexWindowBytes.length >= hexTotalBytes)
              }
            >
              {t("Next window", "下一窗口")}
            </button>
            <label className="text-jump">
              <span>{t("Offset", "偏移")}</span>
              <input
                value={hexOffsetInput}
                onChange={(event) => setHexOffsetInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void loadHexFromInputOffset();
                }}
                inputMode="numeric"
              />
            </label>
            <button onClick={() => void loadHexFromInputOffset()} disabled={hexLoading}>
              {t("Go", "跳转")}
            </button>
            <button onClick={discardHexEdits} disabled={!hexEditedCount}>
              {t("Discard edits", "丢弃修改")}
            </button>
            <button
              onClick={() => void applyHexEdits()}
              disabled={hexLoading || !hexEditedCount || !textPath}
            >
              {t("Apply edits", "应用修改")}
            </button>
            <label className="text-jump">
              <span>{t("Byte", "字节")}</span>
              <input
                value={hexEditInput}
                onChange={(event) => setHexEditInput(event.target.value)}
                placeholder="FF"
              />
            </label>
            <button onClick={stageHexByteEdit} disabled={hexSelectedIndex === null}>
              {t("Stage byte", "暂存字节")}
            </button>
          </div>
          {hexNotice ? <div className="text-hex-notice">{hexNotice}</div> : null}
          <div className="text-hex-grid">
            {hexRows.map((row) => (
              <div key={`hex-row-${row.rowOffset}`} className="text-hex-row">
                <span className="offset">{`0x${(hexBaseOffset + row.rowOffset)
                  .toString(16)
                  .toUpperCase()
                  .padStart(8, "0")}`}</span>
                <div className="bytes">
                  {row.values.map((cell) => {
                    const selected = hexSelectedIndex === cell.index;
                    return (
                      <button
                        key={`hex-byte-${cell.index}`}
                        className={`hex-byte${cell.edited ? " edited" : ""}${selected ? " selected" : ""}`}
                        onClick={() => handleSelectHexByte(cell.index)}
                        title={`0x${(hexBaseOffset + cell.index).toString(16).toUpperCase()}`}
                      >
                        {toHexByte(cell.value)}
                      </button>
                    );
                  })}
                </div>
                <code className="ascii">{row.ascii}</code>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {showSyntaxPreview && syntaxPreviewSupported && !nativeSyntaxEditEnabled ? (
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
            {nativeSyntaxEditEnabled ? (
              <span>
                {t(
                  "Native edit active: changes sync to the editor below.",
                  "原生编辑已启用：修改会同步到下方编辑区。",
                )}
              </span>
            ) : null}
            {nativeSyntaxEditEnabled ? (
              <span>
                {t(
                  "Shortcuts: Mod+D / Mod+Shift+L / Mod+Shift+D / Alt+Shift+Up/Down / Alt+Shift+Arrows/Home/End/Page / Alt+Shift+I / Alt+Drag / Escape / F2 / Shift+F2 / Mod+F2 / Mod+Shift+\\",
                  "快捷键：Mod+D / Mod+Shift+L / Mod+Shift+D / Alt+Shift+上下 / Alt+Shift+方向/Home/End/Page / Alt+Shift+I / Alt+拖拽 / Escape / F2 / Shift+F2 / Mod+F2 / Mod+Shift+\\",
                )}
              </span>
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
                className={`text-syntax-preview-cm${nativeSyntaxEditEnabled ? " is-editable" : ""}`}
                value={syntaxPreviewContent}
                language={syntaxLanguage}
                activeLine={currentCaretLineIndex}
                selectionStart={nativeSyntaxEditEnabled ? editorSelection.start : undefined}
                selectionEnd={nativeSyntaxEditEnabled ? editorSelection.end : undefined}
                focusVersion={nativeSyntaxEditEnabled ? nativeFocusVersion : undefined}
                onLineClick={nativeSyntaxEditEnabled ? undefined : jumpToLineIndex}
                readOnly={!nativeSyntaxEditEnabled || textReplaceRunning}
                onChange={nativeSyntaxEditEnabled ? setTextContent : undefined}
                onSelectionChange={nativeSyntaxEditEnabled ? handleNativeSelectionChange : undefined}
                onKeyDown={nativeSyntaxEditEnabled ? handleNativePreviewKeyDown : undefined}
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
      <div className={`text-area-shell${showDocMapPanel ? " with-docmap" : ""}`}>
          {nativeSyntaxEditEnabled ? (
            <Suspense
              fallback={
                <div className="text-syntax-preview-loading">
                  {t("Loading native syntax engine...", "正在加载原生语法引擎...")}
                </div>
              }
            >
              <CodeMirrorPreview
                className="text-main-native-cm is-editable"
                value={textContent}
                language={syntaxLanguage}
                activeLine={currentCaretLineIndex}
                selectionStart={editorSelection.start}
                selectionEnd={editorSelection.end}
                focusVersion={nativeFocusVersion}
                readOnly={textReplaceRunning}
                onChange={setTextContent}
                onSelectionChange={handleNativeSelectionChange}
                onKeyDown={handleNativePreviewKeyDown}
              />
            </Suspense>
          ) : null}
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
          {markdownRenderedActive ? (
            <div className="text-markdown-inline" aria-hidden="true">
              <div
                className="text-markdown-inline-body"
                style={{
                  transform: `translate(${-editorScrollLeft}px, ${-editorScrollTop}px)`,
                }}
              >
                {markdownPreviewTooLarge ? (
                  <div className="text-markdown-inline-warning">
                    {t(
                      `Markdown preview truncated to ${MAX_MARKDOWN_PREVIEW_CHARS} chars for stability.`,
                      `为保证稳定性，Markdown 预览已截断为 ${MAX_MARKDOWN_PREVIEW_CHARS} 字符。`,
                    )}
                  </div>
                ) : null}
                {!markdownPreviewBlocks.length ? (
                  <div className="text-markdown-inline-empty">
                    {t("No markdown blocks parsed.", "未解析到 Markdown 块。")}
                  </div>
                ) : (
                  <div className="text-markdown-block-list">
                    {markdownPreviewBlocks.map((block: MarkdownPreviewBlock, index) => {
                      const active = index === activeMarkdownBlockIndex;
                      const blockHtml = renderMarkdownBlockHtml(block);
                      return (
                        <article
                          key={`md-inline-${block.kind}-${block.lineIndex}-${index}`}
                          className={`text-markdown-block markdown-kind-${block.kind}${active ? " active" : ""}`}
                        >
                          <div
                            className="content markdown-rendered-block"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: blockHtml || "&nbsp;" }}
                          />
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <textarea
            ref={textAreaRef}
            className={`text-area${textReadOnlyPreview ? " chunked" : ""}${showInlineSyntax ? " syntax-overlay" : ""}${markdownRenderedActive ? " markdown-overlay" : ""}${nativeSyntaxEditEnabled ? " native-shadow native-hidden" : ""}`}
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
            placeholder={t("Open a text file to start editing", "打开文本文件开始编辑")}
            spellCheck={false}
            tabIndex={nativeSyntaxEditEnabled ? -1 : undefined}
            readOnly={textReplaceRunning || nativeSyntaxEditEnabled}
          />
          {!nativeSyntaxEditEnabled && (multiCursorCount || bracketMatchHighlights.length) ? (
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
          {showDocMapPanel ? (
            <aside className="text-docmap-panel">
              <div className="text-docmap-head">
                <strong>{t("Document Map", "文档地图")}</strong>
                <span>
                  {t(
                    `Visible ${visibleStartLine + 1}-${visibleEndLine + 1}`,
                    `可见 ${visibleStartLine + 1}-${visibleEndLine + 1}`,
                  )}
                </span>
                <span>
                  {t(`Caret ${currentCaretLineIndex + 1}`, `光标 ${currentCaretLineIndex + 1}`)}
                </span>
              </div>
              <div
                className="text-docmap-track"
                onMouseDown={handleMinimapMouseDown}
                onMouseMove={handleMinimapMouseMove}
              >
                {minimapSegments.map((segment, index) => {
                  const top = (index / Math.max(1, minimapSegments.length)) * 100;
                  const height = 100 / Math.max(1, minimapSegments.length);
                  return (
                    <button
                      key={`seg-${segment.startLine}:${segment.endLine}`}
                      className="text-docmap-segment"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        opacity: 0.18 + segment.density * 0.7,
                      }}
                      onClick={() => jumpToLineIndex(segment.startLine)}
                      title={t(
                        `Line ${segment.startLine + 1}-${segment.endLine + 1}`,
                        `第 ${segment.startLine + 1}-${segment.endLine + 1} 行`,
                      )}
                    />
                  );
                })}
                <div
                  className="text-docmap-viewport"
                  style={{
                    top: `${Math.max(0, Math.min(100, minimapViewportTopPct))}%`,
                    height: `${Math.max(2, Math.min(100, minimapViewportHeightPct))}%`,
                  }}
                />
                <div
                  className="text-docmap-caret"
                  style={{
                    top: `${Math.max(0, Math.min(100, minimapCaretTopPct))}%`,
                  }}
                />
              </div>
              <div className="text-docmap-structure-head">
                <strong>{t("Structure", "结构")}</strong>
                <input
                  value={structureFilterInput}
                  onChange={(event) => setStructureFilterInput(event.target.value)}
                  placeholder={t("line/name", "行号/名称")}
                />
              </div>
              <div className="text-docmap-structure-list">
                {filteredStructureItems.map((item) => (
                  <button
                    key={`s-${item.lineIndex}:${item.label}`}
                    className={`text-docmap-item${item.lineIndex === activeStructureLine ? " active" : ""}`}
                    style={{
                      paddingLeft: `${6 + Math.min(item.depth, 6) * 10}px`,
                    }}
                    onClick={() => jumpToLineIndex(item.lineIndex)}
                  >
                    <span className="line">#{item.lineNumber}</span>
                    <span className="kind">{item.kind}</span>
                    <span className="label">{item.label}</span>
                  </button>
                ))}
                {!filteredStructureItems.length ? (
                  <div className="text-docmap-empty">
                    {t("No structure items.", "没有结构项。")}
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}
      </div>
      {showWhitespacePreview ? (
        <section className="text-whitespace-preview">
          <div className="text-whitespace-preview-head">
            <strong>{t("Whitespace Preview", "空白符预览")}</strong>
            <span>{t(`EOL: ${eolModeLabel}`, `换行: ${eolModeLabel}`)}</span>
            <span>
              {t(
                `Tabs: ${whitespaceStats.tabCount} · Trailing lines: ${whitespaceStats.trailingWhitespaceLines}`,
                `Tab: ${whitespaceStats.tabCount} · 行尾空白行: ${whitespaceStats.trailingWhitespaceLines}`,
              )}
            </span>
            {whitespacePreview?.truncated ? (
              <span>
                {t(
                  `Preview truncated at ${MAX_WHITESPACE_PREVIEW_CHARS} chars.`,
                  `预览已截断到 ${MAX_WHITESPACE_PREVIEW_CHARS} 字符。`,
                )}
              </span>
            ) : null}
            <span>{t("Legend: space=· tab=⇥ CR=␍ LF=␊", "图例: 空格=· Tab=⇥ CR=␍ LF=␊")}</span>
          </div>
          <pre className="text-whitespace-preview-body">{whitespacePreview?.preview ?? ""}</pre>
        </section>
      ) : null}
      {error ? <div className="banner error">{error}</div> : null}
    </section>
  );
}
