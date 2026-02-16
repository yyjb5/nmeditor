import { describe, expect, it } from "vitest";
import {
  analyzeTextWhitespace,
  buildWhitespaceVisiblePreview,
  convertTextEol,
  detectTextEolMode,
  trimTrailingWhitespace,
} from "../textEol";

describe("textEol utils", () => {
  it("detects CRLF/LF/MIXED/NONE modes", () => {
    expect(detectTextEolMode("a\r\nb\r\n")).toBe("CRLF");
    expect(detectTextEolMode("a\nb\n")).toBe("LF");
    expect(detectTextEolMode("a\r\nb\n")).toBe("MIXED");
    expect(detectTextEolMode("plain")).toBe("NONE");
  });

  it("converts line endings between LF and CRLF", () => {
    expect(convertTextEol("a\r\nb\nc\r", "LF")).toBe("a\nb\nc\n");
    expect(convertTextEol("a\nb\n", "CRLF")).toBe("a\r\nb\r\n");
  });

  it("trims trailing spaces and tabs only at line end", () => {
    const result = trimTrailingWhitespace("a  \n\tb\t \r\n  c\t");
    expect(result.content).toBe("a\n\tb\r\n  c");
    expect(result.affectedLines).toBe(3);
    expect(result.removedChars).toBe(5);
  });

  it("analyzes line breaks and whitespace stats", () => {
    const stats = analyzeTextWhitespace("a\t \r\nb\t\nc \n");
    expect(stats).toEqual({
      lineCount: 4,
      crlfCount: 1,
      lfCount: 2,
      tabCount: 2,
      trailingWhitespaceLines: 3,
      trailingWhitespaceChars: 4,
    });
  });

  it("builds visible preview markers and respects max length", () => {
    const full = buildWhitespaceVisiblePreview("a \t\r\nb\n");
    expect(full.preview).toBe("a·⇥␍␊\nb␊\n");
    expect(full.truncated).toBe(false);

    const short = buildWhitespaceVisiblePreview("abcd", 2);
    expect(short.preview).toBe("ab");
    expect(short.truncated).toBe(true);
  });
});
