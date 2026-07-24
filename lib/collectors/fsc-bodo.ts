import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";
import type { Collector, CollectedItem, CollectedFile } from "./types";

export const FSC_BODO_RSS = "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111";
const BASE = "https://www.fsc.go.kr";
// fsc.go.kr rejects generic bot UAs with 403; use a browser-like UA for the
// (public) detail pages, matching fsc-reg.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

/**
 * Converts the feed's `<dc:date>YYYY-MM-DD HH:MM:SS</dc:date>` (observed KST,
 * no timezone offset in the raw feed) into a UTC ISO-8601 string.
 * Never falls back to the current time — an unparseable date yields the
 * epoch so the failure is obvious in stored data rather than silently
 * masquerading as "now".
 */
function parseDcDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function parseFscBodo(xml: string): CollectedItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  return arr.map((it: Record<string, unknown>) => {
    const link = String(it.link ?? "").trim();
    const title = String(it.title ?? "").trim();
    // The live feed has no <pubDate>; dates come from Dublin Core <dc:date>
    // in "YYYY-MM-DD HH:MM:SS" form instead.
    const dcDate = String(it["dc:date"] ?? "").trim();
    const collectedAt = parseDcDateToIso(dcDate);
    // sourceRef: trailing numeric post id in the link, else the link itself.
    const idMatch = link.match(/\/(\d+)(?:\?|$)/);
    const sourceRef = idMatch ? idMatch[1] : link;
    return {
      board: "fsc-bodo",
      source: "금융위원회",
      sourceRef,
      title,
      // The RSS feed carries no per-item department/division field.
      department: "",
      collectedAt,
      sourceUrl: link,
      body: String(it.description ?? "").trim(),
      // No enclosure/attachment tags appear in this feed.
      files: [],
    };
  });
}

// Parses the "첨부파일 목록" section of an FSC detail page into CollectedFiles.
// The FSC board template uses div.file-list whose first child <a href="/comm/
// getFile?..."> holds the filename in span.name — identical to fsc-reg's rows.
export function parseFscDetailFiles(html: string): CollectedFile[] {
  const $ = cheerio.load(html);
  return $("div.file-list")
    .toArray()
    .map((fl) => {
      const fa = $(fl).children("a").first();
      const href = fa.attr("href") ?? "";
      if (!href) return null;
      const name = fa.find("span.name").first().text().trim() || fa.attr("title")?.trim() || "";
      return { name, externalUrl: new URL(href, BASE).href };
    })
    .filter((f): f is CollectedFile => f !== null);
}

// The RSS feed carries no attachments, so enrich recent items by fetching their
// (public) detail page and parsing its 첨부파일 목록. Bounded to the collect
// window; per-item failures are swallowed so one bad page doesn't abort the run.
export async function enrichFscBodoFiles(items: CollectedItem[]): Promise<CollectedItem[]> {
  const cutoff = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const it of items) {
    if (it.collectedAt < cutoff || !it.sourceUrl) continue;
    try {
      const res = await fetch(it.sourceUrl, { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) continue;
      it.files = parseFscDetailFiles(await res.text());
    } catch {
      // keep files: [] on failure
    }
  }
  return items;
}

export const fscBodoCollector: Collector = {
  board: "fsc-bodo",
  source: "금융위원회",
  async collect() {
    const res = await fetch(FSC_BODO_RSS, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FSC RSS ${res.status}`);
    return enrichFscBodoFiles(parseFscBodo(await res.text()));
  },
};
