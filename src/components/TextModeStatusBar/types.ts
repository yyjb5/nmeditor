export type TextModeStatusBarProps = {
  t: (en: string, zh: string) => string;
  textLoading: boolean;
  textPath: string | null;
  textContent: string;
  textReplaceRunning: boolean;
  textReplaceProgress: number;
  textReplaceScannedBytes: number | null;
  textReplaceAppliedCount: number | null;
  textReplaceElapsedMs: number | null;
  textFindRunning: boolean;
  textFindProgress: number;
  textFindScannedBytes: number | null;
  textFindMatchedCount: number | null;
  textFindHasMore: boolean;
  textFindElapsedMs: number | null;
  formatByteSize: (bytes: number | null) => string;
};
