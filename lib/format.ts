/**
 * Formats a post's date as "YYYY.MM.DD" in KST.
 *
 * Collectors store a source's day as KST midnight, i.e. 15:00Z on the previous
 * day — formatting those UTC parts would show every post one day early.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .replace(/-/g, ".");
}

// Formats an ISO timestamp as "YYYY.MM.DD HH:mm" in KST (Asia/Seoul). Used for
// the header's "최근 수집" time. Returns "" for empty/invalid input.
export function formatDateTimeKst(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
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
  // Some sources (e.g. FTC) emit &nbsp without the trailing semicolon; treat as space.
  s = s.replace(/&nbsp;?/gi, " ");
  s = s.replace(/[ \t\f\v\r]+/g, " ");
  s = s.replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
