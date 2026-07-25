/**
 * Builds a Content-Disposition header carrying the real (Korean) filename.
 *
 * `attachment` forces a save; `inline` lets the browser render it while still
 * naming the file — without this the browser falls back to the URL's basename,
 * which for us is the ASCII-sanitized Storage key (e.g. "0-_._.hwpx").
 *
 * Both forms are emitted: `filename=` with an ASCII fallback for old clients and
 * RFC 5987 `filename*=UTF-8''…` which modern browsers prefer. CR/LF and quotes
 * are stripped so a filename can't inject extra headers.
 */
export function contentDisposition(name: string, mode: "inline" | "attachment"): string {
  const clean = (name ?? "").replace(/[\r\n"\\]/g, "").trim() || "download";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}
