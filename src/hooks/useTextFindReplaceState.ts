import { useRef, useState } from "react";
import type { TextFindHit } from "../types";

export default function useTextFindReplaceState() {
  const [textChunkJumpInput, setTextChunkJumpInput] = useState("0");
  const [textFindHitJumpInput, setTextFindHitJumpInput] = useState("1");
  const [textFindOffsetJumpInput, setTextFindOffsetJumpInput] = useState("0");
  const [textFindContextRadiusInput, setTextFindContextRadiusInput] = useState("160");

  const [textFindQuery, setTextFindQuery] = useState("");
  const [textReplaceValue, setTextReplaceValue] = useState("");
  const [textReplacePreserveCase, setTextReplacePreserveCase] = useState(false);
  const [textReplaceConfirmEach, setTextReplaceConfirmEach] = useState(false);
  const [textFindUseRegex, setTextFindUseRegex] = useState(false);
  const [textFindMatchCase, setTextFindMatchCase] = useState(true);

  const [textFindRunning, setTextFindRunning] = useState(false);
  const [textFindJobId, setTextFindJobId] = useState<number | null>(null);
  const [textFindProgress, setTextFindProgress] = useState(0);
  const [textFindHits, setTextFindHits] = useState<TextFindHit[]>([]);
  const [activeTextFindIndex, setActiveTextFindIndex] = useState(-1);
  const [textFindHasMore, setTextFindHasMore] = useState(false);
  const [textFindMatchedCount, setTextFindMatchedCount] = useState<number | null>(null);
  const [textFindScannedBytes, setTextFindScannedBytes] = useState<number | null>(null);
  const [textFindElapsedMs, setTextFindElapsedMs] = useState<number | null>(null);

  const [textReplaceRunning, setTextReplaceRunning] = useState(false);
  const [textReplaceJobId, setTextReplaceJobId] = useState<number | null>(null);
  const [textReplaceProgress, setTextReplaceProgress] = useState(0);
  const [textReplaceAppliedCount, setTextReplaceAppliedCount] = useState<number | null>(null);
  const [textReplaceScannedBytes, setTextReplaceScannedBytes] = useState<number | null>(null);
  const [textReplaceElapsedMs, setTextReplaceElapsedMs] = useState<number | null>(null);

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  return {
    textChunkJumpInput,
    setTextChunkJumpInput,
    textFindHitJumpInput,
    setTextFindHitJumpInput,
    textFindOffsetJumpInput,
    setTextFindOffsetJumpInput,
    textFindContextRadiusInput,
    setTextFindContextRadiusInput,
    textFindQuery,
    setTextFindQuery,
    textReplaceValue,
    setTextReplaceValue,
    textReplacePreserveCase,
    setTextReplacePreserveCase,
    textReplaceConfirmEach,
    setTextReplaceConfirmEach,
    textFindUseRegex,
    setTextFindUseRegex,
    textFindMatchCase,
    setTextFindMatchCase,
    textFindRunning,
    setTextFindRunning,
    textFindJobId,
    setTextFindJobId,
    textFindProgress,
    setTextFindProgress,
    textFindHits,
    setTextFindHits,
    activeTextFindIndex,
    setActiveTextFindIndex,
    textFindHasMore,
    setTextFindHasMore,
    textFindMatchedCount,
    setTextFindMatchedCount,
    textFindScannedBytes,
    setTextFindScannedBytes,
    textFindElapsedMs,
    setTextFindElapsedMs,
    textReplaceRunning,
    setTextReplaceRunning,
    textReplaceJobId,
    setTextReplaceJobId,
    textReplaceProgress,
    setTextReplaceProgress,
    textReplaceAppliedCount,
    setTextReplaceAppliedCount,
    textReplaceScannedBytes,
    setTextReplaceScannedBytes,
    textReplaceElapsedMs,
    setTextReplaceElapsedMs,
    textAreaRef,
  };
}
