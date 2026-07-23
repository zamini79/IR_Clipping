import * as cheerio from "cheerio";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://www.fsc.go.kr";
export const FSC_REG_LIST = `${BASE}/po040200?curPage=1`;

// fsc.go.kr rejects generic bot user-agents with 403; a browser-like UA is
// required to get the server-rendered list page.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Converts the row's `YYYY-MM-DD` day text (observed KST, no time-of-day)
 * into a UTC ISO-8601 string. Never falls back to the current time.
 */
function parseDayToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export function parseFscReg(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];

  $("div.board-list-wrap > ul > li").each((_, li) => {
    const $li = $(li);
    const a = $li.find("div.subject a").first();
    const href = a.attr("href") ?? "";
    const title = a.text().trim();
    if (!title || !href) return;

    const url = new URL(href, BASE).href;
    const idMatch = href.match(/\/po040200\/(\d+)/);
    const sourceRef = idMatch ? idMatch[1] : url;

    // "담당부서 : 자산운용과" -> "자산운용과"
    const infoText = $li.find("div.info span").first().text().trim();
    const department = infoText.includes(":") ? infoText.split(":")[1]!.trim() : infoText;

    const dayText = $li.find("div.day").first().text().trim();
    const collectedAt = parseDayToIso(dayText);

    const files = $li
      .find("div.file-list")
      .toArray()
      .map((fileList) => {
        const fa = $(fileList).children("a").first();
        const fhref = fa.attr("href") ?? "";
        if (!fhref) return null;
        const name = fa.find("span.name").first().text().trim() || fa.attr("title")?.trim() || "";
        return { name, externalUrl: new URL(fhref, BASE).href };
      })
      .filter((f): f is { name: string; externalUrl: string } => f !== null);

    items.push({
      board: "fsc-reg",
      source: "금융위원회",
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

export const fscRegCollector: Collector = {
  board: "fsc-reg",
  source: "금융위원회",
  async collect() {
    const res = await fetch(FSC_REG_LIST, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) throw new Error(`FSC-REG ${res.status}`);
    return parseFscReg(await res.text());
  },
};
