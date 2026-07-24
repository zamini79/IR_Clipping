import * as cheerio from "cheerio";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://dart.fss.or.kr";
const FSS_FILE_BASE = "https://www.fss.or.kr";
export const FSS_GUIDE02_LIST = `${BASE}/info/searchGuide02.do`;

// dart.fss.or.kr's list pages are only known to render for browser-like UAs.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Converts the row's `YYYY.MM.DD` (or `YYYY-MM-DD`) 작성일자 text (observed
 * KST, no time-of-day) into a UTC ISO-8601 string. Never falls back to the
 * current time.
 */
function parseDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4})[.-](\d{2})[.-](\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * The row's attachment anchors call `getFSSFileUrl(atchFileId, fileSn)`,
 * which the page's own JS resolves to a real, GET-able download URL:
 * https://www.fss.or.kr/fss/cmmn/file/fileDown.do?atchFileId=..&fileSn=..
 * `fileSn` is observed with a trailing space in the markup and is trimmed.
 */
function parseFiles($: cheerio.CheerioAPI, fileTd: ReturnType<cheerio.CheerioAPI>) {
  return fileTd
    .find("a")
    .toArray()
    .map((a) => {
      const $a = $(a);
      const onclick = $a.attr("onclick") ?? "";
      const m = onclick.match(/getFSSFileUrl\('([^']*)'\s*,\s*'([^']*)'\s*\)/);
      if (!m) return null;
      const [, atchFileId, fileSnRaw] = m;
      const fileSn = fileSnRaw.trim();
      const name = $a.find("button").first().attr("title")?.trim() ?? "";
      return {
        name,
        externalUrl: `${FSS_FILE_BASE}/fss/cmmn/file/fileDown.do?atchFileId=${atchFileId}&fileSn=${fileSn}`,
      };
    })
    .filter((f): f is { name: string; externalUrl: string } => f !== null);
}

// searchGuide02.do (공시유의사항) shares the fss-guide layout (table.tbList),
// except the title link calls `selectGongsi2('<seq>')` (note the trailing 2).
export function parseFssGuide02(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("table.tbList tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length < 6) return; // header/spacer rows

    const a = tds.eq(1).find("a").first();
    const title = a.text().trim();
    const onclick = a.attr("onclick") ?? "";
    const seqMatch = onclick.match(/selectGongsi2\('(\d+)'\)/);
    const sourceRef = seqMatch ? seqMatch[1] : "";
    if (!title || !sourceRef) return;

    const department = tds.eq(2).text().trim();
    const dateText = tds.eq(3).text().trim();
    const collectedAt = parseDateToIso(dateText);
    const files = parseFiles($, tds.eq(5));

    items.push({
      board: "fss-guide02",
      source: "금융감독원",
      sourceRef,
      title,
      department,
      collectedAt,
      // Deep-link to the post: selectGuide1.do?seqno=<seqno> renders the detail
      // via GET (the list's selectGongsi2() posts the same seqno to this action).
      sourceUrl: `${BASE}/info/selectGuide1.do?seqno=${sourceRef}`,
      body: "",
      files,
    });
  });

  return items;
}

export const fssGuide02Collector: Collector = {
  board: "fss-guide02",
  source: "금융감독원",
  async collect() {
    const res = await fetch(FSS_GUIDE02_LIST, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) throw new Error(`FSS-GUIDE02 ${res.status}`);
    return parseFssGuide02(await res.text());
  },
};
