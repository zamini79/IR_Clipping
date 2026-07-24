import crypto from "node:crypto";
import type { Collector, CollectedItem, CollectedFile } from "./types";

const BASE = "https://www.fnguide.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";
const PDF_DOWNLOAD = `${BASE}/Research/GetPdfFileForDownload`;
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

// Keyword list to search FnGuide research for (not exhaustive collection).
export const FNGUIDE_KEYWORDS = [
  "SK바이오사이언스", "SKBioscience", "삼성바이오로직스", "GC녹십자", "한미약품", "유한양행",
  "제약바이오 전망", "제약바이오 동향", "백신", "mRNA", "CGT", "PCV", "폐렴구균", "MSCI",
  "JPMHC", "JPMHealthcare", "JPM헬스케어", "감염병", "독감", "대상포진", "수두", "인플루엔자",
  "RSV", "IDT",
];

// ---- cookie jar helpers -----------------------------------------------------
type Jar = Map<string, string>;
function grab(res: Response, jar: Jar): void {
  for (const sc of res.headers.getSetCookie?.() ?? []) {
    const [kv] = sc.split(";");
    const i = kv.indexOf("=");
    if (i <= 0) continue;
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1);
    if (/expires=Thu, 01 Jan 1970/i.test(sc) || v === "") jar.delete(k);
    else jar.set(k, v);
  }
}
const cookieHeader = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

