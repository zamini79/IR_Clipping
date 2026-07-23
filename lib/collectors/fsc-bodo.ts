import { XMLParser } from "fast-xml-parser";
import type { Collector, CollectedItem } from "./types";

export const FSC_BODO_RSS = "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111";

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

export const fscBodoCollector: Collector = {
  board: "fsc-bodo",
  source: "금융위원회",
  async collect() {
    const res = await fetch(FSC_BODO_RSS, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FSC RSS ${res.status}`);
    return parseFscBodo(await res.text());
  },
};
