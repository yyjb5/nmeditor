export type StatusBarProps = {
  loading: boolean;
  loadingRows: boolean;
  hasPreview: boolean;
  eof: boolean;
  rowsLength: number;
  visibleCount: number;
  patchCount: number;
  macroAppliedCount: number;
  findAppliedCount: number;
  indexing: boolean;
  indexProgress: number;
  indexCanceled: boolean;
  onCancelIndex?: () => void;
  t: (en: string, zh: string) => string;
};
