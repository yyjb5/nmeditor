export type FindBarProps = {
  findText: string;
  replaceText: string;
  useRegex: boolean;
  matchCase: boolean;
  onFindChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onToggleRegex: (checked: boolean) => void;
  onToggleMatchCase: (checked: boolean) => void;
  onApply: () => void;
  onApplyFile: () => void;
  disabled: boolean;
  t: (en: string, zh: string) => string;
};
