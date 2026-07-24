// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import iconv from "iconv-lite";
import { parseKlcaNews } from "./klca-news";

const raw = readFileSync(new URL("./__fixtures__/klca-news.html", import.meta.url));
const html = iconv.decode(raw, "euc-kr");

describe("parseKlcaNews", () => {
  const items = parseKlcaNews(html);
  it("parses multiple rows", () => {
    expect(items.length).toBeGreaterThan(3);
  });
  it("sets board/source and required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("klca-news");
      expect(it.source).toBe("상장회사협의회");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives sourceRef from the rNo post id", () => {
    expect(items[0].sourceUrl).toContain(items[0].sourceRef);
    expect(items[0].sourceRef).toBe("893");
  });
  it("derives collectedAt from the row's date cell (KST), not the current time", () => {
    // fixture's first row date cell is 2026-07-20 (KST) -> 2026-07-19T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-07-19T15:00:00.000Z");
  });
  it("extracts department from the row", () => {
    expect(items[0].department).toBe("기업법제팀");
  });
});
