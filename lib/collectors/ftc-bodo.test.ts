// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFtcBodo } from "./ftc-bodo";

const html = readFileSync(new URL("./__fixtures__/ftc-bodo.html", import.meta.url), "utf8");

describe("parseFtcBodo", () => {
  const items = parseFtcBodo(html);
  it("parses multiple rows", () => {
    expect(items.length).toBeGreaterThan(3);
  });
  it("sets board/source and required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("ftc-bodo");
      expect(it.source).toBe("공정거래위원회");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives sourceRef from nttSn", () => {
    expect(items[0].sourceUrl).toContain(items[0].sourceRef);
    expect(items[0].sourceRef).toBe("47774");
  });
  it("derives collectedAt from the row's date cell (KST), not the current time", () => {
    // fixture's first row date cell is 2026-07-23 (KST) -> 2026-07-22T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-07-22T15:00:00.000Z");
  });
  it("extracts department from the row", () => {
    expect(items[0].department).toBe("기업집단결합정책과");
  });
  it("extracts attachment download link present in the list row", () => {
    const withFiles = items.find((it) => it.files.length > 0);
    expect(withFiles).toBeDefined();
    expect(withFiles!.files[0].externalUrl).toMatch(/^https?:\/\/.*downloadBbsFileAll\.do/);
  });
});
