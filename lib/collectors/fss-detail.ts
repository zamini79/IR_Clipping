import * as cheerio from "cheerio";
import type { CollectedItem } from "./types";

// dart.fss.or.kr's pages are only known to render for browser-like UAs.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

/**
 * Extracts the post body from a DART detail page. All three boards
 * (보도자료 / 안내·해설 / 공시유의사항) use the same board-view template, whose
 * content lives in the `td.main_txt` cell. The inner HTML is returned so the
 * read-time htmlToText() renders its <br>/<p> line breaks. Returns "" when the
 * cell is absent or empty.
 */
export function parseFssDetailBody(html: string): string {
  const $ = cheerio.load(html);
  return ($("td.main_txt").first().html() ?? "").trim();
}

/**
 * The DART list pages carry no body text, so enrich recent items (within the
 * collect window) by fetching their detail deep-link and extracting the
 * content. Per-item failures are swallowed so one bad page never aborts a run.
 */
export async function enrichFssBodies(items: CollectedItem[]): Promise<CollectedItem[]> {
  const cutoff = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const it of items) {
    if (it.collectedAt < cutoff || !it.sourceUrl) continue;
    try {
      const res = await fetch(it.sourceUrl, { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) continue;
      it.body = parseFssDetailBody(await res.text());
    } catch {
      // keep body: "" on failure
    }
  }
  return items;
}
