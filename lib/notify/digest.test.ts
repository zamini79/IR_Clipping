import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
import type { CollectedItem } from "../collectors/types";

function it2(board: string, source: string, title: string, url: string): CollectedItem {
  return { board, source, sourceRef: url, title, department: "", collectedAt: "2026-07-23T00:00:00.000Z", sourceUrl: url, body: "", files: [] };
}

describe("buildDigest", () => {
  const items = [
    it2("fsc-bodo", "금융위원회", "A 규정 개정", "https://x/a"),
    it2("ftc-bodo", "공정거래위원회", "B 지침", "https://x/b"),
    it2("fsc-bodo", "금융위원회", "C 공고", "https://x/c"),
  ];
  it("subject includes total new count", () => {
    expect(buildDigest(items).subject).toContain("3");
  });
  it("groups by source and includes every title and link", () => {
    const { html, text } = buildDigest(items);
    for (const s of ["A 규정 개정", "B 지침", "C 공고", "https://x/a", "https://x/b", "https://x/c"]) {
      expect(html).toContain(s);
      expect(text).toContain(s);
    }
    expect(html).toContain("금융위원회");
    expect(html).toContain("공정거래위원회");
  });
  it("escapes HTML in titles", () => {
    const { html } = buildDigest([it2("b", "s", "<script>x</script>", "https://x/z")]);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
