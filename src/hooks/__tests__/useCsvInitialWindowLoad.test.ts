import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useCsvInitialWindowLoad from "../useCsvInitialWindowLoad";

const baseProps = {
  fileMode: "csv" as const,
  previewPath: "large.csv",
  activePath: null,
  delimiter: ",",
  delimiterApplied: null,
  previewDelimiter: ",",
};

type HookProps = {
  refreshTotalRows: ReturnType<typeof vi.fn>;
  loadWindow: ReturnType<typeof vi.fn>;
  delimiterApplied: string | null;
};

describe("useCsvInitialWindowLoad", () => {
  it("does not restart initial CSV indexing when callback identities change", () => {
    const refreshA = vi.fn().mockResolvedValue(undefined);
    const loadA = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook<void, HookProps>(
      (props: HookProps) =>
        useCsvInitialWindowLoad({
          ...baseProps,
          delimiterApplied: props.delimiterApplied,
          refreshTotalRows: props.refreshTotalRows,
          loadWindow: props.loadWindow,
        }),
      {
        initialProps: {
          refreshTotalRows: refreshA,
          loadWindow: loadA,
          delimiterApplied: null,
        } satisfies HookProps,
      },
    );

    expect(refreshA).toHaveBeenCalledTimes(1);
    expect(loadA).toHaveBeenCalledTimes(1);

    const refreshB = vi.fn().mockResolvedValue(undefined);
    const loadB = vi.fn().mockResolvedValue(undefined);
    rerender({
      refreshTotalRows: refreshB,
      loadWindow: loadB,
      delimiterApplied: null,
    });

    expect(refreshB).not.toHaveBeenCalled();
    expect(loadB).not.toHaveBeenCalled();

    rerender({
      refreshTotalRows: refreshB,
      loadWindow: loadB,
      delimiterApplied: ";",
    });

    expect(refreshB).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
    expect(refreshB).toHaveBeenCalledWith("large.csv", ";", "auto");
    expect(loadB).toHaveBeenCalledWith(0, "large.csv", ";");
  });
});
