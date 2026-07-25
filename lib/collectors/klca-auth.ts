import * as cheerio from "cheerio";
import iconv from "iconv-lite";
import type { CollectedFile, CollectedItem } from "./types";

const LOGIN_PAGE = "https://www.klca.or.kr/sub/main/login.asp";
const LOGIN_POST = "https://www.klca.or.kr/sub/main/login.asp?rWork=QryMemLogin";
const FILE_BASE = "https://www.klca.or.kr/common/bindownload/BinDownload.asp?filename=";
const UA = "IR-Clipping-Bot/1.0";

function toCookieHeader(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

// Logs into KLCA using KLCA_USER / KLCA_PASSWORD and returns a Cookie header
// string for authenticated requests, or null if credentials are not configured.
// The login form (in an iframe) posts ctlValue1=id, ctlValue2=pw to LOGIN_POST.
export async function klcaLogin(): Promise<string | null> {
  const user = process.env.KLCA_USER;
  const pass = process.env.KLCA_PASSWORD;
  if (!user || !pass) return null;

  const r0 = await fetch(LOGIN_PAGE, { headers: { "User-Agent": UA }, redirect: "manual" });
  const c0 = r0.headers.getSetCookie?.() ?? [];

  const body = `ctlValue1=${encodeURIComponent(user)}&ctlValue2=${encodeURIComponent(pass)}`;
  const r1 = await fetch(LOGIN_POST, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: LOGIN_PAGE,
      ...(c0.length ? { Cookie: toCookieHeader(c0) } : {}),
    },
    body,
    redirect: "manual",
  });
  if (!r1.ok && r1.status !== 302) throw new Error(`KLCA login failed: HTTP ${r1.status}`);
  const c1 = r1.headers.getSetCookie?.() ?? [];

  const cookie = toCookieHeader([...c0, ...c1]);
  // A logged-in session sets member cookies (cId/cName). Guard against a silent
  // no-op login (wrong creds) that would otherwise fetch login walls forever.
  if (!/(^|;\s*)cId=/.test(cookie) && !/ASPSESSIONID/i.test(cookie)) {
    throw new Error("KLCA login did not establish a session (check KLCA_USER/KLCA_PASSWORD)");
  }
  return cookie;
}

// Builds the authenticated download URL from a BinDownload token. The site
// concatenates the token verbatim into the query string, so we do the same.
export function klcaFileUrl(token: string): string {
  return `${FILE_BASE}${token}`;
}

// Parses the post body from a KLCA detail page. The board-read template holds
// the content in `div.b_content`; the inner HTML is returned so the read-time
// htmlToText() renders its line breaks. Returns "" when absent (some posts have
// no inline body — their content lives entirely in the attachment).
export function parseKlcaBody(html: string): string {
  const $ = cheerio.load(html);
  return ($("div.b_content").first().html() ?? "").trim();
}

// Parses the "첨부파일" section of a KLCA detail page into {name, token} pairs.
// Each attachment is an anchor: <a href="javascript:BinDownload('TOKEN');">NAME</a>.
export function parseKlcaAttachments(html: string): { name: string; token: string }[] {
  const $ = cheerio.load(html);
  const files: { name: string; token: string }[] = [];
  $("a[href*='BinDownload(']").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const m = href.match(/BinDownload\('([^']*)'\)/);
    if (!m) return;
    const name = $(a).text().trim();
    if (!name) return;
    files.push({ name, token: m[1] });
  });
  return files;
}

const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

// Fetches a login-gated KLCA detail page once and returns both its body and its
// attachments (as CollectedFiles carrying the session cookie so the download
// step can reach the members-only file URLs).
async function fetchKlcaDetail(detailUrl: string, cookie: string): Promise<{ body: string; files: CollectedFile[] }> {
  const res = await fetch(detailUrl, { headers: { "User-Agent": UA, Cookie: cookie, Referer: detailUrl } });
  if (!res.ok) throw new Error(`KLCA detail ${res.status}`);
  const html = iconv.decode(Buffer.from(await res.arrayBuffer()), "euc-kr");
  const files = parseKlcaAttachments(html).map((f) => ({
    name: f.name,
    externalUrl: klcaFileUrl(f.token),
    headers: { "User-Agent": UA, Cookie: cookie, Referer: detailUrl },
  }));
  return { body: parseKlcaBody(html), files };
}

// Enriches recent items (within the collect window) with the body and
// attachments from their login-gated detail pages. Without KLCA_USER/
// KLCA_PASSWORD the items are returned unchanged (body/files stay empty).
// Per-item failures are swallowed so one bad detail page never aborts the
// collector.
export async function enrichKlcaAttachments(items: CollectedItem[]): Promise<CollectedItem[]> {
  // Credentials absent -> silent skip (returns null). Credentials present but
  // login fails (e.g. malformed env value) -> throw, so the collector surfaces
  // the error via runCollectors instead of silently producing no attachments.
  const cookie = await klcaLogin();
  if (!cookie) return items;

  const cutoff = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const it of items) {
    if (it.collectedAt < cutoff) continue;
    try {
      const { body, files } = await fetchKlcaDetail(it.sourceUrl, cookie);
      it.files = files;
      it.body = body;
    } catch {
      // keep body: "" / files: [] on failure
    }
  }
  return items;
}
