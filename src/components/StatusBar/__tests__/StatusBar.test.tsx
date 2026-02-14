import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StatusBar from "../index";

const t = (en: string) => en;

const baseProps = {
  loading: false,
  loadingRows: false,
  fileMode: "csv" as const,
  csvGridFocused: true,
  csvEditing: false,
  csvSelectionMode: "cell" as const,
  hasPreview: true,
  eof: false,
  rowsLength: 400,
  visibleCount: 120,
  patchCount: 0,
  macroAppliedCount: 0,
  findAppliedCount: 0,
  opStatus: null,
  indexing: false,
  indexProgress: 0,
  indexCanceled: false,
  findRunning: false,
  findProgress: 0,
  findCanceled: false,
  findMatchedCount: null,
  findScannedRows: null,
  findElapsedMs: null,
  globalViewLoading: false,
  autoIndexMode: "large_only" as const,
  forceExternalSort: false,
  indexingTrigger: null,
  onCancelIndex: undefined,
  onCancelFind: undefined,
  onBuildIndex: undefined,
  canBuildIndex: false,
  t,
};

describe("StatusBar find telemetry", () => {
  it("shows running progress and matched count while find task is running", () => {
    const onCancelFind = vi.fn();
    render(
      <StatusBar
        {...baseProps}
        findRunning
        findProgress={0.58}
        findMatchedCount={9}
        onCancelFind={onCancelFind}
      />,
    );
    expect(screen.getByText("Finding 58% · matched 9")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("shows latest scanned rows and elapsed time after find task finished", () => {
    render(
      <StatusBar
        {...baseProps}
        findScannedRows={1234}
        findElapsedMs={987}
      />,
    );
    expect(screen.getByText("Last find: scanned 1234 rows in 0.99s")).toBeTruthy();
  });
});