function reconstructPem(raw: string): string {
  const b = raw.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN PUBLIC KEY-----\n${b.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----\n`;
}
// FnGuide encrypts the password with RSA-OAEP/SHA-256 (node-forge default) using
// a per-page public key. Node's publicEncrypt with OAEP + sha256 matches it.
function rsaEncrypt(pem: string, value: string): string {
  return crypto
    .publicEncrypt({ key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(value, "utf8"))
    .toString("base64");
}
function decodeEntities(s: string): string {
  return s.replace(/&#x2B;/g, "+").replace(/&#x3D;/g, "=").replace(/&#x2F;/g, "/").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

// Logs into FnGuide and returns a Cookie header (with FN_USER_INFO_* session),
// or null if credentials are not configured. Handles the single-session limit:
// loginType=1 first; on 80115/80116 (another device) retry loginType=2 to force
// the other session off (as the site's "계속 로그인" confirm does).
export async function fnguideLogin(): Promise<string | null> {
  const userId = process.env.FNGUIDE_USER;
  const pw = process.env.FNGUIDE_PASSWORD;
  if (!userId || !pw) return null;
  const jar: Jar = new Map();

  async function attempt(loginType: string) {
    const r0 = await fetch(`${BASE}/Users/Login`, { headers: { "User-Agent": UA, Cookie: cookieHeader(jar) } });
    grab(r0, jar);
    const html = await r0.text();
    const pem = reconstructPem((html.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/) ?? [""])[0]);
    const token = (html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/) ?? [])[1] ?? "";
    const fd = new FormData();
    fd.append("loginType", loginType);
    fd.append("userId", userId!);
    fd.append("userPassword", rsaEncrypt(pem, pw!));
    const r1 = await fetch(`${BASE}/Users/UserLogin`, {
      method: "POST",
      headers: { "User-Agent": UA, Cookie: cookieHeader(jar), Referer: `${BASE}/Users/Login`, RequestVerificationToken: token, "X-Requested-With": "XMLHttpRequest" },
      body: fd,
    });
    grab(r1, jar);
    return JSON.parse(await r1.text()) as { returnCode: string; returnMessage: string };
  }

  let res = await attempt("1");
  // returnCode arrives as a string ("80115") or a number (0) depending on the
  // response — normalize with String() before comparing.
  const rc = (r: { returnCode: unknown }) => String(r.returnCode);
  if (rc(res) === "80115" || rc(res) === "80116") res = await attempt("2");
  if (rc(res) !== "0") {
    throw new Error(`FnGuide login failed (returnCode=${res.returnCode} ${res.returnMessage})`);
  }
  return cookieHeader(jar);
}

/** ANL_DT "YY.MM.DD" (KST) -> UTC ISO. Never falls back to the current time. */
function anlDtToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (m) {
    const d = new Date(`20${m[1]}-${m[2]}-${m[3]}T00:00:00+09:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}
/** KST YYYY.MM.DD for a Date. */
function kstDot(d: Date): string {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return s.replace(/-/g, ".");
}

export interface FnReport {
  rptId: string;
  title: string;
  brokerage: string;
  analysts: string;
  anlDt: string; // ISO
}

// Maps a GetReports dataSet array to reports. Pure (no I/O) for testability.
export function parseReports(dataSet: unknown): FnReport[] {
  if (!Array.isArray(dataSet)) return [];
  return dataSet
    .map((r: Record<string, unknown>): FnReport | null => {
      const rptId = r.RPT_ID != null ? String(r.RPT_ID) : "";
      const title = String(r.RPT_TITLE ?? "").trim();
      if (!rptId || !title) return null;
      const brokerage = (r.BROKERAGE as { NAME?: string })?.NAME ?? "";
      const analysts = Array.isArray(r.ANALYSTS)
        ? (r.ANALYSTS as { NAME?: string }[]).map((a) => a.NAME).filter(Boolean).join(", ")
        : "";
      return { rptId, title, brokerage, analysts, anlDt: anlDtToIso(String(r.ANL_DT ?? "")) };
    })
    .filter((r): r is FnReport => r !== null);
}

async function searchKeyword(cookie: string, keyword: string, minDt: string, maxDt: string): Promise<FnReport[]> {
  const fd = new FormData();
  fd.append("srchKeyword", keyword);
  fd.append("srchTypeCode", "");
  fd.append("srchCode", "");
  fd.append("minDt", minDt);
  fd.append("maxDt", maxDt);
  fd.append("ordCol", "ANL_DT");
  fd.append("ordDir", "D");
  fd.append("curPage", "1");
  fd.append("perPage", "100");
  fd.append("useDb", "false");
  fd.append("menuCd", "");
  const res = await fetch(`${BASE}/Research/GetReports`, {
    method: "POST",
    headers: { "User-Agent": UA, Cookie: cookie, Referer: `${BASE}/Research/SearchReport`, "X-Requested-With": "XMLHttpRequest" },
    body: fd,
  });
  if (!res.ok) throw new Error(`GetReports(${keyword}) ${res.status}`);
  const json = JSON.parse(await res.text());
  // Results are nested at dataSet.reports (dataSet itself is an object with
  // reports/searchEngineResult/searchInfo).
  return parseReports(json?.dataSet?.reports ?? json?.dataSet);
}

// Fetches the per-report documentData token needed to download its PDF.
async function fetchDocumentData(cookie: string, rptId: string): Promise<string> {
  const res = await fetch(`${BASE}/Research/PdfViewer?rptId=${rptId}`, { headers: { "User-Agent": UA, Cookie: cookie } });
  const html = await res.text();
  return decodeEntities((html.match(/id="documentData"[^>]*value="([^"]*)"/) ?? [])[1] ?? "");
}

// Builds a CollectedItem for a report, resolving its PDF into a POST-download
// CollectedFile (GetPdfFileForDownload with the documentData token + cookie).
async function reportToItem(cookie: string, r: FnReport): Promise<CollectedItem> {
  let files: CollectedFile[] = [];
  try {
    const documentData = await fetchDocumentData(cookie, r.rptId);
    if (documentData) {
      files = [{
        name: `${r.title}.pdf`,
        externalUrl: PDF_DOWNLOAD,
        headers: { "User-Agent": UA, Cookie: cookie, Referer: `${BASE}/Research/PdfViewer?rptId=${r.rptId}` },
        postForm: { documentData },
      }];
    }
  } catch {
    // no attachment if the viewer/token fetch fails
  }
  return {
    board: "fnguide",
    category: "fnguide",
    source: r.brokerage || "FnGuide",
    sourceRef: r.rptId,
    title: r.title,
    department: r.analysts,
    collectedAt: r.anlDt,
    sourceUrl: `${BASE}/Research/PdfViewer?rptId=${r.rptId}`,
    body: "",
    files,
  };
}

export const fnguideCollector: Collector = {
  board: "fnguide",
  source: "FnGuide",
  async collect() {
    const cookie = await fnguideLogin();
    if (!cookie) return []; // credentials absent -> silent skip
    const maxDt = kstDot(new Date());
    const minDt = kstDot(new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000));
    // The server date filter isn't reliably applied, so enforce the window
    // client-side by report date.
    const cutoffIso = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Search every keyword, dedup reports by RPT_ID (a report can match many),
    // keeping only reports within the collection window.
    const byId = new Map<string, FnReport>();
    const errors: string[] = [];
    for (const kw of FNGUIDE_KEYWORDS) {
      try {
        for (const rep of await searchKeyword(cookie, kw, minDt, maxDt)) {
          if (rep.anlDt >= cutoffIso && !byId.has(rep.rptId)) byId.set(rep.rptId, rep);
        }
      } catch (e) {
        errors.push(`${kw}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (byId.size === 0 && errors.length === FNGUIDE_KEYWORDS.length) {
      throw new Error(`FnGuide search failed for all keywords: ${errors[0]}`);
    }
    const items: CollectedItem[] = [];
    for (const rep of byId.values()) items.push(await reportToItem(cookie, rep));
    return items;
  },
};
