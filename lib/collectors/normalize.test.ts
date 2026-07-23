import { describe, it, expect } from "vitest";
import { dedupKey, itemToRow, normalizeUrl } from "./normalize";
import type { CollectedItem } from "./types";

const item: CollectedItem = {
  board: "fsc-bodo", source: "금융위원회", sourceRef: "87397",
  title: "보도자료 제목", department: "첨단산업1과",
  collectedAt: "2026-07-23T00:00:00.000Z",
  sourceUrl: "https://www.fsc.go.kr/no010101/87397", body: "",
  files: [{ name: "a.pdf", externalUrl: "https://x/a.pdf" }],
};

describe("dedupKey", () => {
  it("combines board and sourceRef", () => {
    expect(dedupKey(item)).toBe("fsc-bodo::87397");
  });
});

describe("itemToRow", () => {
  it("maps to snake_case disclosure row", () => {
    const r = itemToRow(item);
    expect(r.category).toBe("disclosure");
    expect(r.board).toBe("fsc-bodo");
    expect(r.source_ref).toBe("87397");
    expect(r.source_url).toBe("https://www.fsc.go.kr/no010101/87397");
    expect(r.title).toBe("보도자료 제목");
    expect(r.department).toBe("첨단산업1과");
    expect(r.collected_at).toBe("2026-07-23T00:00:00.000Z");
  });
});

describe("normalizeUrl", () => {
  it("sorts query params and trims", () => {
    expect(normalizeUrl(" https://x/y?b=2&a=1 ")).toBe("https://x/y?a=1&b=2");
  });
  it("leaves paramless url unchanged", () => {
    expect(normalizeUrl("https://x/y")).toBe("https://x/y");
  });
});
