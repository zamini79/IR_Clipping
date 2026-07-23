import { describe, it, expect } from "vitest";
import { buildBoardView, PER_PAGE } from "./board-view";
import type { Clipping } from "./types";

function make(n: number): Clipping[] {
  // newest first; item[0] is newest
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    category: "disclosure" as const,
    board: "seed",
    title: `제목 ${i}`,
    source: i === 0 ? "금융감독원" : "한국거래소",
    sourceRef: `id-${i}`,
    sourceUrl: "",
    department: i === 1 ? "IR기획팀" : "공시제도팀",
    body: "본문",
    collectedAt: "2026-07-21T00:00:00.000Z",
    createdAt: "2026-07-21T00:00:00.000Z",
    files: i % 2 === 0 ? [{ id: `f-${i}`, name: "a.pdf", size: "1MB", storagePath: "p", externalUrl: "" }] : [],
  }));
}

describe("buildBoardView", () => {
  it("numbers rows descending, zero-padded (newest gets highest No)", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows[0].no).toBe("08");
    expect(v.rows[5].no).toBe("03");
  });

  it("marks the two newest items as NEW", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows[0].isNew).toBe(true);
    expect(v.rows[1].isNew).toBe(true);
    expect(v.rows[2].isNew).toBe(false);
  });

  it("paginates to PER_PAGE items per page", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows).toHaveLength(PER_PAGE);
    expect(v.total).toBe(8);
    expect(v.pageCount).toBe(2);
  });

  it("returns the second page slice", () => {
    const v = buildBoardView(make(8), { query: "", page: 1 });
    expect(v.rows).toHaveLength(2);
    expect(v.rows[0].no).toBe("02");
  });

  it("clamps page above range to last page", () => {
    const v = buildBoardView(make(8), { query: "", page: 99 });
    expect(v.page).toBe(1);
    expect(v.rows).toHaveLength(2);
  });

  it("filters by title, department, and source case-insensitively", () => {
    const v = buildBoardView(make(8), { query: "ir기획", page: 0 });
    expect(v.total).toBe(1);
    expect(v.rows[0].department).toBe("IR기획팀");
  });

  it("keeps No/NEW based on full list even when filtered", () => {
    const v = buildBoardView(make(8), { query: "금융감독원", page: 0 });
    expect(v.total).toBe(1);
    expect(v.rows[0].no).toBe("08");
    expect(v.rows[0].isNew).toBe(true);
  });

  it("sets attachment label and hasAttachment", () => {
    const v = buildBoardView(make(2), { query: "", page: 0 });
    expect(v.rows[0].attachmentLabel).toBe("📎 1");
    expect(v.rows[0].hasAttachment).toBe(true);
    expect(v.rows[1].attachmentLabel).toBe("—");
    expect(v.rows[1].hasAttachment).toBe(false);
  });

  it("reports pageCount 1 and empty rows for no matches", () => {
    const v = buildBoardView(make(8), { query: "존재하지않는검색어", page: 0 });
    expect(v.total).toBe(0);
    expect(v.pageCount).toBe(1);
    expect(v.rows).toHaveLength(0);
  });
});
