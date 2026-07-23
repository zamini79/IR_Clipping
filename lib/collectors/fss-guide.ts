import * as cheerio from "cheerio";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://dart.fss.or.kr";
const FSS_FILE_BASE = "https://www.fss.or.kr";
export const FSS_GUIDE_LIST = `${BASE}/info/searchGuide.do`;

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

export function parseFssGuide(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("table.tbList tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    if (tds.length < 6) return; // header/spacer rows

    const a = tds.eq(1).find("a").first();
    const title = a.text().trim();
    const onclick = a.attr("onclick") ?? "";
    const seqMatch = onclick.match(/selectGongsi\('(\d+)'\)/);
    const sourceRef = seqMatch ? seqMatch[1] : "";
    if (!title || !sourceRef) return;

    const department = tds.eq(2).text().trim();
    const dateText = tds.eq(3).text().trim();
    const collectedAt = parseDateToIso(dateText);
    const files = parseFiles($, tds.eq(5));

    items.push({
      board: "fss-guide",
      source: "금융감독원",
      sourceRef,
      title,
      department,
      collectedAt,
      // No navigable per-post URL exists: the title link is a `#gongsi`
      // fragment and the real detail route only accepts POST with a
      // hidden-form `seqno`, same limitation as fss-bodo. See
      // docs/superpowers/research/2026-07-23-dart-search-request.md.
      sourceUrl: FSS_GUIDE_LIST,
      body: "",
      files,
    });
  });

  return items;
}

export const fssGuideCollector: Collector = {
  board: "fss-guide",
  source: "금융감독원",
  async collect() {
    const res = await fetch(FSS_GUIDE_LIST, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) throw new Error(`FSS-GUIDE ${res.status}`);
    return parseFssGuide(await res.text());
  },
};
