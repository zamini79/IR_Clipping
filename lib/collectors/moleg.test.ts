// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseMolegList, parseMolegDetail, titleMatchesKeyword } from "./moleg";

const listHtml = readFileSync(new URL("./__fixtures__/moleg-list.html", import.meta.url), "utf8");

describe("titleMatchesKeyword", () => {
  it("accepts the keyword as its own word", () => {
    expect(titleMatchesKeyword("상법 시행령 일부개정령안 입법예고", "상법")).toBe(true);
    expect(titleMatchesKeyword("미래등기시스템 도입을 위한 상법 등 4개 법률", "상법")).toBe(true);
    expect(titleMatchesKeyword("「상법」 일부개정", "상법")).toBe(true);
    expect(titleMatchesKeyword("상법시행령 개정", "상법")).toBe(true); // trailing Hangul is fine
  });
  it("rejects it when it only continues a longer word", () => {
    // These are what the site's substring search drags in.
    expect(titleMatchesKeyword("기상법 시행령 일부개정령안", "상법")).toBe(false);
    expect(titleMatchesKeyword("공무원 재해보상법 시행령", "상법")).toBe(false);
    expect(titleMatchesKeyword("국가배상법 일부개정법률안", "상법")).toBe(false);
    expect(titleMatchesKeyword("내수면가두리양식업보상법 시행령", "상법")).toBe(false);
  });
  it("returns false when the keyword is absent", () => {
    expect(titleMatchesKeyword("전자금융거래법 개정", "자본시장")).toBe(false);
  });
});

describe("parseMolegList", () => {
  const items = parseMolegList(listHtml, "상법");

  it("keeps only the rows genuinely about the keyword", () => {
    expect(items.map((i) => i.sourceRef)).toEqual(["86866", "85000"]);
  });

  it("sets board/source/keyword and the required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("moleg");
      expect(it.source).toBe("법제처");
      expect(it.keyword).toBe("상법");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https:\/\/moleg\.go\.kr\/lawinfo\/makingInfo\.mo\?/);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("derives sourceRef from lawSeq and links to that notice", () => {
    expect(items[0].sourceRef).toBe("86866");
    expect(items[0].sourceUrl).toContain("lawSeq=86866");
  });

  it("takes 소관부처 as the department", () => {
    expect(items[0].department).toBe("법무부");
  });

  it("uses the 시작일자 cell (KST) as the date, not the current time", () => {
    // 2026-05-28 KST -> 2026-05-27T15:00:00.000Z
    expect(items[0].collectedAt).toBe("2026-05-27T15:00:00.000Z");
  });
});

describe("parseMolegDetail", () => {
  const detail = `<html><body>
    <section class="content_body"><div class="tstyle_view"><div class="tb_contents">
      <p class="HStyle0"><span>⊙금융위원회공고제2026-250호</span></p>
      <p>「자본시장과 금융투자업에 관한 법률 시행령」 입법예고를 하는데 있어…</p>
    </div></div></section>
    <span><a href="https://www.lawmaking.go.kr/file/download/10709532/I5RK5TD359FE9V2MK1GS">(법령안) 자본시장과 금융투자업에 관한 법률 시행령 입법예고(안).pdf</a></span>
    <span><a href="https://www.lawmaking.go.kr/file/download/10709528/E328USA9TKBXN2GABTLL">(법령안) 자본시장과 금융투자업에 관한 법률 시행령 입법예고(안).hwpx</a></span>
    <span><a href="https://www.lawmaking.go.kr/file/download/10709528/E328USA9TKBXN2GABTLL">중복 링크</a></span>
  </body></html>`;

  it("extracts the notice text as HTML", () => {
    const { body } = parseMolegDetail(detail);
    expect(body).toContain("금융위원회공고제2026-250호");
    expect(body).toMatch(/<p/i); // markup kept for read-time htmlToText
  });

  it("extracts each attachment with its real filename, deduped by URL", () => {
    const { files } = parseMolegDetail(detail);
    expect(files).toHaveLength(2);
    expect(files[0].name.endsWith(".pdf")).toBe(true);
    expect(files[1].name.endsWith(".hwpx")).toBe(true);
    expect(files[0].externalUrl).toMatch(/^https:\/\/www\.lawmaking\.go\.kr\/file\/download\//);
  });

  it("returns empty values when the page has neither", () => {
    expect(parseMolegDetail("<html><body>nope</body></html>")).toEqual({ body: "", files: [] });
  });
});
