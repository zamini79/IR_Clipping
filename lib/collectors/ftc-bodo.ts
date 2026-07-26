import * as cheerio from "cheerio";
import type { Collector, CollectedItem, CollectedFile } from "./types";

const BASE = "https://www.ftc.go.kr/www/";
export const FTC_BODO_LIST = `${BASE}selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02&pageIndex=1`;
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

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

    items.push({
      board: "ftc-bodo",
      source: "공정거래위원회",
      sourceRef,
      title,
      department,
      collectedAt,
      sourceUrl: url,
      body: "",
      // The only attachment link in a list row is downloadBbsFileAll.do — a zip
      // of every file, labelled "파일다운로드". Storing it would replace three
      // properly named documents with one mystery archive, so the real
      // attachments come from the detail page (enrichFtcBodo) instead.
      files: [],
    });
  });

  return items;
}

// Parses an FTC detail page for the body text and the real per-file
// attachments. Body is the raw inner HTML of the "내용" cell (cleaned to text at
// read time by mapRowToClipping). Attachments come from a.p-attach__link
// (downloadBbsFile.do), deliberately ignoring the document-viewer links
// (a.ico-view / previewBbsAtchmnfl / iframe.viewFrame) and the download-all zip.
export function parseFtcDetail(html: string): { body: string; files: CollectedFile[] } {
  const $ = cheerio.load(html);
  // The content cell lives inside malformed table markup that cheerio discards
  // during table normalization, so extract its inner HTML by regex instead.
  // (Attachments live in a <ul>, which cheerio parses fine.)
  const bodyMatch = html.match(
    /<td[^>]*class="[^"]*p-table__content[^"]*"[^>]*>([\s\S]*?)<\/td>/i
  );
  const body = bodyMatch ? bodyMatch[1].trim() : "";
  const files = $("li.p-attach__item a.p-attach__link")
    .toArray()
    .map((el) => {
      const $a = $(el);
      const href = $a.attr("href") ?? "";
      if (!href.includes("downloadBbsFile.do")) return null;
      const clone = $a.clone();
      clone.find(".p-attach__size").remove(); // drop the "(hwp, 253.0KB)" size span
      const name = clone.text().replace(/ /g, " ").replace(/\s+/g, " ").trim();
      return { name, externalUrl: new URL(href, BASE).href };
    })
    .filter((f): f is CollectedFile => f !== null);
  return { body, files };
}

// The list rows carry neither body nor usable attachments, so both come from
// the detail page. Retried once: a single flaky fetch would otherwise store the
// post with an empty body and no files (the hourly run repairs such rows later,
// but succeeding now is better). Per-item failures are swallowed so one bad
// page doesn't abort the collector.
export async function enrichFtcBodo(items: CollectedItem[]): Promise<CollectedItem[]> {
  const cutoff = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const it of items) {
    if (it.collectedAt < cutoff || !it.sourceUrl) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(it.sourceUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) continue;
        const { body, files } = parseFtcDetail(await res.text());
        it.body = body;
        it.files = files;
        break;
      } catch {
        // retry once, then leave the item as collected from the list
      }
    }
  }
  return items;
}

export const ftcBodoCollector: Collector = {
  board: "ftc-bodo",
  source: "공정거래위원회",
  async collect() {
    const res = await fetch(FTC_BODO_LIST, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FTC ${res.status}`);
    return enrichFtcBodo(parseFtcBodo(await res.text()));
  },
};
