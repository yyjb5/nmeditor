import { useEffect } from "react";

export interface UseTextFindReplaceLifecycleEffectsOptions {
  textReadOnlyPreview: boolean;
  textPreviewOffset: number;
  textPath: string | null;
  setTextChunkJumpInput: (value: string) => void;
  setTextReplaceValue: (value: string) => void;
  invalidateTextJobPolling: () => void;
  resetTextFindState: () => void;
  resetTextReplaceState: () => void;
}

export default function useTextFindReplaceLifecycleEffects({
  textReadOnlyPreview,
  textPreviewOffset,
  textPath,
  setTextChunkJumpInput,
  setTextReplaceValue,
  invalidateTextJobPolling,
  resetTextFindState,
  resetTextReplaceState,
}: UseTextFindReplaceLifecycleEffectsOptions) {
  useEffect(() => {
    if (!textReadOnlyPreview) return;
    setTextChunkJumpInput(String(textPreviewOffset));
  }, [setTextChunkJumpInput, textPreviewOffset, textReadOnlyPreview]);

  useEffect(() => {
    if (!textReadOnlyPreview) {
      invalidateTextJobPolling();
      resetTextFindState();
      resetTextReplaceState();
      setTextReplaceValue("");
      return;
    }
    resetTextFindState();
    resetTextReplaceState();
    setTextReplaceValue("");
  }, [
    invalidateTextJobPolling,
    resetTextFindState,
    resetTextReplaceState,
    setTextReplaceValue,
    textPath,
    textReadOnlyPreview,
  ]);

  useEffect(() => {
    return () => {
      invalidateTextJobPolling();
    };
  }, [invalidateTextJobPolling]);
}
