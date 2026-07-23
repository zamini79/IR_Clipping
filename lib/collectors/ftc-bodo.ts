import * as cheerio from "cheerio";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://www.ftc.go.kr/www/";
export const FTC_BODO_LIST = `${BASE}selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02&pageIndex=1`;

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

export function parseFtcBodo(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("table.p-table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const a = $tr.find('td.p-subject a[href*="nttSn="]').first();
    const href = a.attr("href") ?? "";
    const title = a.find("span.p-table__text").first().text().trim() || a.text().trim();
    if (!title || !href) return;

    const nttSn = (href.match(/nttSn=(\d+)/) ?? [])[1] ?? "";
    const url = new URL(href, BASE).href;
    const sourceRef = nttSn || url;

    const tds = $tr.find("td");
    const department = tds.eq(3).text().trim();
    const dateText = tds.eq(4).text().trim();
    const collectedAt = parseDateToIso(dateText);

    const files = tds
      .eq(5)
      .find("a")
      .toArray()
      .filter((el) => (el.attribs?.href ?? "").includes("downloadBbsFileAll.do"))
      .map((el) => {
        const $a = $(el);
        const fhref = $a.attr("href") ?? "";
        return { name: $a.text().trim(), externalUrl: new URL(fhref, BASE).href };
      });

    items.push({
      board: "ftc-bodo",
      source: "공정거래위원회",
      sourceRef,
      title,
      department,
      collectedAt,
      sourceUrl: url,
      body: "",
      files,
    });
  });

  return items;
}

export const ftcBodoCollector: Collector = {
  board: "ftc-bodo",
  source: "공정거래위원회",
  async collect() {
    const res = await fetch(FTC_BODO_LIST, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FTC ${res.status}`);
    return parseFtcBodo(await res.text());
  },
};
