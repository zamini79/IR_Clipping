import { describe, it, expect } from "vitest";
import { contentDisposition } from "./download-headers";

describe("contentDisposition", () => {
  it("keeps the Korean filename via RFC 5987 in both modes", () => {
    for (const mode of ["inline", "attachment"] as const) {
      const h = contentDisposition("공문.hwp", mode);
      expect(h.startsWith(`${mode};`)).toBe(true);
      expect(decodeURIComponent(h.match(/filename\*=UTF-8''(.+)$/)![1])).toBe("공문.hwp");
    }
  });
  it("names inline files too, so 'save as' can't fall back to the Storage key", () => {
    // Without this the browser would use the URL basename, e.g. "0-_._.hwpx".
    expect(contentDisposition("보도자료.pdf", "inline")).toContain("inline;");
    expect(contentDisposition("보도자료.pdf", "inline")).toContain("filename*=UTF-8''");
  });
  it("adds an ASCII fallback for clients that ignore filename*", () => {
    expect(contentDisposition("공문.hwp", "attachment")).toContain('filename="__.hwp"');
    expect(contentDisposition("report v2.pdf", "attachment")).toContain('filename="report v2.pdf"');
  });
  it("strips CR/LF and quotes so a filename cannot inject headers", () => {
    const h = contentDisposition('a"\r\nX-Evil: 1.pdf', "attachment");
    expect(h).not.toMatch(/[\r\n]/);
    expect(h).toContain('filename="aX-Evil: 1.pdf"');
  });
  it("falls back to 'download' for an empty name", () => {
    expect(contentDisposition("", "attachment")).toContain('filename="download"');
  });
});
