import { useState } from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

type UseTextSessionParams = {
  setError: (value: string | null) => void;
};

export default function useTextSession({ setError }: UseTextSessionParams) {
  const [textPath, setTextPath] = useState<string | null>(null);
  const [textContent, setTextContentState] = useState("");
  const [textDirty, setTextDirty] = useState(false);
  const [textLoading, setTextLoading] = useState(false);

  const setTextContent = (value: string) => {
    setTextContentState(value);
    setTextDirty(true);
  };

  const openText = async (path: string): Promise<boolean> => {
    setError(null);
    setTextLoading(true);
    try {
      const content = await readTextFile(path);
      setTextPath(path);
      setTextContentState(content);
      setTextDirty(false);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setTextLoading(false);
    }
  };

  const saveTextTo = async (path: string): Promise<boolean> => {
    setError(null);
    setTextLoading(true);
    try {
      await writeTextFile(path, textContent);
      setTextPath(path);
      setTextDirty(false);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setTextLoading(false);
    }
  };

  const resetTextSession = () => {
    setTextPath(null);
    setTextContentState("");
    setTextDirty(false);
  };

  return {
    textPath,
    textContent,
    textDirty,
    textLoading,
    setTextContent,
    openText,
    saveTextTo,
    resetTextSession,
  };
}
