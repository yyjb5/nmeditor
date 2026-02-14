import { describe, expect, it } from "vitest";
import {
  applyGlobalColumnResize,
  normalizeColumnWidths,
} from "../columnResize";

describe("columnResize utils", () => {
  it("normalizes sparse and invalid widths", () => {
    expect(normalizeColumnWidths([100, Number.NaN, -5], 5)).toEqual([
      100,
      140,
      60,
      140,
      140,
    ]);
  });

  it("applies global resize to both row header and all columns", () => {
    const next = applyGlobalColumnResize([120, 140, 180], 52, 18);
    expect(next.rowHeaderWidth).toBe(70);
    expect(next.columnWidths).toEqual([138, 158, 198]);
  });

  it("clamps global resize to minimum widths", () => {
    const next = applyGlobalColumnResize([80, 70], 40, -100);
    expect(next.rowHeaderWidth).toBe(36);
    expect(next.columnWidths).toEqual([60, 60]);
  });
});
