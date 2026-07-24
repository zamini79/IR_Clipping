// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKlcaAttachments, klcaFileUrl } from "./klca-auth";

// PII-free hand-crafted fixture, stored as UTF-8.
const html = readFileSync(new URL("./__fixtures__/klca-detail.html", import.meta.url), "utf8");

describe("parseKlcaAttachments", () => {
  const files = parseKlcaAttachments(html);

  it("extracts every attachment in the 첨부파일 section", () => {
    expect(files.length).toBe(4); // rNo=2613: 1 pdf + 2 hwp + 1 hwpx
  });

  it("keeps the real filename and a non-empty token", () => {
    for (const f of files) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.token.length).toBeGreaterThan(0);
    }
    expect(files[0].name).toContain("기업공시서식 작성기준");
    expect(files[0].name.endsWith(".pdf")).toBe(true);
    expect(files.some((f) => f.name.endsWith(".hwp"))).toBe(true);
    expect(files.some((f) => f.name.endsWith(".hwpx"))).toBe(true);
  });

  it("returns [] when there is no attachment section", () => {
    expect(parseKlcaAttachments("<html><body>no files</body></html>")).toEqual([]);
  });
});

describe("klcaFileUrl", () => {
  it("builds the BinDownload URL with the token verbatim", () => {
    expect(klcaFileUrl("ABC=/_123")).toBe(
      "https://www.klca.or.kr/common/bindownload/BinDownload.asp?filename=ABC=/_123"
    );
  });
});
