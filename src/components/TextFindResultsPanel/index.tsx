import type { UIEvent } from "react";
import type { TextFindResultsPanelProps } from "./types";
import "./styles.css";

export default function TextFindResultsPanel({
  t,
  textLoading,
  textReplaceRunning,
  textFindHits,
  textFindHasMore,
  textFindResultPanelRange,
  textFindResultPanelPageInfo,
  textFindResultPanelVisiblePages,
  textFindResultPanelCanLoadMore,
  renderedVisibleTextFindGroups,
  orderedVisibleTextFindGroups,
  collapsedTextFindGroups,
  textFindContexts,
  textFindHitJumpInput,
  textFindOffsetJumpInput,
  textFindContextRadiusInput,
  activeTextFindIndex,
  textFindHasMoreRenderedGroups,
  formatByteSize,
  setTextFindHitJumpInput,
  setTextFindOffsetJumpInput,
  setTextFindContextRadiusInput,
  jumpToTextFindHit,
  jumpTextFindPrev,
  jumpTextFindNext,
  jumpTextFindResultPageFirst,
  jumpTextFindResultPage,
  jumpTextFindResultPageLast,
  loadMoreTextFindResultPages,
  loadMoreTextFindRenderedGroups,
  expandAllTextFindGroups,
  collapseAllTextFindGroups,
  jumpToTextFindHitFromInput,
  jumpToTextFindHitFromOffsetInput,
  normalizeTextFindContextRadiusInput,
  handleTextFindResultsScroll,
  toggleTextFindGroupCollapsed,
  loadMoreTextFindGroupItems,
  splitTextFindSnippet,
}: TextFindResultsPanelProps) {
  const handleResultsListScroll = (event: UIEvent<HTMLDivElement>) => {
    handleTextFindResultsScroll(event);
    const target = event.currentTarget;
    const distanceToBottom = target.scrollHeight - (target.scrollTop + target.clientHeight);
    if (distanceToBottom > 18) return;
    if (textFindResultPanelCanLoadMore || textFindHasMoreRenderedGroups) return;
    const candidate = [...renderedVisibleTextFindGroups]
      .reverse()
      .find((group) => !(collapsedTextFindGroups[group.chunkIndex] ?? false) && group.hasMoreItems);
    if (!candidate) return;
    loadMoreTextFindGroupItems(candidate.chunkIndex);
  };

  return (
    <section className="text-find-results-panel">
      <div className="text-find-results-head">
        <strong>{t("Find results", "查找结果")}</strong>
        <span>
          {t(
            `showing ${textFindResultPanelRange.start + 1}-${textFindResultPanelRange.end} / ${textFindHits.length}`,
            `显示 ${textFindResultPanelRange.start + 1}-${textFindResultPanelRange.end} / ${textFindHits.length}`,
          )}
        </span>
        <span>
          {t(
            `page ${textFindResultPanelPageInfo.currentPage}/${textFindResultPanelPageInfo.totalPages}`,
            `ҳ ${textFindResultPanelPageInfo.currentPage}/${textFindResultPanelPageInfo.totalPages}`,
          )}
        </span>
        <span>
          {t(
            `loaded ${textFindResultPanelVisiblePages} page(s)`,
            `�Ѽ��� ${textFindResultPanelVisiblePages} ҳ`,
          )}
        </span>
        <span>
          {t(
            `groups ${renderedVisibleTextFindGroups.length}/${orderedVisibleTextFindGroups.length}`,
            `分组 ${renderedVisibleTextFindGroups.length}/${orderedVisibleTextFindGroups.length}`,
          )}
        </span>
        {textFindHasMore ? <em>{t("truncated", "已截�?")}</em> : null}
      </div>
      <div className="text-find-results-tools">
        <button
          onClick={() => void jumpToTextFindHit(0)}
          disabled={textLoading || textReplaceRunning || !textFindHits.length}
        >
          {t("First", "首条")}
        </button>
        <button
          onClick={jumpTextFindPrev}
          disabled={textLoading || textReplaceRunning || !textFindHits.length}
        >
          {t("Prev", "上一�?")}
        </button>
        <button
          onClick={jumpTextFindNext}
          disabled={textLoading || textReplaceRunning || !textFindHits.length}
        >
          {t("Next", "下一�?")}
        </button>
        <button
          onClick={() => void jumpToTextFindHit(textFindHits.length - 1)}
          disabled={textLoading || textReplaceRunning || !textFindHits.length}
        >
          {t("Last", "末条")}
        </button>
        <button
          onClick={jumpTextFindResultPageFirst}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            textFindResultPanelRange.start <= 0
          }
        >
          {t("First page", "首页")}
        </button>
        <button
          onClick={() => jumpTextFindResultPage(-1)}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            textFindResultPanelRange.start <= 0
          }
        >
          {t("Prev page", "上一�?")}
        </button>
        <button
          onClick={() => jumpTextFindResultPage(1)}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            textFindResultPanelRange.end >= textFindHits.length
          }
        >
          {t("Next page", "下一�?")}
        </button>
        <button
          onClick={jumpTextFindResultPageLast}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            textFindResultPanelRange.end >= textFindHits.length
          }
        >
          {t("Last page", "ĩҳ")}
        </button>
        <button
          onClick={loadMoreTextFindResultPages}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            !textFindResultPanelCanLoadMore
          }
        >
          {t("Load more", "���ظ���")}
        </button>
        <button
          onClick={loadMoreTextFindRenderedGroups}
          disabled={
            textLoading ||
            textReplaceRunning ||
            !textFindHits.length ||
            !textFindHasMoreRenderedGroups
          }
        >
          {t("Load groups", "加载更多分组")}
        </button>
        <button
          onClick={expandAllTextFindGroups}
          disabled={textLoading || textReplaceRunning || !orderedVisibleTextFindGroups.length}
        >
          {t("Expand all", "展开全部")}
        </button>
        <button
          onClick={collapseAllTextFindGroups}
          disabled={textLoading || textReplaceRunning || !orderedVisibleTextFindGroups.length}
        >
          {t("Collapse all", "折叠全部")}
        </button>
        <label className="text-find-hit-jump">
          <span>{t("Hit", "命中")}</span>
          <input
            value={textFindHitJumpInput}
            onChange={(event) => setTextFindHitJumpInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              jumpToTextFindHitFromInput();
            }}
            inputMode="numeric"
            disabled={textLoading || textReplaceRunning || !textFindHits.length}
          />
          <button
            onClick={jumpToTextFindHitFromInput}
            disabled={textLoading || textReplaceRunning || !textFindHits.length}
          >
            {t("Go", "跳转")}
          </button>
        </label>
        <label className="text-find-offset-jump">
          <span>{t("Offset", "Offset")}</span>
          <input
            value={textFindOffsetJumpInput}
            onChange={(event) => setTextFindOffsetJumpInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              jumpToTextFindHitFromOffsetInput();
            }}
            inputMode="numeric"
            disabled={textLoading || textReplaceRunning || !textFindHits.length}
          />
          <button
            onClick={jumpToTextFindHitFromOffsetInput}
            disabled={textLoading || textReplaceRunning || !textFindHits.length}
          >
            {t("Go", "跳转")}
          </button>
        </label>
        <label className="text-find-context-size">
          <span>{t("Ctx", "上下�?")}</span>
          <input
            value={textFindContextRadiusInput}
            onChange={(event) => setTextFindContextRadiusInput(event.target.value)}
            onBlur={normalizeTextFindContextRadiusInput}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              normalizeTextFindContextRadiusInput();
            }}
            inputMode="numeric"
            disabled={textLoading || textReplaceRunning || !textFindHits.length}
          />
          <span>{t("bytes", "字节")}</span>
        </label>
      </div>
      <div className="text-find-results-list" onScroll={handleResultsListScroll}>
        {renderedVisibleTextFindGroups.map((group) => {
          const collapsed = collapsedTextFindGroups[group.chunkIndex] ?? false;
          return (
            <div
              key={`text-hit-group-${group.chunkIndex}`}
              className={`text-find-group${group.inCurrentChunk ? " current" : ""}`}
            >
              <button
                type="button"
                className="text-find-group-toggle"
                onClick={() => toggleTextFindGroupCollapsed(group.chunkIndex)}
              >
                <span className="text-find-group-caret">{collapsed ? "?" : "?"}</span>
                <strong>
                  {t(
                    `Chunk ${group.chunkIndex + 1}`,
                    `分段 ${group.chunkIndex + 1}`,
                  )}
                </strong>
                <span>
                  {t(
                    `offset ${formatByteSize(group.startOffset)} - ${formatByteSize(group.endOffset)}`,
                    `偏移 ${formatByteSize(group.startOffset)} - ${formatByteSize(group.endOffset)}`,
                  )}
                </span>
                <span>{t(`${group.totalItems} hits`, `${group.totalItems} hits`)}</span>
                {group.inCurrentChunk ? <em>{t("current view", "当前视图")}</em> : null}
              </button>
              {!collapsed
                ? group.items.map(({ hit, index, inCurrentChunk }) => {
                    const snippet = textFindContexts[index];
                    const parts = snippet ? splitTextFindSnippet(snippet) : null;
                    return (
                      <button
                        key={`${hit.offset}:${hit.length}:${index}`}
                        id={`text-find-hit-${index}`}
                        className={`text-find-result-item${index === activeTextFindIndex ? " active" : ""}`}
                        onClick={() => void jumpToTextFindHit(index)}
                        disabled={textLoading || textReplaceRunning}
                      >
                        <span>#{index + 1}</span>
                        <span className="text-find-result-main">
                          <span className="text-find-result-offset">
                            {t(
                              `offset ${hit.offset} (${formatByteSize(hit.offset)})`,
                              `offset ${hit.offset} (${formatByteSize(hit.offset)})`,
                            )}
                          </span>
                          <span className="text-find-result-snippet">
                            {snippet ? (
                              parts ? (
                                <>
                                  <span>{parts.before}</span>
                                  <mark className="text-find-result-mark">{parts.match}</mark>
                                  <span>{parts.after}</span>
                                </>
                              ) : (
                                snippet
                              )
                            ) : (
                              t("Loading preview...", "加载预览�?..")
                            )}
                          </span>
                        </span>
                        <span className="text-find-result-tail">
                          <span>{t(`len ${hit.length}`, `长度 ${hit.length}`)}</span>
                          <span className={`text-find-hit-badge${inCurrentChunk ? " in-chunk" : ""}`}>
                            {inCurrentChunk
                              ? t("in chunk", "当前分段")
                              : t("out chunk", "非当前分�?")}
                          </span>
                        </span>
                      </button>
                    );
                  })
                : null}
              {!collapsed && group.hasMoreItems ? (
                <div className="text-find-group-more">
                  <span>
                    {t(
                      `showing ${group.visibleItemCount}/${group.totalItems}`,
                      `显示 ${group.visibleItemCount}/${group.totalItems}`,
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadMoreTextFindGroupItems(group.chunkIndex)}
                    disabled={textLoading || textReplaceRunning}
                  >
                    {t("Load group hits", "加载分组命中")}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {textFindHasMoreRenderedGroups ? (
        <div className="text-find-results-more">
          <span>
            {t(
              `Rendered ${renderedVisibleTextFindGroups.length} of ${orderedVisibleTextFindGroups.length} groups.`,
              `已渲染 ${renderedVisibleTextFindGroups.length}/${orderedVisibleTextFindGroups.length} 个分组。`,
            )}
          </span>
          <button onClick={loadMoreTextFindRenderedGroups} disabled={textLoading || textReplaceRunning}>
            {t("Load next groups", "继续加载分组")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
