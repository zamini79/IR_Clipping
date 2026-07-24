export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function padNo(n: number): string {
  return String(n).padStart(2, "0");
}

export function attachmentLabel(count: number): string {
  return count > 0 ? `📎 ${count}` : "—";
}

const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&middot;": "·", "&rsquo;": "’",
  "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
  "&hellip;": "…", "&ndash;": "–", "&mdash;": "—",
};

// Converts an HTML fragment (as delivered by some feeds/boards) into readable
// plain text: block/line-break tags become newlines, remaining tags are
// stripped, HTML entities are decoded, and whitespace is collapsed. Used so the
// detail view never shows raw markup.
export function htmlToText(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<\/\s*(p|div|tr|td|th|li|h[1-6]|table|thead|tbody)\s*>/gi, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });
  s = s.replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (m) => NAMED_ENTITIES[m] ?? m);
  s = s.replace(/[ \t\f\v\r]+/g, " ");
  s = s.replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
