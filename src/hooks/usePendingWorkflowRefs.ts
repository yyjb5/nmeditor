import { useRef } from "react";

export default function usePendingWorkflowRefs() {
  const pendingInitialSaveRef = useRef<{ tabId: string; type: "csv" | "text" } | null>(null);
  const pendingImportRef = useRef<{ skipRows: number; firstRowHeader: boolean } | null>(null);

  return {
    pendingInitialSaveRef,
    pendingImportRef,
  };
}
