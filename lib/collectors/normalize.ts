import type { CollectedItem } from "./types";

export function dedupKey(item: Pick<CollectedItem, "board" | "sourceRef">): string {
  return `${item.board}::${item.sourceRef}`;
}

export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  const qi = s.indexOf("?");
  if (qi === -1) return s;
  const base = s.slice(0, qi);
  const params = new URLSearchParams(s.slice(qi + 1));
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  return qs ? `${base}?${qs}` : base;
}

export function itemToRow(item: CollectedItem) {
  return {
    category: "disclosure" as const,
    board: item.board,
    source: item.source,
    source_ref: item.sourceRef,
    source_url: item.sourceUrl,
    title: item.title,
    department: item.department,
    body: item.body,
    collected_at: item.collectedAt,
  };
}
