import { formatDate } from "../format";

/** A newly collected post, as rendered in the digest email. */
export interface DigestItem {
  id: string;
  source: string;
  keyword: string; // FnGuide only; "" for disclosure posts
  title: string;
  collectedAt: string; // ISO
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Board deep-link for a post: the board opens its detail on ?id=. */
export function postUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/?id=${encodeURIComponent(id)}`;
}

const TD = "padding:9px 10px;border-bottom:1px solid #efece3;font-size:13px;vertical-align:top";
const TH =
  "padding:10px;border-bottom:1px solid #1a2338;font-size:11px;letter-spacing:.04em;color:#6a7180;text-align:center";

/**
 * Builds the "new posts" digest: one table with
 * No · 출처 · 키워드 · 제목 · 등록일 · 링크, each row linking back to the board.
 *
 * Table-based markup with inline styles — email clients strip <style> blocks
 * and most modern CSS.
 */
export function buildDigest(
  items: DigestItem[],
  siteUrl: string
): { subject: string; html: string; text: string } {
  // Newest first, so the most recent post is row 1.
  const rows = [...items].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  const subject = `[IR 클리핑] 신규 ${rows.length}건`;

  const body = rows
    .map((it, i) => {
      const url = postUrl(siteUrl, it.id);
      return `<tr>
<td style="${TD};text-align:center;color:#b3b7c0">${i + 1}</td>
<td style="${TD};text-align:center;color:#9a7b46;white-space:nowrap">${esc(it.source)}</td>
<td style="${TD};text-align:center;color:#8a6d3a">${esc(it.keyword) || "—"}</td>
<td style="${TD};color:#20242c">${esc(it.title)}</td>
<td style="${TD};text-align:center;color:#6a7180;white-space:nowrap">${formatDate(it.collectedAt)}</td>
<td style="${TD};text-align:center;white-space:nowrap"><a href="${esc(url)}" style="color:#9a7b46;font-weight:600;text-decoration:none">바로가기 →</a></td>
</tr>`;
    })
    .join("");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;color:#20242c">
<p style="font:600 11px/1 monospace;letter-spacing:.2em;color:#9a7b46;margin:0 0 6px">IR CLIPPING</p>
<h2 style="font-size:18px;margin:0 0 14px;color:#1a2338">공시 · 규제 정보 클리핑 신규 ${rows.length}건</h2>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:900px;background:#fbfaf6">
<thead><tr style="background:#f4f1e8">
<th style="${TH}">No</th><th style="${TH}">출처</th><th style="${TH}">키워드</th>
<th style="${TH};text-align:left">제목</th><th style="${TH}">등록일</th><th style="${TH}">링크</th>
</tr></thead>
<tbody>${body}</tbody>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#8a8f99">
<a href="${esc(siteUrl)}" style="color:#9a7b46">게시판 전체 보기</a>
</p>
</div>`;

  const text = [
    subject,
    "",
    ...rows.map(
      (it, i) =>
        `${i + 1}. [${it.source}]${it.keyword ? ` (${it.keyword})` : ""} ${it.title} — ${formatDate(it.collectedAt)}\n   ${postUrl(siteUrl, it.id)}`
    ),
  ].join("\n");

  return { subject, html, text };
}
