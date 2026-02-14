import type { UIEvent } from "react";

export type TextFindHit = {
  offset: number;
  length: number;
};

export type TextFindSnippetParts = {
  before: string;
  match: string;
  after: string;
};

export type TextFindGroupItem = {
  index: number;
  hit: TextFindHit;
  inCurrentChunk: boolean;
};

export type RenderedTextFindGroup = {
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  inCurrentChunk: boolean;
  items: TextFindGroupItem[];
  totalItems: number;
  visibleItemCount: number;
  hasMoreItems: boolean;
};

export type TextFindGroup = {
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  inCurrentChunk: boolean;
  items: TextFindGroupItem[];
};

export type TextFindResultsPanelProps = {
  t: (en: string, zh: string) => string;
  textLoading: boolean;
  textReplaceRunning: boolean;
  textFindHits: TextFindHit[];
  textFindHasMore: boolean;
  textFindResultPanelRange: { start: number; end: number };
  textFindResultPanelPageInfo: { currentPage: number; totalPages: number };
  textFindResultPanelVisiblePages: number;
  textFindResultPanelCanLoadMore: boolean;
  renderedVisibleTextFindGroups: RenderedTextFindGroup[];
  orderedVisibleTextFindGroups: TextFindGroup[];
  collapsedTextFindGroups: Record<number, boolean>;
  textFindContexts: Record<number, string>;
  textFindHitJumpInput: string;
  textFindOffsetJumpInput: string;
  textFindContextRadiusInput: string;
  activeTextFindIndex: number;
  textFindHasMoreRenderedGroups: boolean;
  formatByteSize: (bytes: number | null) => string;
  setTextFindHitJumpInput: (value: string) => void;
  setTextFindOffsetJumpInput: (value: string) => void;
  setTextFindContextRadiusInput: (value: string) => void;
  jumpToTextFindHit: (index: number) => Promise<void>;
  jumpTextFindPrev: () => void;
  jumpTextFindNext: () => void;
  jumpTextFindResultPageFirst: () => void;
  jumpTextFindResultPage: (delta: -1 | 1) => void;
  jumpTextFindResultPageLast: () => void;
  loadMoreTextFindResultPages: () => void;
  loadMoreTextFindRenderedGroups: () => void;
  expandAllTextFindGroups: () => void;
  collapseAllTextFindGroups: () => void;
  jumpToTextFindHitFromInput: () => void;
  jumpToTextFindHitFromOffsetInput: () => void;
  normalizeTextFindContextRadiusInput: () => void;
  handleTextFindResultsScroll: (event: UIEvent<HTMLDivElement>) => void;
  toggleTextFindGroupCollapsed: (chunkIndex: number) => void;
  loadMoreTextFindGroupItems: (chunkIndex: number) => void;
  splitTextFindSnippet: (snippet: string) => TextFindSnippetParts | null;
};
