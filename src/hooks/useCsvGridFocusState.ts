import { useEffect, useState } from "react";

export interface UseCsvGridFocusStateOptions {
  fileMode: "none" | "csv" | "text";
}

export default function useCsvGridFocusState({ fileMode }: UseCsvGridFocusStateOptions) {
  const [csvGridFocused, setCsvGridFocused] = useState(false);

  useEffect(() => {
    if (fileMode !== "csv") setCsvGridFocused(false);
  }, [fileMode]);

  return {
    csvGridFocused,
    setCsvGridFocused,
  };
}
