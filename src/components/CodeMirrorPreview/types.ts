import type { SyntaxLanguage } from '../../utils/syntaxHighlight';

export type CodeMirrorPreviewProps = {
  value: string;
  language: SyntaxLanguage;
  className?: string;
  activeLine?: number;
  onLineClick?: (lineIndex: number) => void;
};

