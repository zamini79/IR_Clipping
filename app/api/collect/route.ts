import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { runCollectors } from "@/lib/collect-run";
import { itemToRow, dedupKey } from "@/lib/collectors/normalize";
import { uploadAttachment } from "@/lib/collectors/attachments";
import { buildDigest } from "@/lib/notify/digest";
import { sendDigest } from "@/lib/notify/mailer";
import { fscBodoCollector } from "@/lib/collectors/fsc-bodo";
import { fscRegCollector } from "@/lib/collectors/fsc-reg";
import { ftcBodoCollector } from "@/lib/collectors/ftc-bodo";
import { klcaDocCollector } from "@/lib/collectors/klca-doc";
import { klcaLawCollector } from "@/lib/collectors/klca-law";
import { fssBodoCollector } from "@/lib/collectors/fss-bodo";
import { fssGuideCollector } from "@/lib/collectors/fss-guide";
import type { CollectedItem } from "@/lib/collectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COLLECTORS = [
  fscBodoCollector,
  fscRegCollector,
  ftcBodoCollector,
  klcaDocCollector,
  klcaLawCollector,
  fssBodoCollector,
  fssGuideCollector,
];

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50MB

// Backlog row shape returned by the un-notified query (Fix 1).
interface BacklogRow {
  id: string;
  board: string;
  source: string;
  title: string;
  source_url: string;
  collected_at: string;
}

// Maps a minimal backlog row to a CollectedItem for buildDigest, which only
// reads source/sourceUrl/title/collectedAt. The remaining fields are
// harmless defaults since they are not rendered by the digest.
function backlogRowToItem(row: BacklogRow): CollectedItem {
  return {
    board: row.board,
    source: row.source,
    sourceRef: row.id,
    title: row.title,
    department: "",
    collectedAt: row.collected_at,
    sourceUrl: row.source_url,
    body: "",
    files: [],
  };
}

export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();
  const errors: string[] = [];

  async function insertItem(it: CollectedItem) {
    const { data, error } = await supabase.from("clippings").insert(itemToRow(it)).select("id").single();
    if (error) {
      // Fix 4: overlapping runs can race on the unique (board, source_ref)
      // index. Treat a unique-violation as "already exists" and skip
      // gracefully instead of throwing (which would abort the rest of this
      // collector's items for this run).
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        return;
      }
      throw new Error(`insert ${dedupKey(it)}: ${error.message}`);
    }
    const clippingId = data!.id as string;
    for (const f of it.files) {
      const uploaded = await uploadAttachment(
        {
          fetchBytes: async (url) => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
            const len = res.headers.get("content-length");
            if (len && Number(len) > MAX_ATTACHMENT_BYTES) {
              throw new Error(`fetch ${url}: content-length ${len} exceeds cap`);
            }
            const buf = new Uint8Array(await res.arrayBuffer());
            if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
              throw new Error(`fetch ${url}: body ${buf.byteLength} exceeds cap`);
            }
            return buf;
          },
          upload: async (path, bytes) => {
            const { error: upErr } = await supabase.storage.from("clipping-files").upload(path, bytes, { upsert: true });
            if (upErr) throw upErr;
          },
        },
        it.board, it.sourceRef, f
      );
      // Fix 3: check the clipping_files insert error; log and continue.
      const { error: fileErr } = await supabase.from("clipping_files").insert({
        clipping_id: clippingId,
        name: f.name,
        size: uploaded?.size ?? "",
        storage_path: uploaded?.storagePath ?? "",
        external_url: f.externalUrl,
      });
      if (fileErr) {
        errors.push(`clipping_files insert [${it.board}::${it.sourceRef}] ${f.name}: ${fileErr.message}`);
      }
    }
  }

  const { newItems, errors: collectErrors } = await runCollectors({
    collectors: COLLECTORS,
    isExisting: async (key) => {
      const [board, ...rest] = key.split("::");
      const source_ref = rest.join("::");
      const { count } = await supabase.from("clippings").select("id", { count: "exact", head: true }).eq("board", board).eq("source_ref", source_ref);
      return (count ?? 0) > 0;
    },
    insertItem,
  });
  errors.push(...collectErrors);

  // Fix 1: notify from the backlog of un-notified rows in the DB (not just
  // this run's newItems), so a transient email failure never permanently
  // drops items — they simply stay notified_at IS NULL and retry next run.
  let notifiedCount = 0;
  const { data: backlog, error: backlogErr } = await supabase
    .from("clippings")
    .select("id, board, source, title, source_url, collected_at")
    .is("notified_at", null)
    .order("collected_at", { ascending: true })
    .limit(200);

  if (backlogErr) {
    errors.push(`backlog query: ${backlogErr.message}`);
  } else if (backlog && backlog.length > 0) {
    const backlogItems = (backlog as BacklogRow[]).map(backlogRowToItem);
    const { data: recips } = await supabase.from("alert_recipients").select("email").eq("active", true);
    const emails = (recips ?? []).map((r: { email: string }) => r.email);
    try {
      await sendDigest(emails, buildDigest(backlogItems));
      const ids = (backlog as BacklogRow[]).map((r) => r.id);
      const { error: markErr } = await supabase
        .from("clippings")
        .update({ notified_at: new Date().toISOString() })
        .in("id", ids);
      if (markErr) {
        errors.push(`notified_at update: ${markErr.message}`);
      } else {
        notifiedCount = ids.length;
      }
    } catch (e) {
      // Fix 1: do NOT set notified_at on send failure — next run retries.
      errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Fix 2: surface failures via HTTP status so the cron workflow's
  // `test "$code" = "200"` assertion fails when anything went wrong.
  return NextResponse.json(
    { new: newItems.length, notified: notifiedCount, errors },
    { status: errors.length > 0 ? 500 : 200 }
  );
}
