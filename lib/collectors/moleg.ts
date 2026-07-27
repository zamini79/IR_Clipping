import * as cheerio from "cheerio";
import type { Collector, CollectedItem, CollectedFile } from "./types";
import { MOLEG_KEYWORDS } from "../sources";

const BASE = "https://moleg.go.kr";
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export { MOLEG_KEYWORDS };

/** 입법예고 search for one keyword. 50 rows is the whole first page. */
export function molegListUrl(keyword: string): string {
  return `${BASE}/lawinfo/makingList.mo?mid=a10104010000&pageCnt=50&keyField=lmNm&keyWord=${encodeURIComponent(keyword)}`;
}

/**
 * The site matches the keyword anywhere in the title, so "상법" also returns
 * 기상법, 재해보상법, 국가배상법 and 내수면가두리양식업보상법 — none of which
 * belong on an IR board. Require the keyword not to continue a longer Korean
 * word, i.e. the character before it must not be a Hangul syllable. Anything
 * after it is fine ("상법시행령" is still 상법).
 */
export function titleMatchesKeyword(title: string, keyword: string): boolean {
  for (let i = title.indexOf(keyword); i !== -1; i = title.indexOf(keyword, i + 1)) {
    if (i === 0 || !/[가-힣]/.test(title[i - 1])) return true;
  }
  return false;
}

/** `YYYY-MM-DD` (KST) -> UTC ISO. Never falls back to the current time. */
function parseDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * Parses a 입법예고 result page. Columns are
 * 법령종류 / 입법예고명 / 소관부처 / 시작일자 / 종료일자; the title links to
 * makingInfo.mo?…lawSeq=<id>. Rows whose title only matches the keyword as part
 * of a longer word are dropped.
 */
export function parseMolegList(html: string, keyword: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("table").first().find("tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    const a = tds.eq(1).find("a").first();
    const href = a.attr("href") ?? "";
    const title = a.text().replace(/\s+/g, " ").trim();
    if (!title || !href) return;
    if (!titleMatchesKeyword(title, keyword)) return;

    const lawSeq = (href.match(/lawSeq=(\d+)/) ?? [])[1] ?? "";
    const url = new URL(href, BASE).href;

    items.push({
      board: "moleg",
      source: "법제처",
      keyword,
      sourceRef: lawSeq || url,
      title,
      department: tds.eq(2).text().replace(/\s+/g, " ").trim(),
      // 입법예고 시작일 — the date the notice was published.
      collectedAt: parseDateToIso(tds.eq(3).text().trim()),
      sourceUrl: url,
      body: "",
      files: [],
    });
  });

  return items;
}

/**
 * Parses a 입법예고 detail page: the notice text (div.tb_contents, kept as HTML
 * so read-time htmlToText renders it) and its attachments, which are hosted on
 * 국민참여입법센터 (lawmaking.go.kr) with the filename as the link text.
 */
export function parseMolegDetail(html: string): { body: string; files: CollectedFile[] } {
  const $ = cheerio.load(html);
  const body = ($("div.tb_contents").first().html() ?? "").trim();
  const seen = new Set<string>();
  const files: CollectedFile[] = [];
  $("a[href*='lawmaking.go.kr/file/download']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const name = $(a).text().replace(/\s+/g, " ").trim();
    if (!href || !name || seen.has(href)) return;
    seen.add(href);
    files.push({ name, externalUrl: href });
  });
  return { body, files };
}

/** Fills in body + attachments from each recent item's detail page. */
export async function enrichMoleg(items: CollectedItem[]): Promise<CollectedItem[]> {
  const cutoff = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const it of items) {
    if (it.collectedAt < cutoff || !it.sourceUrl) continue;
    try {
      const res = await fetch(it.sourceUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const { body, files } = parseMolegDetail(await res.text());
      it.body = body;
      it.files = files;
    } catch {
      // leave the list-derived item as-is; the hourly run repairs it later
    }
  }
  return items;
}

export const molegCollector: Collector = {
  board: "moleg",
  source: "법제처",
  async collect() {
    // A notice can match both keywords; keep one item and tag it with each.
    const byRef = new Map<string, CollectedItem>();
    const keywords = new Map<string, Set<string>>();
    for (const kw of MOLEG_KEYWORDS) {
      const res = await fetch(molegListUrl(kw), { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`MOLEG(${kw}) ${res.status}`);
      for (const it of parseMolegList(await res.text(), kw)) {
        if (!byRef.has(it.sourceRef)) byRef.set(it.sourceRef, it);
        (keywords.get(it.sourceRef) ?? keywords.set(it.sourceRef, new Set()).get(it.sourceRef)!).add(kw);
      }
    }
    for (const [ref, it] of byRef) it.keyword = [...(keywords.get(ref) ?? [])].join(", ");
    return enrichMoleg([...byRef.values()]);
  },
};
