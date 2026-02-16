import { useEffect, useMemo, useRef } from "react";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from "@codemirror/state";
import {
  highlightActiveLine,
  keymap,
  EditorView,
  lineNumbers,
  rectangularSelection,
  crosshairCursor,
  type Command,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from "@codemirror/language";
import { addCursorAbove, addCursorBelow, simplifySelection } from "@codemirror/commands";
import { selectNextOccurrence, selectSelectionMatches } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import type { SyntaxLanguage } from "../../utils/syntaxHighlight";
import type { CodeMirrorPreviewProps } from "./types";
import "./styles.css";

const resolveLanguageExtension = (language: SyntaxLanguage): Extension => {
  if (language === "javascript") {
    return javascript();
  }
  if (language === "typescript") {
    return javascript({ typescript: true });
  }
  if (language === "json") {
    return json();
  }
  if (language === "python") {
    return python();
  }
  if (language === "rust") {
    return rust();
  }
  if (language === "sql") {
    return sql();
  }
  return [];
};

const removeLastSelectionCommand: Command = (view) => {
  const ranges = view.state.selection.ranges;
  if (ranges.length <= 1) return false;
  const nextRanges = ranges.slice(0, ranges.length - 1);
  const nextMain = Math.min(view.state.selection.mainIndex, nextRanges.length - 1);
  view.dispatch({
    selection: EditorSelection.create(nextRanges, nextMain),
    userEvent: "select",
    scrollIntoView: true,
  });
  return true;
};

const addLineEndCursorsCommand: Command = (view) => {
  const ranges = view.state.selection.ranges;
  if (!ranges.length) return false;
  const doc = view.state.doc;
  const lineNumbers = new Set<number>();
  for (const range of ranges) {
    const fromLine = doc.lineAt(range.from).number;
    const lastPos =
      range.from === range.to
        ? range.to
        : Math.max(range.from, Math.min(doc.length, range.to - 1));
    const toLine = doc.lineAt(lastPos).number;
    for (let lineNo = fromLine; lineNo <= toLine; lineNo += 1) {
      lineNumbers.add(lineNo);
    }
  }
  if (!lineNumbers.size) return false;
  const existingHeads = new Set(ranges.map((range) => range.head));
  const nextRanges = [...ranges];
  for (const lineNo of Array.from(lineNumbers).sort((a, b) => a - b)) {
    const line = doc.line(lineNo);
    const cursor = line.to;
    if (existingHeads.has(cursor)) continue;
    existingHeads.add(cursor);
    nextRanges.push(EditorSelection.cursor(cursor));
  }
  if (nextRanges.length === ranges.length) return false;
  view.dispatch({
    selection: EditorSelection.create(
      nextRanges,
      Math.min(view.state.selection.mainIndex, nextRanges.length - 1),
    ),
    userEvent: "select",
    scrollIntoView: true,
  });
  return true;
};

export default function CodeMirrorPreview({
  value,
  language,
  className,
  activeLine,
  selectionStart,
  selectionEnd,
  focusVersion,
  readOnly = true,
  onLineClick,
  onChange,
  onSelectionChange,
  onKeyDown,
}: CodeMirrorPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef<Compartment>(new Compartment());
  const editableCompartmentRef = useRef<Compartment>(new Compartment());
  const userKeymapCompartmentRef = useRef<Compartment>(new Compartment());
  const rectangularSelectionCompartmentRef = useRef<Compartment>(new Compartment());
  const readOnlyCompartmentRef = useRef<Compartment>(new Compartment());
  const onLineClickRef = useRef(onLineClick);
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onKeyDownRef = useRef(onKeyDown);

  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    onKeyDownRef.current = onKeyDown;
  }, [onKeyDown]);

  const editableSelectionKeymap = useMemo<Extension>(() => {
    if (readOnly) return [];
    return keymap.of([
      { key: "Mod-d", run: selectNextOccurrence },
      { key: "Mod-Shift-l", run: selectSelectionMatches },
      { key: "Mod-Shift-d", run: removeLastSelectionCommand },
      { key: "Alt-Shift-ArrowUp", run: addCursorAbove },
      { key: "Alt-Shift-ArrowDown", run: addCursorBelow },
      { key: "Alt-Shift-i", run: addLineEndCursorsCommand },
      { key: "Escape", run: simplifySelection },
    ]);
  }, [readOnly]);

  const editableRectangularSelection = useMemo<Extension>(() => {
    if (readOnly) return [];
    return [rectangularSelection(), crosshairCursor()];
  }, [readOnly]);

  const editorExtensions = useMemo<Extension[]>(
    () => [
      basicSetup,
      lineNumbers(),
      highlightActiveLine(),
      foldGutter(),
      keymap.of(foldKeymap),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        mousedown(event, view) {
          const handleLineClick = onLineClickRef.current;
          if (!handleLineClick) return false;
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos == null) return false;
          const lineNumber = view.state.doc.lineAt(pos).number;
          handleLineClick(lineNumber - 1);
          return false;
        },
        keydown(event) {
          const handleKeyDown = onKeyDownRef.current;
          if (!handleKeyDown) return false;
          return handleKeyDown(event);
        },
      }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const changedByUser = update.transactions.some(
          (transaction) =>
            transaction.isUserEvent("input") ||
            transaction.isUserEvent("delete") ||
            transaction.isUserEvent("move") ||
            transaction.isUserEvent("undo") ||
            transaction.isUserEvent("redo") ||
            transaction.isUserEvent("paste") ||
            transaction.isUserEvent("cut"),
        );
        if (!changedByUser) return;
        const handleChange = onChangeRef.current;
        if (!handleChange) return;
        handleChange(update.state.doc.toString());
      }),
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet) return;
        const handleSelectionChange = onSelectionChangeRef.current;
        if (!handleSelectionChange) return;
        const range = update.state.selection.main;
        const ranges = update.state.selection.ranges.map((selectionRange) => ({
          start: selectionRange.from,
          end: selectionRange.to,
        }));
        handleSelectionChange(range.from, range.to, ranges);
      }),
      editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(readOnly)),
      userKeymapCompartmentRef.current.of(editableSelectionKeymap),
      rectangularSelectionCompartmentRef.current.of(editableRectangularSelection),
      languageCompartmentRef.current.of(resolveLanguageExtension(language)),
      EditorView.theme({
        "&": {
          backgroundColor: "#ffffff",
          color: "#0f172a",
          height: "100%",
        },
        ".cm-content": {
          fontFamily: '"Consolas", "SFMono-Regular", ui-monospace, monospace',
          fontSize: "12px",
          lineHeight: "1.5",
        },
        ".cm-activeLine": {
          backgroundColor: "#eff6ff",
        },
      }),
    ],
    [editableRectangularSelection, editableSelectionKeymap, language, readOnly],
  );

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: editorExtensions,
    });
    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [editorExtensions, value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: value,
      },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartmentRef.current.reconfigure(
        resolveLanguageExtension(language),
      ),
    });
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly)),
        readOnlyCompartmentRef.current.reconfigure(EditorState.readOnly.of(readOnly)),
        userKeymapCompartmentRef.current.reconfigure(editableSelectionKeymap),
        rectangularSelectionCompartmentRef.current.reconfigure(
          editableRectangularSelection,
        ),
      ],
    });
  }, [editableRectangularSelection, editableSelectionKeymap, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (
      selectionStart == null ||
      selectionEnd == null ||
      Number.isNaN(selectionStart) ||
      Number.isNaN(selectionEnd)
    ) {
      return;
    }
    const docLen = view.state.doc.length;
    const from = Math.max(0, Math.min(Math.floor(selectionStart), docLen));
    const to = Math.max(0, Math.min(Math.floor(selectionEnd), docLen));
    const current = view.state.selection.main;
    if (current.from === from && current.to === to) return;
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
    });
  }, [selectionEnd, selectionStart]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (focusVersion == null) return;
    view.focus();
    view.dispatch({ scrollIntoView: true });
  }, [focusVersion]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (activeLine == null || Number.isNaN(activeLine)) return;
    const lineNumber = Math.min(
      Math.max(1, Math.floor(activeLine) + 1),
      Math.max(1, view.state.doc.lines),
    );
    const line = view.state.doc.line(lineNumber);
    const head = view.state.selection.main.head;
    if (head === line.from && view.state.selection.main.empty) return;
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
  }, [activeLine]);

  const classes = className
    ? `cm-preview-root ${readOnly ? "is-readonly" : "is-editable"} ${className}`
    : `cm-preview-root ${readOnly ? "is-readonly" : "is-editable"}`;

  return <div className={classes} ref={hostRef} />;
}
