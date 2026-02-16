import type { SyntaxLanguage } from '../../utils/syntaxHighlight';

export type CodeMirrorPreviewProps = {
  value: string;
  language: SyntaxLanguage;
  className?: string;
  activeLine?: number;
  selectionStart?: number;
  selectionEnd?: number;
  focusVersion?: number;
  readOnly?: boolean;
  onLineClick?: (lineIndex: number) => void;
  onChange?: (value: string) => void;
  onSelectionChange?: (
    start: number,
    end: number,
    ranges: Array<{ start: number; end: number }>,
  ) => void;
  onKeyDown?: (event: KeyboardEvent) => boolean;
};

