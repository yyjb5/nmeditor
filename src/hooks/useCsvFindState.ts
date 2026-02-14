import { useState } from "react";
import type { FindMatch, FindMatchSource } from "../types";

export default function useCsvFindState() {
  const [findMatches, setFindMatches] = useState<FindMatch[]>([]);
  const [findMatchesSource, setFindMatchesSource] = useState<FindMatchSource>("loaded");
  const [findMatchesHasMore, setFindMatchesHasMore] = useState(false);
  const [findJobId, setFindJobId] = useState<number | null>(null);
  const [findProgress, setFindProgress] = useState(0);
  const [findRunning, setFindRunning] = useState(false);
  const [findCanceled, setFindCanceled] = useState(false);
  const [findMatchedCount, setFindMatchedCount] = useState<number | null>(null);
  const [findScannedRows, setFindScannedRows] = useState<number | null>(null);
  const [findElapsedMs, setFindElapsedMs] = useState<number | null>(null);
  const [activeFindMatchIndex, setActiveFindMatchIndex] = useState(-1);

  return {
    findMatches,
    setFindMatches,
    findMatchesSource,
    setFindMatchesSource,
    findMatchesHasMore,
    setFindMatchesHasMore,
    findJobId,
    setFindJobId,
    findProgress,
    setFindProgress,
    findRunning,
    setFindRunning,
    findCanceled,
    setFindCanceled,
    findMatchedCount,
    setFindMatchedCount,
    findScannedRows,
    setFindScannedRows,
    findElapsedMs,
    setFindElapsedMs,
    activeFindMatchIndex,
    setActiveFindMatchIndex,
  };
}
