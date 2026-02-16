import { describe, expect, it } from "vitest";
import {
  buildHexApplyRanges,
  isPrintableAscii,
  parseHexByte,
  toHexByte,
} from "../textHex";

describe("textHex utils", () => {
  it("formats hex byte as uppercase 2 chars", () => {
    expect(toHexByte(0)).toBe("00");
    expect(toHexByte(15)).toBe("0F");
    expect(toHexByte(255)).toBe("FF");
  });

  it("parses hex byte input", () => {
    expect(parseHexByte("0A")).toBe(10);
    expect(parseHexByte("0xa")).toBe(10);
    expect(parseHexByte("ff")).toBe(255);
    expect(parseHexByte("")).toBeNull();
    expect(parseHexByte("GG")).toBeNull();
    expect(parseHexByte("123")).toBeNull();
  });

  it("detects printable ascii", () => {
    expect(isPrintableAscii(0x20)).toBe(true);
    expect(isPrintableAscii(0x7e)).toBe(true);
    expect(isPrintableAscii(0x1f)).toBe(false);
    expect(isPrintableAscii(0x7f)).toBe(false);
  });

  it("builds contiguous apply ranges from sparse edits", () => {
    const source = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const ranges = buildHexApplyRanges(source, {
      1: 0xaa,
      2: 0xbb,
      5: 0xcc,
      7: 0xdd,
    });
    expect(ranges).toEqual([
      { start: 1, bytes: [0xaa, 0xbb] },
      { start: 5, bytes: [0xcc] },
      { start: 7, bytes: [0xdd] },
    ]);
  });
});
