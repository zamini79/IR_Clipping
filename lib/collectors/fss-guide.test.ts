// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFssGuide } from "./fss-guide";

const html = readFileSync(new URL("./__fixtures__/fss-guide.html", import.meta.url), "utf8");

describe("parseFssGuide", () => {
  const items = parseFssGuide(html);
  it("parses multiple rows", () => {
    expect(items.length).toBeGreaterThan(3);
  });
  it("sets board/source and required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("fss-guide");
      expect(it.source).toBe("금융감독원");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives sourceRef from the selectGongsi(seqno) JS argument", () => {
    expect(items[0].sourceRef).toBe("446");
  });
  it("falls back sourceUrl to the board list URL (no navigable per-post URL exists)", () => {
    expect(items[0].sourceUrl).toBe("https://dart.fss.or.kr/info/searchGuide.do");
  });
  it("derives collectedAt from the row's 작성일자 cell (KST), not the current time", () => {
    // fixture's first row date cell is 2026.07.23 (KST) -> 2026-07-22T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-07-22T15:00:00.000Z");
  });
  it("extracts non-empty department from at least one row", () => {
    expect(items.some((it) => it.department.trim().length > 0)).toBe(true);
    expect(items[0].department).toBe("기업공시국");
  });
  it("extracts attachment download links present in the list row", () => {
    const withFiles = items.find((it) => it.files.length > 0);
    expect(withFiles).toBeDefined();
    expect(withFiles!.files[0].externalUrl).toMatch(/^https?:\/\/.*fileDown\.do\?atchFileId=/);
    expect(withFiles!.files[0].name.length).toBeGreaterThan(0);
  });
});
