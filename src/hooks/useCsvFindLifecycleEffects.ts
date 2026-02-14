import { useEffect } from "react";
import type { FindMatchSource } from "../types";

export interface UseCsvFindLifecycleEffectsOptions {
  clearFindMatches: () => void;
  findScope: "loaded" | "file";
  findText: string;
  findColumnInput: string;
  findStartRow: string;
  findEndRow: string;
  useRegex: boolean;
  matchCase: boolean;
  findMatchesSource: FindMatchSource;
  rows: string[][];
  windowStart: number;
}

export default function useCsvFindLifecycleEffects({
  clearFindMatches,
  findScope,
  findText,
  findColumnInput,
  findStartRow,
  findEndRow,
  useRegex,
  matchCase,
  findMatchesSource,
  rows,
  windowStart,
}: UseCsvFindLifecycleEffectsOptions) {
  useEffect(() => {
    clearFindMatches();
  }, [
    clearFindMatches,
    findScope,
    findText,
    findColumnInput,
    findStartRow,
    findEndRow,
    useRegex,
    matchCase,
  ]);

  useEffect(() => {
    if (findMatchesSource !== "loaded") return;
    clearFindMatches();
  }, [clearFindMatches, findMatchesSource, rows, windowStart]);
}
