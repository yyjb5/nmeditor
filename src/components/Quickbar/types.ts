export type DelimiterPreset = { label: string; value: string };

export type QuickbarProps = {
  locale: "en" | "zh";
  delimiter: string;
  delimiterApplied: string | null;
  delimiterPresets: DelimiterPreset[];
  loading: boolean;
  loadingRows: boolean;
  eof: boolean;
  hasPreview: boolean;
  onLocaleChange: (value: "en" | "zh") => void;
  onDelimiterChange: (value: string) => void;
  onApplyDelimiter: () => void;
  onLoadMore: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFindReplaceLoaded: () => void;
  onMacroLoaded: () => void;
  canUndo: boolean;
  canRedo: boolean;
  t: (en: string, zh: string) => string;
};
