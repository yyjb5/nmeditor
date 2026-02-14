import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import useFileOps from "../useFileOps";

vi.mock("../../tauriBridge", () => ({
  invokeCmd: vi.fn(),
  saveFileDialog: vi.fn(),
}));

const t = (en: string) => en;

describe("useFileOps loaded-scope row mapping", () => {
  it("applies macro patches using global row index (windowStart offset)", () => {
    const getCellValue = vi.fn((row: number, col: number) => {
      if (col !== 0) return "";
      if (row === 10) return "a";
      if (row === 11) return "b";
      return "";
    });
    const applyPatch = vi.fn((row: number, col: number, value: string) => ({
      key: `${row}:${col}`,
      prev: null,
      next: value,
    }));
    const pushUndo = vi.fn();

    const { result } = renderHook(() =>
      useFileOps({
        preview: null,
        headers: ["c0"],
        rows: [["a"], ["b"]],
        windowStart: 10,
        patches: {},
        rowOps: [],
        columnOps: [],
        clearRows: [],
        clearCols: [],
        getCellValue,
        applyPatch,
        pushUndo,
        setError: vi.fn(),
        setLoading: vi.fn(),
        t,
      }),
    );

    act(() => {
      result.current.setMacroOp("uppercase");
    });

    act(() => {
      result.current.runMacro();
    });

    expect(applyPatch).toHaveBeenNthCalledWith(1, 10, 0, "A");
    expect(applyPatch).toHaveBeenNthCalledWith(2, 11, 0, "B");
    expect(pushUndo).toHaveBeenCalledTimes(1);
  });

  it("escapes literal find text and applies replace on global row index", () => {
    const getCellValue = vi.fn((row: number, col: number) => {
      if (col !== 0) return "";
      if (row === 10) return "a+b one";
      if (row === 11) return "A+B two";
      return "";
    });
    const applyPatch = vi.fn((row: number, col: number, value: string) => ({
      key: `${row}:${col}`,
      prev: null,
      next: value,
    }));
    const pushUndo = vi.fn();

    const { result } = renderHook(() =>
      useFileOps({
        preview: null,
        headers: ["c0"],
        rows: [["a+b one"], ["A+B two"]],
        windowStart: 10,
        patches: {},
        rowOps: [],
        columnOps: [],
        clearRows: [],
        clearCols: [],
        getCellValue,
        applyPatch,
        pushUndo,
        setError: vi.fn(),
        setLoading: vi.fn(),
        t,
      }),
    );

    act(() => {
      result.current.setFindText("a+b");
      result.current.setReplaceText("X");
    });

    act(() => {
      result.current.applyFindReplace();
    });

    expect(applyPatch).toHaveBeenNthCalledWith(1, 10, 0, "X one");
    expect(applyPatch).toHaveBeenNthCalledWith(2, 11, 0, "X two");
    expect(pushUndo).toHaveBeenCalledTimes(1);
  });
});
