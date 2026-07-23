import type { CollectedItem } from "../collectors/types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildDigest(items: CollectedItem[]): { subject: string; html: string; text: string } {
  const subject = `[IR 클리핑] 신규 ${items.length}건`;
  const bySource = new Map<string, CollectedItem[]>();
  for (const it of items) {
    const arr = bySource.get(it.source) ?? [];
    arr.push(it);
    bySource.set(it.source, arr);
  }
  const htmlParts: string[] = [`<h2>${esc(subject)}</h2>`];
  const textParts: string[] = [`${subject}\n`];
  for (const [source, arr] of bySource) {
    htmlParts.push(`<h3>${esc(source)} (${arr.length})</h3><ul>`);
    textParts.push(`\n[${source}] (${arr.length})`);
    for (const it of arr) {
      const date = it.collectedAt.slice(0, 10).replace(/-/g, ".");
      htmlParts.push(`<li><a href="${esc(it.sourceUrl)}">${esc(it.title)}</a> — ${date}</li>`);
      textParts.push(`- ${it.title} — ${date}\n  ${it.sourceUrl}`);
    }
    htmlParts.push(`</ul>`);
  }
  return { subject, html: htmlParts.join(""), text: textParts.join("\n") };
}
