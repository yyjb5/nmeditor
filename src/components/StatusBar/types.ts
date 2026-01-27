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
  t: (en: string, zh: string) => string;
};
