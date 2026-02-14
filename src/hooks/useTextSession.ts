import { useState } from "react";
import {
  invokeCmd,
  readBinaryFile,
  statFile,
  writeBinaryFile,
  writeText,
} from "../tauriBridge";

type UseTextSessionParams = {
  setError: (value: string | null) => void;
};

export default function useTextSession({ setError }: UseTextSessionParams) {
  const LARGE_TEXT_FILE_THRESHOLD_BYTES = 256 * 1024 * 1024;
  const LARGE_TEXT_PREVIEW_BYTES = 8 * 1024 * 1024;

  const [textPath, setTextPath] = useState<string | null>(null);
  const [textContent, setTextContentState] = useState("");
  const [textDirty, setTextDirty] = useState(false);
  const [textLoading, setTextLoading] = useState(false);
  const [textEncoding, setTextEncoding] = useState<"UTF-8" | "UTF-16LE">("UTF-8");

  const [textReadOnlyPreview, setTextReadOnlyPreview] = useState(false);
  const [textPreviewOffset, setTextPreviewOffset] = useState(0);
  const [textPreviewHasPrev, setTextPreviewHasPrev] = useState(false);
  const [textPreviewHasNext, setTextPreviewHasNext] = useState(false);
  const [textPreviewBytes, setTextPreviewBytes] = useState<number | null>(null);
  const [textTotalBytes, setTextTotalBytes] = useState<number | null>(null);
  const [textPreviewReplaceOffset, setTextPreviewReplaceOffset] = useState(0);
  const [textPreviewReplaceBytes, setTextPreviewReplaceBytes] = useState(0);

  const setTextContent = (value: string) => {
    setTextContentState(value);
    setTextDirty(true);
  };

  const decodeUtf8 = (bytes: Uint8Array) => {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  };

  const looksLikeUtf16Le = (bytes: Uint8Array) => {
    const sampleLen = Math.min(bytes.length, 512);
    if (sampleLen < 8) return false;
    let oddNul = 0;
    let evenNul = 0;
    for (let i = 0; i < sampleLen; i += 1) {
      if (bytes[i] !== 0) continue;
      if (i % 2 === 0) evenNul += 1;
      else oddNul += 1;
    }
    return oddNul >= 4 && oddNul > evenNul * 3;
  };

  const decodeText = (bytes: Uint8Array): { content: string; encoding: "UTF-8" | "UTF-16LE" } => {
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xfe
    ) {
      return {
        content: new TextDecoder("utf-16le").decode(bytes.subarray(2)),
        encoding: "UTF-16LE",
      };
    }

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      return {
        content: decodeUtf8(bytes.subarray(3)),
        encoding: "UTF-8",
      };
    }

    if (looksLikeUtf16Le(bytes)) {
      return {
        content: new TextDecoder("utf-16le").decode(bytes),
        encoding: "UTF-16LE",
      };
    }

    return {
      content: decodeUtf8(bytes),
      encoding: "UTF-8",
    };
  };

  const detectEncoding = (bytes: Uint8Array): "UTF-8" | "UTF-16LE" => {
    if (
      bytes.length >= 2 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xfe
    ) {
      return "UTF-16LE";
    }
    if (looksLikeUtf16Le(bytes)) return "UTF-16LE";
    return "UTF-8";
  };

  const decodeChunkWithEncoding = (
    bytes: Uint8Array,
    encoding: "UTF-8" | "UTF-16LE",
    atStart: boolean,
  ): { content: string; byteStart: number; byteLen: number } => {
    if (encoding === "UTF-16LE") {
      const dataStart =
        atStart && bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe ? 2 : 0;
      const evenLen = bytes.length - ((bytes.length - dataStart) % 2);
      const safeEnd = Math.max(evenLen, dataStart);
      return {
        content: new TextDecoder("utf-16le").decode(bytes.subarray(dataStart, safeEnd)),
        byteStart: dataStart,
        byteLen: safeEnd - dataStart,
      };
    }

    const trimUtf8Boundaries = (
      input: Uint8Array,
      isStart: boolean,
    ): { start: number; end: number } => {
      if (input.length === 0) return { start: 0, end: 0 };

      let start = 0;
      if (!isStart) {
        while (start < input.length && start < 3 && (input[start] & 0xc0) === 0x80) {
          start += 1;
        }
      }

      let end = input.length;
      let contCount = 0;
      for (let i = end - 1; i >= start && contCount < 3; i -= 1) {
        if ((input[i] & 0xc0) === 0x80) contCount += 1;
        else break;
      }

      const leadIndex = end - contCount - 1;
      if (leadIndex >= start) {
        const lead = input[leadIndex];
        const expectedLen =
          (lead & 0x80) === 0x00
            ? 1
            : (lead & 0xe0) === 0xc0
              ? 2
              : (lead & 0xf0) === 0xe0
                ? 3
                : (lead & 0xf8) === 0xf0
                  ? 4
                  : 1;
        const actualLen = contCount + 1;
        if (expectedLen > actualLen) {
          end = leadIndex;
        }
      }

      if (end <= start) return { start: 0, end: 0 };
      return { start, end };
    };

    const trimmed = trimUtf8Boundaries(bytes, atStart);
    let byteStart = trimmed.start;
    if (
      atStart &&
      trimmed.end - trimmed.start >= 3 &&
      bytes[trimmed.start] === 0xef &&
      bytes[trimmed.start + 1] === 0xbb &&
      bytes[trimmed.start + 2] === 0xbf
    ) {
      byteStart += 3;
    }
    const byteEnd = Math.max(trimmed.end, byteStart);
    return {
      content: decodeUtf8(bytes.subarray(byteStart, byteEnd)),
      byteStart,
      byteLen: byteEnd - byteStart,
    };
  };

  const loadPreviewChunkAtOffset = async (
    path: string,
    offset: number,
    totalBytes: number,
    encodingHint?: "UTF-8" | "UTF-16LE",
  ): Promise<boolean> => {
    const clampedOffset = Math.max(0, Math.min(offset, Math.max(totalBytes - 1, 0)));
    const alignedOffset =
      encodingHint === "UTF-16LE" ? clampedOffset - (clampedOffset % 2) : clampedOffset;

    const rawBytes = await invokeCmd<number[]>("read_file_bytes_range", {
      path,
      offset: alignedOffset,
      maxBytes: LARGE_TEXT_PREVIEW_BYTES,
    });
    const bytes = Uint8Array.from(rawBytes);

    const resolvedEncoding = encodingHint ?? detectEncoding(bytes);
    const decoded = decodeChunkWithEncoding(bytes, resolvedEncoding, alignedOffset === 0);

    setTextPath(path);
    setTextContentState(decoded.content);
    setTextEncoding(resolvedEncoding);
    setTextDirty(false);

    setTextReadOnlyPreview(true);
    setTextPreviewOffset(alignedOffset);
    setTextPreviewBytes(bytes.length);
    setTextTotalBytes(totalBytes);
    setTextPreviewHasPrev(alignedOffset > 0);
    setTextPreviewHasNext(alignedOffset + bytes.length < totalBytes);
    setTextPreviewReplaceOffset(alignedOffset + decoded.byteStart);
    setTextPreviewReplaceBytes(decoded.byteLen);
    return true;
  };

  const openText = async (path: string): Promise<boolean> => {
    setError(null);
    setTextLoading(true);
    try {
      const info = await statFile(path).catch(() => ({ size: undefined }));
      const totalBytes = typeof info.size === "number" ? info.size : null;

      if (totalBytes !== null && totalBytes > LARGE_TEXT_FILE_THRESHOLD_BYTES) {
        return await loadPreviewChunkAtOffset(path, 0, totalBytes);
      }

      const bytes = await readBinaryFile(path);
      const { content, encoding } = decodeText(bytes);
      setTextPath(path);
      setTextContentState(content);
      setTextEncoding(encoding);
      setTextDirty(false);

      setTextReadOnlyPreview(false);
      setTextPreviewOffset(0);
      setTextPreviewBytes(bytes.length);
      setTextTotalBytes(totalBytes ?? bytes.length);
      setTextPreviewHasPrev(false);
      setTextPreviewHasNext(false);
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
      if (textReadOnlyPreview) {
        if (!textPath) {
          setError("No active file for chunk save.");
          return false;
        }
        const contentBytes =
          textEncoding === "UTF-8"
            ? new TextEncoder().encode(textContent)
            : (() => {
                const body = new Uint8Array(textContent.length * 2);
                for (let i = 0; i < textContent.length; i += 1) {
                  const code = textContent.charCodeAt(i);
                  body[i * 2] = code & 0xff;
                  body[i * 2 + 1] = code >> 8;
                }
                return body;
              })();

        await invokeCmd<void>("replace_file_bytes_range", {
          sourcePath: textPath,
          targetPath: path,
          offset: textPreviewReplaceOffset,
          deleteLen: textPreviewReplaceBytes,
          insertBytes: Array.from(contentBytes),
        });

        const delta = contentBytes.length - textPreviewReplaceBytes;
        if (textTotalBytes !== null) {
          const nextTotal = Math.max(0, textTotalBytes + delta);
          setTextTotalBytes(nextTotal);
          setTextPreviewHasNext(
            textPreviewOffset + (textPreviewBytes ?? 0) + delta < nextTotal,
          );
        }
        if (textPreviewBytes !== null) {
          setTextPreviewBytes(Math.max(0, textPreviewBytes + delta));
        }
        setTextPreviewReplaceBytes(contentBytes.length);
        setTextPath(path);
        setTextDirty(false);
        return true;
      }

      if (textEncoding === "UTF-8") {
        await writeText(path, textContent);
      } else {
        const body = new Uint8Array(textContent.length * 2);
        for (let i = 0; i < textContent.length; i += 1) {
          const code = textContent.charCodeAt(i);
          body[i * 2] = code & 0xff;
          body[i * 2 + 1] = code >> 8;
        }
        const bytes = new Uint8Array(body.length + 2);
        bytes[0] = 0xff;
        bytes[1] = 0xfe;
        bytes.set(body, 2);
        await writeBinaryFile(path, bytes);
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

  const loadNextTextPreviewChunk = async (): Promise<boolean> => {
    if (!textReadOnlyPreview || !textPath || !textPreviewHasNext || textTotalBytes === null) {
      return false;
    }
    if (textDirty) {
      const saved = await saveTextTo(textPath);
      if (!saved) return false;
    }
    setError(null);
    setTextLoading(true);
    try {
      const nextOffset = textPreviewOffset + (textPreviewBytes ?? 0);
      return await loadPreviewChunkAtOffset(textPath, nextOffset, textTotalBytes, textEncoding);
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setTextLoading(false);
    }
  };

  const loadPrevTextPreviewChunk = async (): Promise<boolean> => {
    if (!textReadOnlyPreview || !textPath || !textPreviewHasPrev || textTotalBytes === null) {
      return false;
    }
    if (textDirty) {
      const saved = await saveTextTo(textPath);
      if (!saved) return false;
    }
    setError(null);
    setTextLoading(true);
    try {
      const prevOffset = Math.max(textPreviewOffset - LARGE_TEXT_PREVIEW_BYTES, 0);
      return await loadPreviewChunkAtOffset(textPath, prevOffset, textTotalBytes, textEncoding);
    } catch (err) {
      setError(String(err));
      return false;
    } finally {
      setTextLoading(false);
    }
  };

  const loadTextPreviewChunkAtOffset = async (offset: number): Promise<boolean> => {
    if (!textReadOnlyPreview || !textPath || textTotalBytes === null) {
      return false;
    }
    if (textDirty) {
      const saved = await saveTextTo(textPath);
      if (!saved) return false;
    }
    setError(null);
    setTextLoading(true);
    try {
      return await loadPreviewChunkAtOffset(textPath, offset, textTotalBytes, textEncoding);
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
    setTextReadOnlyPreview(false);
    setTextPreviewOffset(0);
    setTextPreviewBytes(null);
    setTextTotalBytes(null);
    setTextPreviewHasPrev(false);
    setTextPreviewHasNext(false);
    setTextPreviewReplaceOffset(0);
    setTextPreviewReplaceBytes(0);
  };

  return {
    LARGE_TEXT_FILE_THRESHOLD_BYTES,
    LARGE_TEXT_PREVIEW_BYTES,
    textPath,
    textContent,
    textDirty,
    textLoading,
    textEncoding,
    textReadOnlyPreview,
    textPreviewOffset,
    textPreviewHasPrev,
    textPreviewHasNext,
    textPreviewBytes,
    textTotalBytes,
    textPreviewReplaceOffset,
    textPreviewReplaceBytes,

    setTextContent,
    setTextPath,
    setTextContentState,
    setTextDirty,
    setTextEncoding,
    setTextReadOnlyPreview,
    setTextPreviewOffset,
    setTextPreviewHasPrev,
    setTextPreviewHasNext,
    setTextPreviewBytes,
    setTextTotalBytes,
    setTextPreviewReplaceOffset,
    setTextPreviewReplaceBytes,

    openText,
    saveTextTo,
    loadNextTextPreviewChunk,
    loadPrevTextPreviewChunk,
    loadTextPreviewChunkAtOffset,
    resetTextSession,
  };
}
