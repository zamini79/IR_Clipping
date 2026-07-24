// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFscBodo, parseFscDetailFiles } from "./fsc-bodo";

const xml = readFileSync(new URL("./__fixtures__/fsc-bodo.xml", import.meta.url), "utf8");
const detailHtml = readFileSync(new URL("./__fixtures__/fsc-detail.html", import.meta.url), "utf8");

describe("parseFscBodo", () => {
  const items = parseFscBodo(xml);
  it("parses at least one item", () => {
    expect(items.length).toBeGreaterThan(0);
  });
  it("sets board and source", () => {
    expect(items[0].board).toBe("fsc-bodo");
    expect(items[0].source).toBe("금융위원회");
  });
  it("each item has title, sourceUrl, sourceRef, ISO collectedAt", () => {
    for (const it of items) {
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives collectedAt from the feed's dc:date, not the current time", () => {
    // fixture's first item is dc:date 2026-07-23 00:00:00 (KST) -> 2026-07-22T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-07-22T15:00:00.000Z");
    expect(items[0].sourceRef).toBe("87397");
    expect(items[0].sourceUrl).toBe("https://www.fsc.go.kr/no010101/87397");
  });
});

describe("parseFscDetailFiles", () => {
  const files = parseFscDetailFiles(detailHtml);
  it("extracts every attachment from the detail 첨부파일 목록", () => {
    expect(files.length).toBe(2); // 1 hwp + 1 pdf
  });
  it("keeps the real filename and an absolute getFile URL", () => {
    expect(files[0].name).toContain("단일종목 레버리지");
    expect(files[0].name.endsWith(".hwp")).toBe(true);
    expect(files[0].externalUrl).toBe(
      "https://www.fsc.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=87403&fileTy=ATTACH&fileNo=1"
    );
    expect(files[1].name.endsWith(".pdf")).toBe(true);
  });
  it("returns [] when there is no attachment section", () => {
    expect(parseFscDetailFiles("<html><body>none</body></html>")).toEqual([]);
  });
});
