import { describe, it, expect } from "vitest";
import { buildDigest, postUrl, type DigestItem } from "./digest";

const SITE = "https://ir-clipping.vercel.app";

function item(id: string, source: string, title: string, collectedAt: string, keyword = ""): DigestItem {
  return { id, source, keyword, title, collectedAt };
}

describe("buildDigest", () => {
  const items = [
    item("id-a", "금융위원회", "A 규정 개정", "2026-07-21T15:00:00.000Z"),
    item("id-b", "공정거래위원회", "B 지침", "2026-07-23T15:00:00.000Z"),
    item("id-c", "삼성증권", "C 리포트", "2026-07-22T15:00:00.000Z", "MSCI"),
  ];

  it("subject includes the total new count", () => {
    expect(buildDigest(items, SITE).subject).toContain("3");
  });

  it("renders one table row per post with every column", () => {
    const { html } = buildDigest(items, SITE);
    for (const h of ["No", "출처", "키워드", "제목", "등록일", "링크"]) expect(html).toContain(h);
    expect(html.match(/<tr>/g)?.length).toBe(items.length); // header row uses its own markup
    for (const s of ["A 규정 개정", "B 지침", "C 리포트", "금융위원회", "공정거래위원회"]) {
      expect(html).toContain(s);
    }
  });

  it("links each post to its board detail (?id=)", () => {
    const { html, text } = buildDigest(items, SITE);
    for (const it of items) {
      expect(html).toContain(`${SITE}/?id=${it.id}`);
      expect(text).toContain(`${SITE}/?id=${it.id}`);
    }
  });

  it("shows the FnGuide keyword and a dash for disclosure posts", () => {
    const { html } = buildDigest(items, SITE);
    expect(html).toContain("MSCI");
    expect(html).toContain("—");
  });

  it("orders newest first", () => {
    const { text } = buildDigest(items, SITE);
    expect(text.indexOf("B 지침")).toBeLessThan(text.indexOf("C 리포트"));
    expect(text.indexOf("C 리포트")).toBeLessThan(text.indexOf("A 규정 개정"));
  });

  it("formats 등록일 in KST (KST-midnight rows must not shift a day)", () => {
    const { html } = buildDigest([item("id-x", "s", "t", "2026-07-22T15:00:00.000Z")], SITE);
    expect(html).toContain("2026.07.23");
  });

  it("escapes HTML in titles", () => {
    const { html } = buildDigest([item("id-z", "s", "<script>x</script>", "2026-07-23T00:00:00.000Z")], SITE);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("postUrl", () => {
  it("builds a board deep link and tolerates a trailing slash", () => {
    expect(postUrl("https://x.dev", "abc")).toBe("https://x.dev/?id=abc");
    expect(postUrl("https://x.dev/", "abc")).toBe("https://x.dev/?id=abc");
  });
});
