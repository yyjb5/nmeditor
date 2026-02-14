import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { invokeCmd } from "../tauriBridge";
import {
  TEXT_FIND_CONTEXT_ACTIVE_NEIGHBOR,
  TEXT_FIND_CONTEXT_BATCH_SIZE,
  TEXT_FIND_CONTEXT_CACHE_LIMIT,
  TEXT_FIND_GROUP_ITEMS_BATCH,
  TEXT_FIND_GROUP_RENDER_BATCH,
  TEXT_FIND_GROUPS_COLLAPSE_STORAGE_PREFIX,
  pruneTextFindContextCache,
} from "../utils/textFind";

type TextFindHit = { offset: number; length: number };

type UseTextFindResultsModelParams = {
  textFindHits: TextFindHit[];
  textFindResultPanelRange: { start: number; end: number };
  textReadOnlyPreview: boolean;
  textPreviewBytes: number | null;
  textPreviewOffset: number;
  largeTextPreviewBytes: number;
  textFindContextRadiusInput: string;
  setTextFindContextRadiusInput: Dispatch<SetStateAction<string>>;
  textPath: string | null;
  textFindQuery: string;
  textFindUseRegex: boolean;
  textFindMatchCase: boolean;
  activeTextFindIndex: number;
  textEncoding: string;
  t: (en: string, zh: string) => string;
};

