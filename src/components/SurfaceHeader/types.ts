export type SurfaceHeaderProps = {
  activePath: string | null;
  delimiter: string;
  delimiterApplied: string | null;
  rowsLength: number;
  previewDelimiter?: string;
  t: (en: string, zh: string) => string;
};
