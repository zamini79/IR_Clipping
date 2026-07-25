/**
 * Builds a Content-Disposition header that forces a save (never an in-browser
 * open) while preserving a Korean filename.
 *
 * Both forms are emitted: `filename=` with an ASCII fallback for old clients and
 * RFC 5987 `filename*=UTF-8''…` which modern browsers prefer. CR/LF and quotes
 * are stripped so a filename can't inject extra headers.
 */
export function attachmentDisposition(name: string): string {
  const clean = (name ?? "").replace(/[\r\n"\\]/g, "").trim() || "download";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}
