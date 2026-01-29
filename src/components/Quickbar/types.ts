export type DelimiterPreset = { label: string; value: string };

export type QuickbarProps = {
  locale: "en" | "zh";
  delimiter: string;
  delimiterApplied: string | null;
  delimiterPresets: DelimiterPreset[];
  loading: boolean;
  hasPreview: boolean;
  onLocaleChange: (value: "en" | "zh") => void;
  onDelimiterChange: (value: string) => void;
  onApplyDelimiter: () => void;
  autoFitEnabled: boolean;
  onToggleAutoFit: (value: boolean) => void;
  onAutoFitNow: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  t: (en: string, zh: string) => string;
};
