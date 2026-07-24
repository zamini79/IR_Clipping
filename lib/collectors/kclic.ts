import * as cheerio from "cheerio";
import type { Collector, CollectedItem, CollectedFile } from "./types";

const BASE = "https://kclic.krx.co.kr";
export const KCLIC_NOTICE = `${BASE}/sprtroom/notice.do`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";

function grabCookies(res: Response, jar: Map<string, string>): void {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [kv] = sc.split(";");
    const i = kv.indexOf("=");
    if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  }
}
const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

// Logs into KCLIC (usrId/pw). KCLIC blocks concurrent sessions: if an existing
// session is detected the normal login is rejected, so we retry with
// method=reLogin, which force-disconnects the other session and proceeds.
// Returns a Cookie header, or null if credentials are not configured.
export async function kclicLogin(): Promise<string | null> {
  const usrId = process.env.KCLIC_USER;
  const pw = process.env.KCLIC_PASSWORD;
  if (!usrId || !pw) return null;

  const jar = new Map<string, string>();
  grabCookies(await fetch(KCLIC_NOTICE, { headers: { "User-Agent": UA } }), jar);

  async function submit(method: string, usr_id: string) {
    const body = new URLSearchParams({ method, usrId: usrId!, pw: pw!, usr_id }).toString();
    const res = await fetch(`${BASE}/main/ssl/login.do?method=${method}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(jar),
        Referer: KCLIC_NOTICE,
      },
      body,
    });
    grabCookies(res, jar);
    return res.text();
  }

  const first = await submit("login", "");
  const errorCode = (first.match(/name="errorCode"[^>]*value="([^"]*)"/) ?? [])[1] ?? "";
  // Duplicate-session prompt -> force re-login (disconnect the other session).
  if (/reLogin|중복|이미|다른 곳|중복접속|접속 중/i.test(first) || errorCode) {
    await submit("reLogin", usrId);
  }

  // Verify the session is authenticated (login gate gone on the notice page).
  const check = await fetch(KCLIC_NOTICE, { headers: { "User-Agent": UA, Cookie: cookieHeader(jar) } });
  const html = await check.text();
  if (/id="upw"|name="pw"/.test(html)) {
    // Diagnostic detail: helps distinguish bad creds vs IP/geo restriction
    // (KCLIC works from a KR IP locally but the prod function runs in US/iad1).
    throw new Error(
      `KCLIC login failed (still gated). loginRespLen=${first.length} errorCode="${errorCode}" noticeLen=${html.length}`
    );
  }
  return cookieHeader(jar);
}

/** `YYYY-MM-DD` (KST) -> UTC ISO. Never falls back to the current time. */
function parseDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

// GET download URL for a KCLIC attachment (works with the session cookie).
export function kclicFileUrl(contId: string, attachSeq: string, name: string): string {
  const q = new URLSearchParams({
    method: "searchBbsAttachFile",
    SCREN_ID: "JLDODS25000.jsp",
    sprtRoomNo: contId,
    attachSeq,
    attachFileNm: name,
  });
  return `${BASE}/sprtroom/fileDownload.do?${q.toString()}`;
}

export interface KclicNotice {
  contId: string;
  title: string;
  department: string;
  collectedAt: string;
  files: { name: string; seq: string }[];
}

// Parses the server-rendered KCLIC notice list table. Rows have a title cell
// (td.tl); columns are 번호/제목/담당기관/등록일/첨부. The detail id comes from
// fn_detail('<contId>'), attachments from fn_fileDownload('<contId>','<seq>','<name>').
export function parseKclicNotices(html: string): KclicNotice[] {
  const $ = cheerio.load(html);
  const out: KclicNotice[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const titleCell = $tr.find("td.tl").first();
    if (titleCell.length === 0) return;
    const rowHtml = $.html($tr);
    const contId = (rowHtml.match(/fn_detail\('(\d+)'/) ?? [])[1] ?? "";
    if (!contId) return;
    const title = titleCell.text().trim();
    const tds = $tr.find("td");
    const department = tds.eq(2).text().trim();
    const collectedAt = parseDateToIso(tds.eq(3).text().trim());
    const files: { name: string; seq: string }[] = [];
    tds.eq(4).find('a[href*="fn_fileDownload"]').each((__, a) => {
      const h = $(a).attr("href") ?? "";
      const m = h.match(/fn_fileDownload\('(\d+)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\)/);
      if (m) files.push({ seq: m[2], name: m[3] });
    });
    out.push({ contId, title, department, collectedAt, files });
  });
  return out;
}

// Converts parsed notices to CollectedItems. Attachments carry the session
// cookie so the download step can reach the (login-gated) file endpoint. The
// detail page is POST-only (no shareable URL), so sourceUrl points at the list.
export function noticesToItems(notices: KclicNotice[], cookie: string): CollectedItem[] {
  return notices.map((n) => ({
    board: "kclic",
    source: n.department || "한국거래소",
    sourceRef: n.contId,
    title: n.title,
    department: n.department,
    collectedAt: n.collectedAt,
    sourceUrl: KCLIC_NOTICE,
    body: "",
    files: n.files.map((f): CollectedFile => ({
      name: f.name,
      externalUrl: kclicFileUrl(n.contId, f.seq, f.name),
      headers: { "User-Agent": UA, Cookie: cookie, Referer: KCLIC_NOTICE },
    })),
  }));
}

export const kclicCollector: Collector = {
  board: "kclic",
  source: "한국거래소",
  async collect() {
    const cookie = await kclicLogin();
    if (!cookie) return []; // credentials absent -> nothing (silent)
    const res = await fetch(KCLIC_NOTICE, { headers: { "User-Agent": UA, Cookie: cookie } });
    if (!res.ok) throw new Error(`KCLIC notice ${res.status}`);
    return noticesToItems(parseKclicNotices(await res.text()), cookie);
  },
};
