// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFscBodo } from "./fsc-bodo";

const xml = readFileSync(new URL("./__fixtures__/fsc-bodo.xml", import.meta.url), "utf8");

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
