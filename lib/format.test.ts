import { describe, it, expect } from "vitest";
import { formatDate, padNo, attachmentLabel, htmlToText } from "./format";

describe("formatDate", () => {
  it("converts ISO date to YYYY.MM.DD", () => {
    expect(formatDate("2026-07-21T00:00:00.000Z")).toBe("2026.07.21");
  });
  it("zero-pads month and day", () => {
    expect(formatDate("2026-01-05T00:00:00.000Z")).toBe("2026.01.05");
  });
});

describe("padNo", () => {
  it("pads single digit to two digits", () => {
    expect(padNo(8)).toBe("08");
  });
  it("leaves two-digit numbers unchanged", () => {
    expect(padNo(12)).toBe("12");
  });
});

describe("attachmentLabel", () => {
  it("shows paperclip with count when files exist", () => {
    expect(attachmentLabel(3)).toBe("📎 3");
  });
  it("shows em dash when no files", () => {
    expect(attachmentLabel(0)).toBe("—");
  });
});

describe("htmlToText", () => {
  it("strips tags leaving text", () => {
    expect(htmlToText("<p><span>안녕</span> 세계</p>")).toBe("안녕 세계");
  });
  it("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
  it("leaves plain text unchanged", () => {
    expect(htmlToText("그냥 텍스트")).toBe("그냥 텍스트");
  });
  it("decodes named and numeric entities", () => {
    expect(htmlToText("a&middot;b &amp; c &#8226; d")).toBe("a·b & c • d");
  });
  it("turns <br> and block-close tags into newlines", () => {
    expect(htmlToText("줄1<br>줄2</p><p>줄3")).toBe("줄1\n줄2\n줄3");
  });
  it("collapses excess whitespace and breaks block cells", () => {
    expect(htmlToText("<div>x</div><div>y</div>")).toBe("x\ny");
    expect(htmlToText("<td>  A  </td><td> B </td>")).toBe("A\nB");
  });
});
