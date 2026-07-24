import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { storagePathFor, humanSize } from "@/lib/collectors/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "clipping-files";
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50MB
const DEFAULT_BATCH = 12;

// One-time / incremental archival pass: copies already-collected attachments
// (clipping_files rows that have an external_url but no storage_path yet) into
// Supabase Storage, then records storage_path. Processes a bounded batch per
// call so each invocation stays within the function timeout — call repeatedly
// (or on a temporary schedule) until `remaining` reaches 0.
//
// Kept separate from /api/collect on purpose: collect only uploads attachments
// for freshly-inserted rows, so pre-existing rows (or any that were skipped
// because the bucket did not exist yet) need this backfill.
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  const batch = Math.max(
    1,
    Math.min(100, Number(new URL(req.url).searchParams.get("batch") ?? DEFAULT_BATCH))
  );
  const errors: string[] = [];

  // Candidates: not yet in Storage but have a source URL to fetch from.
  const { data: rows, error: qErr } = await supabase
    .from("clipping_files")
    .select("id, name, external_url, storage_path, clippings(board, source_ref)")
    .eq("storage_path", "")
    .neq("external_url", "")
    .limit(batch);

  if (qErr) {
    return NextResponse.json({ error: `query: ${qErr.message}` }, { status: 500 });
  }

  let archived = 0;
  for (const row of (rows ?? []) as unknown as ArchiveRow[]) {
    const parent = Array.isArray(row.clippings) ? row.clippings[0] : row.clippings;
    if (!parent) {
      errors.push(`${row.id}: missing parent clipping`);
      continue;
    }
    try {
      const res = await fetch(row.external_url);
      if (!res.ok) throw new Error(`fetch HTTP ${res.status}`);
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_ATTACHMENT_BYTES) throw new Error(`content-length ${len} exceeds cap`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`body ${bytes.byteLength} exceeds cap`);

      // Use the file's uuid (+ original extension) as the key so Korean/parens
      // filenames can't collide after ASCII-sanitization. The display filename
      // stays in clipping_files.name.
      const ext = row.name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "";
      const path = storagePathFor(parent.board, parent.source_ref, `${row.id}${ext}`);
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const { error: updErr } = await supabase
        .from("clipping_files")
        .update({ storage_path: path, size: humanSize(bytes.byteLength) })
        .eq("id", row.id);
      if (updErr) throw new Error(`update: ${updErr.message}`);
      archived++;
    } catch (e) {
      errors.push(`${row.id} (${row.name}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // How many candidates still remain after this batch.
  const { count: remaining } = await supabase
    .from("clipping_files")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", "")
    .neq("external_url", "");

  return NextResponse.json(
    { archived, remaining: remaining ?? null, errors },
    { status: errors.length > 0 ? 500 : 200 }
  );
}

interface ArchiveRow {
  id: string;
  name: string;
  external_url: string;
  storage_path: string;
  clippings: { board: string; source_ref: string } | { board: string; source_ref: string }[] | null;
}
