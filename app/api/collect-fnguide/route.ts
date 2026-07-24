import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { runCollectors } from "@/lib/collect-run";
import { itemToRow, dedupKey } from "@/lib/collectors/normalize";
import { uploadAttachment } from "@/lib/collectors/attachments";
import { fnguideCollector } from "@/lib/collectors/fnguide";
import type { CollectedItem } from "@/lib/collectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

// FnGuide (keyword-based, category=fnguide) runs on its own low-frequency
// schedule — separate from the hourly /api/collect — because it logs in (which
// force-disconnects the user's single FnGuide session) and does many keyword
// searches + PDF downloads that would slow/timeout the shared hourly run.
// Newly-inserted items are emailed by the hourly run's un-notified backlog digest.
export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  const errors: string[] = [];

  async function insertItem(it: CollectedItem) {
    const { data, error } = await supabase.from("clippings").insert(itemToRow(it)).select("id").single();
    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) return;
      throw new Error(`insert ${dedupKey(it)}: ${error.message}`);
    }
    const clippingId = data!.id as string;
    let fileIdx = 0;
    for (const f of it.files) {
      const uploaded = await uploadAttachment(
        {
          fetchBytes: async (url, headers, postForm) => {
            let res: Response;
            if (postForm) {
              const fd = new FormData();
              for (const [k, v] of Object.entries(postForm)) fd.append(k, v);
              res = await fetch(url, { method: "POST", headers, body: fd });
            } else {
              res = await fetch(url, headers ? { headers } : undefined);
            }
            if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            if (buf.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`body ${buf.byteLength} exceeds cap`);
            return buf;
          },
          upload: async (path, bytes) => {
            const { error: upErr } = await supabase.storage
              .from("clipping-files")
              .upload(path, bytes, { upsert: true, contentType: "application/pdf" });
            if (upErr) throw upErr;
          },
        },
        it.board, it.sourceRef, { ...f, name: `${fileIdx}-${f.name}` }
      );
      fileIdx++;
      const { error: fileErr } = await supabase.from("clipping_files").insert({
        clipping_id: clippingId,
        name: f.name,
        size: uploaded?.size ?? "",
        storage_path: uploaded?.storagePath ?? "",
        external_url: it.sourceUrl, // FnGuide PDF is behind login; link to the report viewer
      });
      if (fileErr) errors.push(`clipping_files [${it.sourceRef}] ${f.name}: ${fileErr.message}`);
    }
  }

  const cutoffIso = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { newItems, errors: collectErrors } = await runCollectors({
    collectors: [fnguideCollector],
    minCollectedAt: cutoffIso,
    isExisting: async (key) => {
      const [board, ...rest] = key.split("::");
      const source_ref = rest.join("::");
      const { count } = await supabase
        .from("clippings")
        .select("id", { count: "exact", head: true })
        .eq("board", board)
        .eq("source_ref", source_ref);
      return (count ?? 0) > 0;
    },
    insertItem,
  });
  errors.push(...collectErrors);

  return NextResponse.json({ new: newItems.length, errors }, { status: errors.length > 0 ? 500 : 200 });
}
