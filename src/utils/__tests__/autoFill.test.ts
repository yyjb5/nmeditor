import { describe, expect, it } from "vitest";
import { createAutoFillValueGetter } from "../autoFill";

describe("createAutoFillValueGetter", () => {
  it("repeats single-cell template", () => {
    const getValue = createAutoFillValueGetter([["foo"]]);
    expect(getValue(3, 4)).toBe("foo");
  });

  it("extends vertical numeric series for single-column sources", () => {
    const getValue = createAutoFillValueGetter([["1"], ["2"]]);
    expect(getValue(2, 0)).toBe("3");
    expect(getValue(3, 0)).toBe("4");
    expect(getValue(-1, 0)).toBe("0");
  });

  it("extends horizontal numeric series for single-row sources", () => {
    const getValue = createAutoFillValueGetter([["1", "3"]]);
    expect(getValue(0, 2)).toBe("5");
    expect(getValue(0, 3)).toBe("7");
    expect(getValue(0, -1)).toBe("-1");
  });

  it("extends vertical ISO date series for single-column sources", () => {
    const getValue = createAutoFillValueGetter([["2024-01-01"], ["2024-01-02"]]);
    expect(getValue(2, 0)).toBe("2024-01-03");
    expect(getValue(4, 0)).toBe("2024-01-05");
  });

  it("repeats matrix template when series is not applicable", () => {
    const getValue = createAutoFillValueGetter([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(getValue(2, 3)).toBe("B");
    expect(getValue(3, 2)).toBe("C");
    expect(getValue(-1, -1)).toBe("D");
  });
});
