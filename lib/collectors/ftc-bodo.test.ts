// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFtcBodo, parseFtcDetail } from "./ftc-bodo";

const html = readFileSync(new URL("./__fixtures__/ftc-bodo.html", import.meta.url), "utf8");
const detailHtml = readFileSync(new URL("./__fixtures__/ftc-detail.html", import.meta.url), "utf8");

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

describe("parseFtcDetail", () => {
  const { body, files } = parseFtcDetail(detailHtml);

  it("extracts the body text (raw HTML from the 내용 cell)", () => {
    expect(body).toContain("건설업계 상생협력");
    expect(body).toContain("협약식을 개최");
  });

  it("extracts real per-file attachments, ignoring the viewer links", () => {
    expect(files.length).toBe(3); // hwp + hwpx + pdf; viewer links excluded
    for (const f of files) {
      expect(f.externalUrl).toMatch(/downloadBbsFile\.do\?atchmnflNo=\d+/);
      expect(f.externalUrl).not.toContain("previewBbsAtchmnfl");
    }
    // real filename, size span stripped
    expect(files[0].name).toBe("260724(참고) 중견 건설업계 대상 상생협약 체결_수정.hwp");
    expect(files[0].name).not.toContain("KB");
    expect(files.some((f) => f.name.endsWith(".pdf"))).toBe(true);
  });

  it("returns empty for a page with no content/attachments", () => {
    const r = parseFtcDetail("<html><body>x</body></html>");
    expect(r.files).toEqual([]);
  });
});
