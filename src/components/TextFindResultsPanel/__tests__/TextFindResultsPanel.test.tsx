import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TextFindResultsPanel from "../index";
import type { TextFindResultsPanelProps } from "../types";

const t = (en: string) => en;

const buildProps = (
  overrides: Partial<TextFindResultsPanelProps> = {},
): TextFindResultsPanelProps => ({
  t,
  textLoading: false,
  textReplaceRunning: false,
  textFindHits: [{ offset: 10, length: 3 }],
  textFindHasMore: false,
  textFindResultPanelRange: { start: 0, end: 1 },
  textFindResultPanelPageInfo: { currentPage: 1, totalPages: 1 },
  textFindResultPanelVisiblePages: 1,
  textFindResultPanelCanLoadMore: false,
  renderedVisibleTextFindGroups: [
    {
      chunkIndex: 0,
      startOffset: 10,
      endOffset: 13,
      inCurrentChunk: true,
      items: [{ index: 0, hit: { offset: 10, length: 3 }, inCurrentChunk: true }],
      totalItems: 10,
      visibleItemCount: 1,
      hasMoreItems: true,
    },
  ],
  orderedVisibleTextFindGroups: [
    {
      chunkIndex: 0,
      startOffset: 10,
      endOffset: 13,
      inCurrentChunk: true,
      items: [{ index: 0, hit: { offset: 10, length: 3 }, inCurrentChunk: true }],
    },
  ],
  collapsedTextFindGroups: {},
  textFindContexts: { 0: "hello world" },
  textFindHitJumpInput: "1",
  textFindOffsetJumpInput: "0",
  textFindContextRadiusInput: "160",
  activeTextFindIndex: 0,
  textFindHasMoreRenderedGroups: false,
  formatByteSize: (bytes) => String(bytes ?? 0),
  setTextFindHitJumpInput: vi.fn(),
  setTextFindOffsetJumpInput: vi.fn(),
  setTextFindContextRadiusInput: vi.fn(),
  jumpToTextFindHit: vi.fn(async () => {}),
  jumpTextFindPrev: vi.fn(),
  jumpTextFindNext: vi.fn(),
  jumpTextFindResultPageFirst: vi.fn(),
  jumpTextFindResultPage: vi.fn(),
  jumpTextFindResultPageLast: vi.fn(),
  loadMoreTextFindResultPages: vi.fn(),
  loadMoreTextFindRenderedGroups: vi.fn(),
  expandAllTextFindGroups: vi.fn(),
  collapseAllTextFindGroups: vi.fn(),
  jumpToTextFindHitFromInput: vi.fn(),
  jumpToTextFindHitFromOffsetInput: vi.fn(),
  normalizeTextFindContextRadiusInput: vi.fn(),
  handleTextFindResultsScroll: vi.fn(),
  toggleTextFindGroupCollapsed: vi.fn(),
  loadMoreTextFindGroupItems: vi.fn(),
  splitTextFindSnippet: () => null,
  ...overrides,
});

describe("TextFindResultsPanel", () => {
  it("auto loads group items when scrolled to bottom and no more pages/groups", () => {
    const handleTextFindResultsScroll = vi.fn();
    const loadMoreTextFindGroupItems = vi.fn();
    const props = buildProps({
      handleTextFindResultsScroll,
      loadMoreTextFindGroupItems,
    });
    const { container } = render(<TextFindResultsPanel {...props} />);
    const list = container.querySelector(".text-find-results-list") as HTMLDivElement;
    expect(list).toBeTruthy();

    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(list, "scrollTop", { value: 590, configurable: true, writable: true });
    fireEvent.scroll(list);

    expect(handleTextFindResultsScroll).toHaveBeenCalledTimes(1);
    expect(loadMoreTextFindGroupItems).toHaveBeenCalledWith(0);
  });
});

