import { useCallback, useEffect, useRef, useState } from "react";

export type DiagnosticState = {
  scrollEvents: number;
  autoDown: number;
  autoUp: number;
  requestCalls: number;
  loadCalls: number;
  cacheHits: number;
  lastStart: number | null;
  lastRows: number;
  lastEof: boolean;
  lastScrollTop: number;
  lastTotalSize: number;
  blockedLoading: number;
  blockedSuppress: number;
  blockedEof: number;
  blockedDuplicate: number;
  lastAction: string;
};

const createDiagnosticState = (): DiagnosticState => ({
  scrollEvents: 0,
  autoDown: 0,
  autoUp: 0,
  requestCalls: 0,
  loadCalls: 0,
  cacheHits: 0,
  lastStart: null,
  lastRows: 0,
  lastEof: false,
  lastScrollTop: 0,
  lastTotalSize: 0,
  blockedLoading: 0,
  blockedSuppress: 0,
  blockedEof: 0,
  blockedDuplicate: 0,
  lastAction: "idle",
});

export default function useDiagnostics() {
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(() => {
    try {
      return window.localStorage.getItem("nmeditor.diagnostics") === "1";
    } catch {
      return false;
    }
  });
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>(createDiagnosticState);
  const diagnosticRef = useRef<DiagnosticState>(createDiagnosticState());
  const diagnosticRafRef = useRef<number | null>(null);

  const flushDiagnostics = useCallback(() => {
    if (!diagnosticsEnabled) return;
    if (diagnosticRafRef.current !== null) return;
    diagnosticRafRef.current = window.requestAnimationFrame(() => {
      diagnosticRafRef.current = null;
      setDiagnosticState({ ...diagnosticRef.current });
    });
  }, [diagnosticsEnabled]);

  const bumpDiagnostics = useCallback(
    (updater: (current: DiagnosticState) => DiagnosticState) => {
      if (!diagnosticsEnabled) return;
      diagnosticRef.current = updater(diagnosticRef.current);
      flushDiagnostics();
    },
    [diagnosticsEnabled, flushDiagnostics],
  );

  const resetDiagnostics = useCallback(() => {
    const next = createDiagnosticState();
    diagnosticRef.current = next;
    setDiagnosticState(next);
  }, []);

  useEffect(() => {
    if (!diagnosticsEnabled) {
      if (diagnosticRafRef.current !== null) {
        window.cancelAnimationFrame(diagnosticRafRef.current);
        diagnosticRafRef.current = null;
      }
      return;
    }
    try {
      window.localStorage.setItem("nmeditor.diagnostics", "1");
    } catch {
      // ignore storage failure
    }
    return () => {
      if (diagnosticRafRef.current !== null) {
        window.cancelAnimationFrame(diagnosticRafRef.current);
        diagnosticRafRef.current = null;
      }
    };
  }, [diagnosticsEnabled]);

  useEffect(() => {
    if (diagnosticsEnabled) return;
    try {
      window.localStorage.removeItem("nmeditor.diagnostics");
    } catch {
      // ignore storage failure
    }
  }, [diagnosticsEnabled]);

  useEffect(() => {
    const onToggleDiagnostics = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d")) return;
      event.preventDefault();
      setDiagnosticsEnabled((current) => {
        const next = !current;
        if (next) {
          resetDiagnostics();
        }
        return next;
      });
    };
    window.addEventListener("keydown", onToggleDiagnostics);
    return () => window.removeEventListener("keydown", onToggleDiagnostics);
  }, [resetDiagnostics]);

  return {
    diagnosticsEnabled,
    setDiagnosticsEnabled,
    diagnosticState,
    resetDiagnostics,
    bumpDiagnostics,
  };
}
