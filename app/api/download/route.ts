import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

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

  let url = data.signedUrl;
  if (params.get("dl") === "1") {
    // Append `download` ourselves instead of using supabase-js's { download }
    // option: that option percent-encodes the name and the Storage server
    // encodes it a second time, so Korean filenames are saved as "%EC%9C%A0…".
    // An empty value still forces the attachment, using the object key's name.
    url += `&download=${encodeURIComponent(name)}`;
  }
  return NextResponse.redirect(url);
}
