import { describe, it, expect } from "vitest";
import { formatDate, padNo, attachmentLabel } from "./format";

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