export default function useTextFindResultsModel({
  textFindHits,
  textFindResultPanelRange,
  textReadOnlyPreview,
  textPreviewBytes,
  textPreviewOffset,
  largeTextPreviewBytes,
  textFindContextRadiusInput,
  setTextFindContextRadiusInput,
  textPath,
  textFindQuery,
  textFindUseRegex,
  textFindMatchCase,
  activeTextFindIndex,
  textEncoding,
  t,
}: UseTextFindResultsModelParams) {
  const [textFindContexts, setTextFindContexts] = useState<Record<number, string>>({});
  const [collapsedTextFindGroups, setCollapsedTextFindGroups] = useState<Record<number, boolean>>(
    {},
  );
  const [textFindRenderedGroupCount, setTextFindRenderedGroupCount] = useState(
    TEXT_FIND_GROUP_RENDER_BATCH,
  );
  const [textFindRenderedItemsByGroup, setTextFindRenderedItemsByGroup] = useState<
    Record<number, number>
  >({});
  const textFindContextTokenRef = useRef(0);
  const textFindCollapseLoadedKeyRef = useRef<string | null>(null);

  const resetTextFindResultsModel = useCallback(() => {
    textFindContextTokenRef.current += 1;
    setTextFindContexts({});
    setCollapsedTextFindGroups({});
    setTextFindRenderedGroupCount(TEXT_FIND_GROUP_RENDER_BATCH);
    setTextFindRenderedItemsByGroup({});
  }, []);

  const isTextHitInCurrentChunk = useCallback(
    (hit: TextFindHit) => {
      if (!textReadOnlyPreview || textPreviewBytes === null) return false;
      const end = textPreviewOffset + textPreviewBytes;
      return hit.offset >= textPreviewOffset && hit.offset < end;
    },
    [textPreviewBytes, textPreviewOffset, textReadOnlyPreview],
  );

  const textFindContextRadius = useMemo(() => {
    const parsed = Number.parseInt(textFindContextRadiusInput.trim(), 10);
    if (!Number.isFinite(parsed)) return 160;
    return Math.min(Math.max(parsed, 48), 4096);
  }, [textFindContextRadiusInput]);

  const textFindGroupCollapseStorageKey = useMemo(() => {
    const query = textFindQuery.trim();
    if (!textPath || !query) return null;
    return [
      TEXT_FIND_GROUPS_COLLAPSE_STORAGE_PREFIX,
      encodeURIComponent(textPath),
      encodeURIComponent(query),
      textFindUseRegex ? "re" : "literal",
      textFindMatchCase ? "case" : "nocase",
    ].join(":");
  }, [textFindMatchCase, textFindQuery, textFindUseRegex, textPath]);

  const normalizeTextFindContextRadiusInput = useCallback(() => {
    setTextFindContextRadiusInput(String(textFindContextRadius));
  }, [setTextFindContextRadiusInput, textFindContextRadius]);

  const visibleTextFindHits = useMemo(() => {
    return textFindHits
      .slice(textFindResultPanelRange.start, textFindResultPanelRange.end)
      .map((hit, localIndex) => {
        const index = textFindResultPanelRange.start + localIndex;
        return {
          index,
          hit,
          chunkIndex: Math.floor(hit.offset / largeTextPreviewBytes),
          inCurrentChunk: isTextHitInCurrentChunk(hit),
        };
      });
  }, [
    isTextHitInCurrentChunk,
    largeTextPreviewBytes,
    textFindHits,
    textFindResultPanelRange.end,
    textFindResultPanelRange.start,
  ]);

  const groupedVisibleTextFindHits = useMemo(() => {
    const groups: Array<{
      chunkIndex: number;
      startOffset: number;
      endOffset: number;
      inCurrentChunk: boolean;
      items: Array<{
        index: number;
        hit: TextFindHit;
        inCurrentChunk: boolean;
      }>;
    }> = [];
    visibleTextFindHits.forEach((item) => {
      const last = groups[groups.length - 1];
      if (!last || last.chunkIndex !== item.chunkIndex) {
        groups.push({
          chunkIndex: item.chunkIndex,
          startOffset: item.hit.offset,
          endOffset: item.hit.offset + Math.max(item.hit.length, 1),
          inCurrentChunk: item.inCurrentChunk,
          items: [
            {
              index: item.index,
              hit: item.hit,
              inCurrentChunk: item.inCurrentChunk,
            },
          ],
        });
        return;
      }
      last.endOffset = item.hit.offset + Math.max(item.hit.length, 1);
      last.inCurrentChunk = last.inCurrentChunk || item.inCurrentChunk;
      last.items.push({
        index: item.index,
        hit: item.hit,
        inCurrentChunk: item.inCurrentChunk,
      });
    });
    return groups;
  }, [visibleTextFindHits]);

  const activeTextFindChunkIndex = useMemo(() => {
    if (activeTextFindIndex < 0 || activeTextFindIndex >= textFindHits.length) return null;
    return Math.floor(textFindHits[activeTextFindIndex].offset / largeTextPreviewBytes);
  }, [activeTextFindIndex, largeTextPreviewBytes, textFindHits]);

  const orderedVisibleTextFindGroups = useMemo(() => {
    if (activeTextFindChunkIndex === null) return groupedVisibleTextFindHits;
    const activeGroups = groupedVisibleTextFindHits.filter(
      (group) => group.chunkIndex === activeTextFindChunkIndex,
    );
    if (!activeGroups.length) return groupedVisibleTextFindHits;
    const otherGroups = groupedVisibleTextFindHits.filter(
      (group) => group.chunkIndex !== activeTextFindChunkIndex,
    );
    return [...activeGroups, ...otherGroups];
  }, [activeTextFindChunkIndex, groupedVisibleTextFindHits]);

  const loadMoreTextFindGroupItems = useCallback((chunkIndex: number) => {
    setTextFindRenderedItemsByGroup((current) => {
      const currentCount = current[chunkIndex] ?? TEXT_FIND_GROUP_ITEMS_BATCH;
      const nextCount = currentCount + TEXT_FIND_GROUP_ITEMS_BATCH;
      return { ...current, [chunkIndex]: nextCount };
    });
  }, []);

  const renderedVisibleTextFindGroups = useMemo(() => {
    return orderedVisibleTextFindGroups
      .slice(0, textFindRenderedGroupCount)
      .map((group) => {
        const totalItems = group.items.length;
        const visibleItemCount = Math.min(
          totalItems,
          textFindRenderedItemsByGroup[group.chunkIndex] ?? TEXT_FIND_GROUP_ITEMS_BATCH,
        );
        return {
          ...group,
          totalItems,
          visibleItemCount,
          hasMoreItems: visibleItemCount < totalItems,
          items: group.items.slice(0, visibleItemCount),
        };
      });
  }, [orderedVisibleTextFindGroups, textFindRenderedGroupCount, textFindRenderedItemsByGroup]);

  const textFindHasMoreRenderedGroups =
    renderedVisibleTextFindGroups.length < orderedVisibleTextFindGroups.length;

  const loadMoreTextFindRenderedGroups = useCallback(() => {
    if (!textFindHasMoreRenderedGroups) return;
    setTextFindRenderedGroupCount((current) =>
      Math.min(current + TEXT_FIND_GROUP_RENDER_BATCH, orderedVisibleTextFindGroups.length),
    );
  }, [orderedVisibleTextFindGroups.length, textFindHasMoreRenderedGroups]);

  useEffect(() => {
    setTextFindRenderedGroupCount(TEXT_FIND_GROUP_RENDER_BATCH);
    setTextFindRenderedItemsByGroup({});
  }, [
    textFindMatchCase,
    textFindQuery,
    textFindResultPanelRange.start,
    textFindUseRegex,
    textPath,
  ]);

  useEffect(() => {
    if (activeTextFindIndex < 0) return;
    const activeGroupIndex = orderedVisibleTextFindGroups.findIndex((group) =>
      group.items.some((item) => item.index === activeTextFindIndex),
    );
    if (activeGroupIndex < 0) return;
    if (activeGroupIndex >= textFindRenderedGroupCount) {
      const nextCount =
        Math.ceil((activeGroupIndex + 1) / TEXT_FIND_GROUP_RENDER_BATCH) *
        TEXT_FIND_GROUP_RENDER_BATCH;
      setTextFindRenderedGroupCount(Math.min(orderedVisibleTextFindGroups.length, nextCount));
    }
    const activeGroup = orderedVisibleTextFindGroups[activeGroupIndex];
    const activeItemOffset = activeGroup.items.findIndex((item) => item.index === activeTextFindIndex);
    if (activeItemOffset >= 0) {
      setTextFindRenderedItemsByGroup((current) => {
        const currentCount = current[activeGroup.chunkIndex] ?? TEXT_FIND_GROUP_ITEMS_BATCH;
        if (activeItemOffset < currentCount) return current;
        const requiredCount =
          Math.ceil((activeItemOffset + 1) / TEXT_FIND_GROUP_ITEMS_BATCH) *
          TEXT_FIND_GROUP_ITEMS_BATCH;
        return { ...current, [activeGroup.chunkIndex]: requiredCount };
      });
    }
  }, [activeTextFindIndex, orderedVisibleTextFindGroups, textFindRenderedGroupCount]);

  useEffect(() => {
    if (!groupedVisibleTextFindHits.length) {
      setCollapsedTextFindGroups({});
      return;
    }
    const key = textFindGroupCollapseStorageKey;
    const keyChanged = textFindCollapseLoadedKeyRef.current !== key;
    let persisted: Record<number, boolean> = {};
    if (keyChanged) {
      textFindCollapseLoadedKeyRef.current = key;
      if (key) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            Object.entries(parsed).forEach(([chunkIndexRaw, collapsed]) => {
              const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
              if (!Number.isFinite(chunkIndex)) return;
              if (typeof collapsed !== "boolean") return;
              persisted[chunkIndex] = collapsed;
            });
          }
        } catch {
          persisted = {};
        }
      }
    }
    setCollapsedTextFindGroups((current) => {
      const source = keyChanged ? {} : current;
      const next: Record<number, boolean> = {};
      groupedVisibleTextFindHits.forEach((group) => {
        const existing = source[group.chunkIndex];
        if (typeof existing === "boolean") {
          next[group.chunkIndex] = existing;
          return;
        }
        const stored = persisted[group.chunkIndex];
        if (typeof stored === "boolean") {
          next[group.chunkIndex] = stored;
          return;
        }
        next[group.chunkIndex] = !group.inCurrentChunk && group.chunkIndex !== activeTextFindChunkIndex;
      });
      return next;
    });
  }, [activeTextFindChunkIndex, groupedVisibleTextFindHits, textFindGroupCollapseStorageKey]);

  useEffect(() => {
    if (!textFindGroupCollapseStorageKey || !groupedVisibleTextFindHits.length) return;
    const payload: Record<number, boolean> = {};
    groupedVisibleTextFindHits.forEach((group) => {
      payload[group.chunkIndex] = collapsedTextFindGroups[group.chunkIndex] ?? false;
    });
    try {
      window.localStorage.setItem(textFindGroupCollapseStorageKey, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, [collapsedTextFindGroups, groupedVisibleTextFindHits, textFindGroupCollapseStorageKey]);

  const toggleTextFindGroupCollapsed = useCallback((chunkIndex: number) => {
    setCollapsedTextFindGroups((current) => ({
      ...current,
      [chunkIndex]: !(current[chunkIndex] ?? false),
    }));
  }, []);

  const expandAllTextFindGroups = useCallback(() => {
    setCollapsedTextFindGroups((current) => {
      const next = { ...current };
      orderedVisibleTextFindGroups.forEach((group) => {
        next[group.chunkIndex] = false;
      });
      return next;
    });
  }, [orderedVisibleTextFindGroups]);

  const collapseAllTextFindGroups = useCallback(() => {
    setCollapsedTextFindGroups((current) => {
      const next = { ...current };
      orderedVisibleTextFindGroups.forEach((group) => {
        next[group.chunkIndex] = true;
      });
      return next;
    });
  }, [orderedVisibleTextFindGroups]);

  const visibleTextFindContextTargets = useMemo(() => {
    const targets: Array<{ index: number; hit: TextFindHit }> = [];
    renderedVisibleTextFindGroups.forEach((group) => {
      if (collapsedTextFindGroups[group.chunkIndex] ?? false) return;
      group.items.forEach((item) => {
        targets.push({ index: item.index, hit: item.hit });
      });
    });
    return targets;
  }, [collapsedTextFindGroups, renderedVisibleTextFindGroups]);

  const textFindContextPinnedIndices = useMemo(() => {
    const pinned = new Set<number>();
    visibleTextFindContextTargets.forEach((item) => {
      pinned.add(item.index);
    });
    if (activeTextFindIndex >= 0) {
      const start = Math.max(activeTextFindIndex - TEXT_FIND_CONTEXT_ACTIVE_NEIGHBOR, 0);
      const end = Math.min(
        activeTextFindIndex + TEXT_FIND_CONTEXT_ACTIVE_NEIGHBOR,
        textFindHits.length - 1,
      );
      for (let index = start; index <= end; index += 1) {
        pinned.add(index);
      }
    }
    return pinned;
  }, [activeTextFindIndex, textFindHits.length, visibleTextFindContextTargets]);

  const splitTextFindSnippet = useCallback(
    (snippet: string): { before: string; match: string; after: string } | null => {
      if (!snippet) return null;
      const query = textFindQuery;
      if (!query) return null;
      if (textFindUseRegex) {
        try {
          const regex = new RegExp(query, textFindMatchCase ? "" : "i");
          const match = regex.exec(snippet);
          if (!match || !match[0]) return null;
          const start = match.index ?? -1;
          if (start < 0) return null;
          const end = start + match[0].length;
          return {
            before: snippet.slice(0, start),
            match: snippet.slice(start, end),
            after: snippet.slice(end),
          };
        } catch {
          return null;
        }
      }
      const haystack = textFindMatchCase ? snippet : snippet.toLowerCase();
      const needle = textFindMatchCase ? query : query.toLowerCase();
      if (!needle) return null;
      const start = haystack.indexOf(needle);
      if (start < 0) return null;
      const end = start + needle.length;
      return {
        before: snippet.slice(0, start),
        match: snippet.slice(start, end),
        after: snippet.slice(end),
      };
    },
    [textFindMatchCase, textFindQuery, textFindUseRegex],
  );

  useEffect(() => {
    textFindContextTokenRef.current += 1;
    setTextFindContexts({});
  }, [
    textFindContextRadius,
    textFindHits,
    textFindMatchCase,
    textFindQuery,
    textFindUseRegex,
    textPath,
  ]);

  useEffect(() => {
    setTextFindContexts((current) =>
      pruneTextFindContextCache(
        current,
        textFindContextPinnedIndices,
        TEXT_FIND_CONTEXT_CACHE_LIMIT,
        activeTextFindIndex,
      ),
    );
  }, [activeTextFindIndex, textFindContextPinnedIndices]);

  useEffect(() => {
    if (!textReadOnlyPreview || !textPath || !visibleTextFindContextTargets.length) return;
    const pending = visibleTextFindContextTargets
      .filter((item) => textFindContexts[item.index] === undefined)
      .slice(0, TEXT_FIND_CONTEXT_BATCH_SIZE);
    if (!pending.length) return;
    const token = ++textFindContextTokenRef.current;
    let canceled = false;

    const decodeSnippet = (bytes: Uint8Array): string => {
      if (textEncoding === "UTF-16LE") {
        return new TextDecoder("utf-16le").decode(bytes);
      }
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return new TextDecoder("utf-8").decode(bytes);
      }
    };

    const normalizeSnippet = (raw: string): string => {
      const compact = raw
        .replace(/\r/g, " �?")
        .replace(/\n/g, " �?")
        .replace(/\t/g, " �?")
        .replace(/\s+/g, " ")
        .trim();
      if (!compact) return t("(empty snippet)", "（空片段�?");
      return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
    };

    const load = async () => {
      const nextEntries: Record<number, string> = {};
      for (const item of pending) {
        if (canceled || token !== textFindContextTokenRef.current) return;
        const radius = Math.max(item.hit.length * 2, textFindContextRadius);
        let offset = Math.max(item.hit.offset - radius, 0);
        let maxBytes = radius * 2 + Math.max(item.hit.length, 16);
        if (textEncoding === "UTF-16LE") {
          if (offset % 2 !== 0) offset -= 1;
          if (maxBytes % 2 !== 0) maxBytes += 1;
        }
        try {
          const rawBytes = await invokeCmd<number[]>("read_file_bytes_range", {
            path: textPath,
            offset,
            maxBytes,
          });
          if (canceled || token !== textFindContextTokenRef.current) return;
          let bytes = Uint8Array.from(rawBytes);
          if (textEncoding === "UTF-16LE" && bytes.length % 2 !== 0) {
            bytes = bytes.subarray(0, bytes.length - 1);
          }
          nextEntries[item.index] = normalizeSnippet(decodeSnippet(bytes));
        } catch {
          nextEntries[item.index] = t("(preview unavailable)", "（预览不可用�?");
        }
      }
      if (canceled || token !== textFindContextTokenRef.current) return;
      if (!Object.keys(nextEntries).length) return;
      setTextFindContexts((current) => {
        const merged = { ...current, ...nextEntries };
        return pruneTextFindContextCache(
          merged,
          textFindContextPinnedIndices,
          TEXT_FIND_CONTEXT_CACHE_LIMIT,
          activeTextFindIndex,
        );
      });
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [
    activeTextFindIndex,
    t,
    textEncoding,
    textFindContextPinnedIndices,
    textFindContextRadius,
    textFindContexts,
    textPath,
    textReadOnlyPreview,
    visibleTextFindContextTargets,
  ]);

  return {
    textFindContextRadius,
    normalizeTextFindContextRadiusInput,
    textFindContexts,
    collapsedTextFindGroups,
    renderedVisibleTextFindGroups,
    orderedVisibleTextFindGroups,
    textFindHasMoreRenderedGroups,
    loadMoreTextFindRenderedGroups,
    loadMoreTextFindGroupItems,
    toggleTextFindGroupCollapsed,
    expandAllTextFindGroups,
    collapseAllTextFindGroups,
    splitTextFindSnippet,
    resetTextFindResultsModel,
  };
}
