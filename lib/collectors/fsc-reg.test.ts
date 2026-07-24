// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFscReg, parseFscRegDetailBody } from "./fsc-reg";

const html = readFileSync(new URL("./__fixtures__/fsc-reg.html", import.meta.url), "utf8");
const detailHtml = readFileSync(new URL("./__fixtures__/fsc-reg-detail.html", import.meta.url), "utf8");

describe("parseFscReg", () => {
  const items = parseFscReg(html);
  it("parses multiple rows", () => {
    expect(items.length).toBeGreaterThan(3);
  });
  it("sets board/source and required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("fsc-reg");
      expect(it.source).toBe("금융위원회");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives sourceRef from the post id and builds an absolute detail URL", () => {
    expect(items[0].sourceUrl).toContain(items[0].sourceRef);
    expect(items[0].sourceUrl).toMatch(/^https:\/\/www\.fsc\.go\.kr\/po040200\//);
  });
  it("derives collectedAt from the row's day cell (KST), not the current time", () => {
    // fixture's first row day cell is 2026-07-22 (KST) -> 2026-07-21T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-07-21T15:00:00.000Z");
    expect(items[0].sourceRef).toBe("87392");
  });
  it("extracts department from the info line", () => {
    expect(items[0].department).toBe("자산운용과");
  });
  it("extracts attachment files present in the list row", () => {
    const withFiles = items.find((it) => it.files.length > 0);
    expect(withFiles).toBeDefined();
    expect(withFiles!.files[0].name.length).toBeGreaterThan(0);
    expect(withFiles!.files[0].externalUrl).toMatch(/^https?:\/\//);
  });
});

describe("parseFscRegDetailBody", () => {
  it("extracts the detail-page body (div.board-view-wrap div.cont) as HTML", () => {
    const body = parseFscRegDetailBody(detailHtml);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain("금융위원회 공고 제2026-551호");
    expect(body).toContain("여신전문금융업 등록사실을 공고합니다");
    // Inner HTML is preserved so read-time htmlToText renders the <br> breaks.
    expect(body).toMatch(/<br\s*\/?>/i);
  });
  it("returns '' when no content container exists", () => {
    expect(parseFscRegDetailBody("<html><body><p>nope</p></body></html>")).toBe("");
  });
});
