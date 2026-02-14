import { useCallback } from "react";
import { saveFileDialog } from "../tauriBridge";

export interface UseTextToolbarActionsOptions {
  textPath: string | null;
  saveTextTo: (path: string) => Promise<boolean>;
  updateActiveTabPath: (nextPath: string) => void;
  textReadOnlyPreview: boolean;
  textTotalBytes: number | null;
  textChunkJumpInput: string;
  setTextChunkJumpInput: (value: string) => void;
  loadTextPreviewChunkAtOffset: (offset: number) => Promise<boolean>;
  setError: (value: string | null) => void;
  t: (en: string, zh: string) => string;
}

export default function useTextToolbarActions({
  textPath,
  saveTextTo,
  updateActiveTabPath,
  textReadOnlyPreview,
  textTotalBytes,
  textChunkJumpInput,
  setTextChunkJumpInput,
  loadTextPreviewChunkAtOffset,
  setError,
  t,
}: UseTextToolbarActionsOptions) {
  const saveTextAs = useCallback(async (): Promise<boolean> => {
    const defaultPath = textPath ?? "untitled.txt";
    const target = await saveFileDialog({
      defaultPath,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!target || Array.isArray(target)) return false;
    const saved = await saveTextTo(target);
    if (saved) {
      updateActiveTabPath(target);
    }
    return saved;
  }, [saveTextTo, textPath, updateActiveTabPath]);

  const jumpToTextChunk = useCallback(async (): Promise<boolean> => {
    if (!textReadOnlyPreview || textTotalBytes === null) return false;
    const raw = textChunkJumpInput.trim();
    if (raw.length === 0) {
      setError(t("Enter a byte offset first.", "Enter a byte offset first."));
      return false;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t("Byte offset must be a non-negative number.", "Byte offset must be a non-negative number."));
      return false;
    }
    const maxOffset = Math.max(textTotalBytes - 1, 0);
    const offset = Math.min(Math.floor(parsed), maxOffset);
    const loaded = await loadTextPreviewChunkAtOffset(offset);
    if (!loaded) return false;
    setTextChunkJumpInput(String(offset));
    return true;
  }, [
    loadTextPreviewChunkAtOffset,
    setError,
    setTextChunkJumpInput,
    t,
    textChunkJumpInput,
    textReadOnlyPreview,
    textTotalBytes,
  ]);

  return {
    saveTextAs,
    jumpToTextChunk,
  };
}
