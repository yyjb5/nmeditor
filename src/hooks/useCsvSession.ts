import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type CsvPreview = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  path: string;
};

export type CsvSessionInfo = {
  session_id: number;
  headers: string[];
  delimiter: string;
  path: string;
};

type CsvSlice = {
  rows: string[][];
  start: number;
  end: number;
  eof: boolean;
};

type UseCsvSessionParams = {
  setError: (value: string | null) => void;
};

export default function useCsvSession({ setError }: UseCsvSessionParams) {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [loading, setLoading] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [eof, setEof] = useState(false);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [delimiterApplied, setDelimiterApplied] = useState<string | null>(null);
  const openDialogActiveRef = useRef(false);

  const openCsvPath = async (
    path: string,
    delimiterOverride?: string,
  ): Promise<CsvSessionInfo | null> => {
    if (openDialogActiveRef.current) return null;
    openDialogActiveRef.current = true;
    setError(null);
    setLoading(true);
    try {
      if (sessionId) {
        await invoke("close_csv_session", { sessionId });
      }

      const info = await invoke<CsvSessionInfo>("open_csv_session", {
        path,
        delimiter: delimiterOverride ?? delimiter,
      });
      setSessionId(info.session_id);
      setHeaders(info.headers);
      setRows([]);
      setEof(false);
      setActivePath(info.path);
      setDelimiterApplied(info.delimiter);
      setPreview({
        headers: info.headers,
        rows: [],
        delimiter: info.delimiter,
        path: info.path,
      });
      return info;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(false);
      openDialogActiveRef.current = false;
    }
  };

  const closeSession = async () => {
    if (sessionId) {
      try {
        await invoke("close_csv_session", { sessionId });
      } catch (err) {
        setError(String(err));
      }
    }
    setSessionId(null);
    setRows([]);
    setHeaders([]);
    setEof(false);
    setActivePath(null);
    setDelimiterApplied(null);
    setPreview(null);
  };

  const applyDelimiter = async (): Promise<CsvSessionInfo | null> => {
    if (!activePath) return null;
    setError(null);
    setLoading(true);
    try {
      if (sessionId) {
        await invoke("close_csv_session", { sessionId });
      }

      const info = await invoke<CsvSessionInfo>("open_csv_session", {
        path: activePath,
        delimiter,
      });
      setSessionId(info.session_id);
      setHeaders(info.headers);
      setRows([]);
      setEof(false);
      setDelimiterApplied(info.delimiter);
      setPreview({
        headers: info.headers,
        rows: [],
        delimiter: info.delimiter,
        path: info.path,
      });
      return info;
    } catch (err) {
      setError(String(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async (sessionIdOverride?: number) => {
    const activeSessionId = sessionIdOverride ?? sessionId;
    if (!activeSessionId || loadingRows || eof) return;
    setLoadingRows(true);
    try {
      const slice = await invoke<CsvSlice>("read_csv_rows", {
        sessionId: activeSessionId,
        start: rows.length,
        limit: 200,
      });
      setRows((prev) => [...prev, ...slice.rows]);
      setEof(slice.eof);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingRows(false);
    }
  };

  return {
    preview,
    delimiter,
    loading,
    loadingRows,
    sessionId,
    rows,
    headers,
    eof,
    activePath,
    delimiterApplied,
    setDelimiter,
    setLoading,
    setRows,
    setHeaders,
    setEof,
    setPreview,
    setSessionId,
    openCsvPath,
    closeSession,
    applyDelimiter,
    loadMore,
  };
}
