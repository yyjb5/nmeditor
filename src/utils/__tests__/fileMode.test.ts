import { describe, expect, it } from "vitest";
import { isCsvLikePath } from "../fileMode";

describe("isCsvLikePath", () => {
  it("accepts common csv-like extensions", () => {
    expect(isCsvLikePath("C:/data/a.csv")).toBe(true);
    expect(isCsvLikePath("C:/data/a.CSV")).toBe(true);
    expect(isCsvLikePath("C:/data/a.tsv")).toBe(true);
    expect(isCsvLikePath("C:/data/a.psv")).toBe(true);
    expect(isCsvLikePath("C:/data/a.ssv")).toBe(true);
  });

  it("rejects non-csv text-like files", () => {
    expect(isCsvLikePath("C:/data/a.txt")).toBe(false);
    expect(isCsvLikePath("C:/data/a.log")).toBe(false);
    expect(isCsvLikePath("C:/data/a.csv.bak")).toBe(false);
  });
});

