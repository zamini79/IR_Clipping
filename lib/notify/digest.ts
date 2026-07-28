import { formatDate } from "../format";
import { boardLabel } from "../sources";

/** A newly collected post, as rendered in the digest email. */
export interface DigestItem {
  id: string;
  source: string; // 기관(대분류)
  board: string; // 수집기 id — 게시판(하위 분류) 컬럼으로 풀어 표시
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

// Same type system as the board. Webfonts don't load in most mail clients
// (Outlook on Windows ignores them entirely), so each stack falls back to a
// Korean-capable system face — Pretendard if the reader has it, else Malgun
// Gothic / Apple SD Gothic Neo.
const SANS =
  "'Pretendard','Pretendard Variable',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif";
const SERIF = "'Noto Serif KR','Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',serif";
const MONO = "'IBM Plex Mono',Consolas,'Courier New',monospace";

const TD = `padding:9px 10px;border-bottom:1px solid #efece3;font-family:${SANS};font-size:13px;vertical-align:top`;
const TH = `padding:10px;border-bottom:1px solid #1a2338;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.04em;color:#6a7180;text-align:center`;

/**
 * Builds the "new posts" digest: one table with
 * No · 출처 · 게시판 · 키워드 · 제목 · 등록일 · 링크, each row linking back to
 * the board — same columns, in the same order, as the list on the site.
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
<td style="${TD};font-family:${MONO};text-align:center;color:#b3b7c0">${i + 1}</td>
<td style="${TD};text-align:center;color:#9a7b46;white-space:nowrap">${esc(it.source)}</td>
<td style="${TD};text-align:center;color:#6a7180;white-space:nowrap">${esc(boardLabel(it.board)) || "—"}</td>
<td style="${TD};text-align:center;color:#8a6d3a">${esc(it.keyword) || "—"}</td>
<td style="${TD};color:#20242c">${esc(it.title)}</td>
<td style="${TD};font-family:${MONO};text-align:center;color:#6a7180;white-space:nowrap">${formatDate(it.collectedAt)}</td>
<td style="${TD};text-align:center;white-space:nowrap"><a href="${esc(url)}" style="color:#9a7b46;font-weight:600;text-decoration:none">바로가기 →</a></td>
</tr>`;
    })
    .join("");

  const html = `<div style="font-family:${SANS};color:#20242c">
<p style="font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:.2em;color:#9a7b46;margin:0 0 6px">IR CLIPPING</p>
<h2 style="font-family:${SERIF};font-size:19px;font-weight:600;margin:0 0 14px;color:#1a2338">공시 · 규제 정보 클리핑 신규 ${rows.length}건</h2>
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;max-width:900px;background:#fbfaf6">
<thead><tr style="background:#f4f1e8">
<th style="${TH}">No</th><th style="${TH}">출처</th><th style="${TH}">게시판</th><th style="${TH}">키워드</th>
<th style="${TH};text-align:left">제목</th><th style="${TH}">등록일</th><th style="${TH}">링크</th>
</tr></thead>
<tbody>${body}</tbody>
</table>
<p style="margin:16px 0 0;font-family:${SANS};font-size:12px;color:#8a8f99">
<a href="${esc(siteUrl)}" style="color:#9a7b46">게시판 전체 보기</a>
</p>
</div>`;

  const text = [
    subject,
    "",
    ...rows.map((it, i) => {
      const board = boardLabel(it.board);
      return `${i + 1}. [${it.source}${board ? ` · ${board}` : ""}]${it.keyword ? ` (${it.keyword})` : ""} ${it.title} — ${formatDate(it.collectedAt)}\n   ${postUrl(siteUrl, it.id)}`;
    }),
  ].join("\n");

  return { subject, html, text };
}
