import { describe, it, expect } from "vitest";
import { attachmentDisposition } from "./download-headers";

describe("attachmentDisposition", () => {
  it("forces a save and keeps the Korean filename via RFC 5987", () => {
    const h = attachmentDisposition("공문.hwp");
    expect(h.startsWith("attachment;")).toBe(true);
    const star = h.match(/filename\*=UTF-8''(.+)$/)![1];
    expect(decodeURIComponent(star)).toBe("공문.hwp");
  });
  it("adds an ASCII fallback for clients that ignore filename*", () => {
    expect(attachmentDisposition("공문.hwp")).toContain('filename="__.hwp"');
    expect(attachmentDisposition("report v2.pdf")).toContain('filename="report v2.pdf"');
  });
  it("strips CR/LF and quotes so a filename cannot inject headers", () => {
    const h = attachmentDisposition('a"\r\nX-Evil: 1.pdf');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h).toContain('filename="aX-Evil: 1.pdf"');
  });
  it("falls back to 'download' for an empty name", () => {
    expect(attachmentDisposition("")).toContain('filename="download"');
  });
});
