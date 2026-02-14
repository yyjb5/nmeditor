import { useCallback } from "react";

export interface UseAutoIndexPolicyOptions {
  autoIndexMode: "all" | "large_only";
  autoIndexThresholdBytes: number;
}

export default function useAutoIndexPolicy({
  autoIndexMode,
  autoIndexThresholdBytes,
}: UseAutoIndexPolicyOptions) {
  const shouldAutoBuildIndex = useCallback(
    (sizeBytes: number | null) => {
      if (autoIndexMode === "all") return true;
      if (sizeBytes === null) return true;
      return sizeBytes > autoIndexThresholdBytes;
    },
    [autoIndexMode, autoIndexThresholdBytes],
  );

  return {
    shouldAutoBuildIndex,
  };
}
