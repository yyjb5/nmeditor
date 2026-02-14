import { useRef, useState } from "react";

export default function useGlobalViewState() {
  const [globalViewTotal, setGlobalViewTotal] = useState<number | null>(null);
  const [globalViewLoading, setGlobalViewLoading] = useState(false);
  const [globalViewPatchTick, setGlobalViewPatchTick] = useState(0);
  const globalViewIdRef = useRef<number | null>(null);
  const globalViewBuildRef = useRef(0);
  const globalViewRebuildTimerRef = useRef<number | null>(null);
  const globalViewBuildRunningRef = useRef(false);
  const globalViewBuildPendingRef = useRef(false);

  return {
    globalViewTotal,
    setGlobalViewTotal,
    globalViewLoading,
    setGlobalViewLoading,
    globalViewPatchTick,
    setGlobalViewPatchTick,
    globalViewIdRef,
    globalViewBuildRef,
    globalViewRebuildTimerRef,
    globalViewBuildRunningRef,
    globalViewBuildPendingRef,
  };
}
