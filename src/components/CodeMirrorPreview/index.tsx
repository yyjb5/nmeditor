import { useEffect, useMemo, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { highlightActiveLine, keymap, EditorView, lineNumbers } from "@codemirror/view";
import { basicSetup } from "codemirror";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from "@codemirror/language";
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

export default function CodeMirrorPreview({
  value,
  language,
  className,
  activeLine,
  onLineClick,
}: CodeMirrorPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef<Compartment>(new Compartment());
  const readOnlyCompartmentRef = useRef<Compartment>(new Compartment());
  const onLineClickRef = useRef(onLineClick);

  useEffect(() => {
    onLineClickRef.current = onLineClick;
  }, [onLineClick]);

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
      }),
      EditorView.editable.of(false),
      readOnlyCompartmentRef.current.of(EditorState.readOnly.of(true)),
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
    [language],
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
    ? `cm-preview-root ${className}`
    : "cm-preview-root";

  return <div className={classes} ref={hostRef} />;
}
