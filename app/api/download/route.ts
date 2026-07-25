import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { contentDisposition } from "@/lib/download-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived signed URL for a Storage object and redirects to it.
 *
 *   GET ?id=<clippingFileId>        → inline: the browser renders it (PDF viewer, image…)
 *   GET ?id=<clippingFileId>&dl=1   → attachment: the browser saves it to disk
 *
 * Files are addressed by their clipping_files id, never by name or path: a URL
 * ending in ".hwp" makes the Hancom browser extension graft an "H" button and
 * an "rhwp로 열기" popup onto the link. The id keeps every attachment type
 * looking identical in the DOM.
 *
 * `path=<storagePath>` is still accepted for older links.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const pathParam = params.get("path");
  if (!id && !pathParam) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServiceClient();

  // Resolve the Storage key and the display filename (the key itself is
  // ASCII-sanitized, so Korean names only survive in clipping_files.name).
  let storagePath = pathParam ?? "";
  let name = "";
  if (id) {
    const { data: row } = await supabase
      .from("clipping_files")
      .select("storage_path,name")
      .eq("id", id)
      .maybeSingle();
    if (!row?.storage_path) return NextResponse.json({ error: "not found" }, { status: 404 });
    storagePath = row.storage_path;
    name = row.name ?? "";
  } else if (params.get("dl") === "1") {
    const { data: row } = await supabase
      .from("clipping_files")
      .select("name")
      .eq("storage_path", storagePath)
      .limit(1)
      .maybeSingle();
    name = row?.name ?? "";
  }

  const { data, error } = await supabase.storage
    .from("clipping-files")
    .createSignedUrl(storagePath, 60);
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Both modes stream through this route rather than redirecting to the signed
  // URL. Two reasons: the browser never touches a URL ending in ".hwp" (the
  // Hancom handler hooks those), and it never has to guess a filename from the
  // URL — the Storage key is ASCII-sanitized, so that guess yields "0-_._.hwpx".
  // The real name travels in Content-Disposition instead.
  const download = params.get("dl") === "1";
  const range = req.headers.get("range");
  const upstream = await fetch(data.signedUrl, range ? { headers: { Range: range } } : undefined);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }

  const headers = new Headers({
    // Downloads are deliberately typed as a generic binary so nothing tries to
    // render them; inline keeps the stored type (application/pdf → PDF viewer).
    "Content-Type": download
      ? "application/octet-stream"
      : upstream.headers.get("content-type") ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDisposition(name, download ? "attachment" : "inline"),
    // Inline avoids `no-store`: PDF viewers (notably the Adobe plugin on
    // Windows) re-request the document and fall back to downloading it when the
    // response may not be held even briefly. Still private — never CDN-cached.
    "Cache-Control": download ? "private, no-store" : "private, max-age=0, must-revalidate",
  });
  // Pass range metadata through so PDF viewers can seek within large files.
  for (const h of ["content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
