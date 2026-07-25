import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived signed URL for a Storage object and redirects to it.
 *
 *   GET ?path=<storagePath>        → inline: the browser renders it (PDF viewer, image…)
 *   GET ?path=<storagePath>&dl=1   → attachment: the browser saves it to disk
 *
 * The download filename comes from clipping_files.name because the Storage key
 * is ASCII-sanitized (Korean names are replaced with underscores there).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const path = params.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("clipping-files")
    .createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });

  let url = data.signedUrl;
  if (params.get("dl") === "1") {
    const { data: row } = await supabase
      .from("clipping_files")
      .select("name")
      .eq("storage_path", path)
      .limit(1)
      .maybeSingle();
    // Append `download` ourselves instead of using supabase-js's { download }
    // option: that option percent-encodes the name and the Storage server
    // encodes it a second time, so Korean filenames are saved as "%EC%9C%A0…".
    // An empty value still forces the attachment, using the object key's name.
    url += `&download=${encodeURIComponent(row?.name ?? "")}`;
  }
  return NextResponse.redirect(url);
}
