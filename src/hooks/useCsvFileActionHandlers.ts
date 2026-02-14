import { useCallback } from "react";

export interface UseCsvFileActionHandlersOptions {
  macroScope: "loaded" | "file";
  runMacroOnFile: () => Promise<void> | void;
  runMacro: () => void;
  findScope: "loaded" | "file";
  runFindReplaceOnFile: () => Promise<void> | void;
  applyFindReplace: () => void;
  clearModelEdits: () => void;
  resetFileOps: () => void;
  setError: (value: string | null) => void;
  previewPath: string | null;
  clearDraftForPath: (path: string | null) => void;
  hasSortFilter: boolean;
  setGlobalViewPatchTick: (updater: (current: number) => number) => void;
}

export default function useCsvFileActionHandlers({
  macroScope,
  runMacroOnFile,
  runMacro,
  findScope,
  runFindReplaceOnFile,
  applyFindReplace,
  clearModelEdits,
  resetFileOps,
  setError,
  previewPath,
  clearDraftForPath,
  hasSortFilter,
  setGlobalViewPatchTick,
}: UseCsvFileActionHandlersOptions) {
  const handleRunMacro = useCallback(() => {
    if (macroScope === "file") {
      void runMacroOnFile();
      return;
    }
    runMacro();
  }, [macroScope, runMacro, runMacroOnFile]);

  const handleApplyFindReplace = useCallback(() => {
    if (findScope === "file") {
      void runFindReplaceOnFile();
      return;
    }
    applyFindReplace();
  }, [applyFindReplace, findScope, runFindReplaceOnFile]);

  const clearEdits = useCallback(() => {
    clearModelEdits();
    resetFileOps();
    setError(null);
    if (previewPath) {
      clearDraftForPath(previewPath);
    }
    if (hasSortFilter) {
      setGlobalViewPatchTick((current) => current + 1);
    }
  }, [
    clearDraftForPath,
    clearModelEdits,
    hasSortFilter,
    previewPath,
    resetFileOps,
    setError,
    setGlobalViewPatchTick,
  ]);

  return {
    handleRunMacro,
    handleApplyFindReplace,
    clearEdits,
  };
}
