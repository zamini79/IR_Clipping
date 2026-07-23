import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://www.klca.or.kr/sub/comm/";
export const KLCA_DOC_LIST = `${BASE}official_document.asp`;

/**
 * Converts the row's `YYYY-MM-DD` date text (observed KST, no time-of-day)
 * into a UTC ISO-8601 string. Never falls back to the current time.
 */
function parseDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function parseKlcaDoc(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("table.board_normal tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find("td");
    const a = tds.eq(1).find("a").first();
    const href = a.attr("href") ?? "";
    const title = a.text().trim();
    if (!title || !href) return;

    const rNo = (href.match(/rNo=(\d+)/) ?? [])[1] ?? "";
    const url = new URL(href, BASE).href;
    const sourceRef = rNo || url;

    const dateText = tds.eq(2).text().trim();
    const department = tds.eq(3).text().trim();
    const collectedAt = parseDateToIso(dateText);

    items.push({
      board: "klca-doc",
      source: "상장회사협의회",
      sourceRef,
      title,
      department,
      collectedAt,
      sourceUrl: url,
      body: "",
      // No attachment column in the list row; files (if any) only appear on the detail page.
      files: [],
    });
  });

  return items;
}

export const klcaDocCollector: Collector = {
  board: "klca-doc",
  source: "상장회사협의회",
  async collect() {
    const res = await fetch(KLCA_DOC_LIST, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`KLCA-DOC ${res.status}`);
    // The site serves EUC-KR; decoding as UTF-8 would corrupt the Korean text.
    const buf = Buffer.from(await res.arrayBuffer());
    const html = iconv.decode(buf, "euc-kr");
    return parseKlcaDoc(html);
  },
};
