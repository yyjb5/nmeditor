import { describe, expect, it } from "vitest";
import {
  buildDocumentStructureItems,
  buildTextMinimapSegments,
} from "../textMinimap";

describe("textMinimap utils", () => {
  it("builds minimap segments with density", () => {
    const content = ["a", "", "b", "", "", "c"].join("\n");
    const segments = buildTextMinimapSegments(content, 3);
    expect(segments.length).toBe(3);
    expect(segments[0]).toMatchObject({ startLine: 0, endLine: 1 });
    expect(segments[0].density).toBe(0.5);
  });

  it("extracts markdown headings and js symbols", () => {
    const content = [
      "# Title",
      "## Section",
      "class Foo {}",
      "function work() {}",
      "const run = () => {}",
    ].join("\n");
    const items = buildDocumentStructureItems(content, "javascript", 20);
    expect(items.map((item) => item.label)).toEqual([
      "Title",
      "Section",
      "Foo",
      "work",
      "run",
    ]);
  });

  it("extracts python and rust symbols", () => {
    const py = buildDocumentStructureItems("class A:\n  pass\ndef f():\n  pass", "python", 20);
    expect(py.map((item) => item.label)).toEqual(["A", "f"]);

    const rs = buildDocumentStructureItems("pub struct S {}\nfn run() {}", "rust", 20);
    expect(rs.map((item) => item.label)).toEqual(["S", "run"]);
  });
});
