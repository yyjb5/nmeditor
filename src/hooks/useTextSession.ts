import { useState } from "react";
import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

type UseTextSessionParams = {
  setError: (value: string | null) => void;
};

export default function useTextSession({ setError }: UseTextSessionParams) {
  const [textPath, setTextPath] = useState<string | null>(null);
  const [textContent, setTextContentState] = useState("");
  const [textDirty, setTextDirty] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [textEncoding, setTextEncoding] = useState<"UTF-8" | "UTF-16LE">("UTF-8");

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
      if (textEncoding === "UTF-8") {
        await writeTextFile(path, textContent);
      } else {
        const bytes = new Uint8Array(textContent.length * 2);
        for (let i = 0; i < textContent.length; i += 1) {
          const code = textContent.charCodeAt(i);
          bytes[i * 2] = code & 0xff;
          bytes[i * 2 + 1] = code >> 8;
        }
        await writeFile(path, bytes);
      }
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
    textEncoding,
    setTextContent,
    setTextPath,
    setTextContentState,
    setTextDirty,
    setTextEncoding,
    openText,
    saveTextTo,
    resetTextSession,
  };
}
