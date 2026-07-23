// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFscReg } from "./fsc-reg";

const html = readFileSync(new URL("./__fixtures__/fsc-reg.html", import.meta.url), "utf8");

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
