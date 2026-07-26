import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { runCollectors, type ExistingRow } from "@/lib/collect-run";
import { itemToRow, dedupKey } from "@/lib/collectors/normalize";
import { uploadAttachment } from "@/lib/collectors/attachments";
import { buildDigest } from "@/lib/notify/digest";
import { sendDigest } from "@/lib/notify/mailer";
import { fscBodoCollector } from "@/lib/collectors/fsc-bodo";
import { fscRegCollector } from "@/lib/collectors/fsc-reg";
import { ftcBodoCollector } from "@/lib/collectors/ftc-bodo";
import { klcaDocCollector } from "@/lib/collectors/klca-doc";
import { klcaLawCollector } from "@/lib/collectors/klca-law";
import { klcaNewsCollector } from "@/lib/collectors/klca-news";
import { fssBodoCollector } from "@/lib/collectors/fss-bodo";
import { fssGuideCollector } from "@/lib/collectors/fss-guide";
import { fssGuide02Collector } from "@/lib/collectors/fss-guide02";
import { kclicCollector } from "@/lib/collectors/kclic";
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
  klcaNewsCollector,
  fssBodoCollector,
  fssGuideCollector,
  fssGuide02Collector,
  kclicCollector,
];

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50MB

// Only ingest posts from the last N days. Bounds the first run (everything is
// "new") to a small, recent window so attachment downloads finish within the
// function timeout; steady-state runs stay small via dedup. Override with
// COLLECT_SINCE_DAYS.
const SINCE_DAYS = Number(process.env.COLLECT_SINCE_DAYS ?? "7");

// Backlog row shape returned by the un-notified query (Fix 1).
interface BacklogRow {
  id: string;
  source: string;
  keyword: string | null;
  title: string;
  collected_at: string;
}

// Where the digest's per-post links point. Overridable so preview deployments
// can link to themselves.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ir-clipping.vercel.app";

export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Observability: a missing/misconfigured env (e.g. SUPABASE_SERVICE_ROLE_KEY)
  // makes createServiceClient throw. Catch it so the caller gets a clear JSON
  // error + 500 instead of an opaque empty 500 (which only shows in server logs).
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  // A full run takes well over a minute, but cron services cut the connection
  // at ~30s and then retry — which would overlap runs. So acknowledge straight
  // away and finish in the background. `?wait=1` keeps the old synchronous
  // behaviour for manual runs, where the result is the point.
  if (new URL(req.url).searchParams.get("wait") === "1") {
    const { status, body } = await runPipeline(supabase);
    return NextResponse.json(body, { status });
  }
  after(async () => {
    const { status, body } = await runPipeline(supabase);
    console[status === 200 ? "log" : "error"]("[collect]", JSON.stringify(body));
  });
  return NextResponse.json({ started: true }, { status: 202 });
}

async function runPipeline(supabase: ReturnType<typeof createServiceClient>) {
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
    await storeFiles(data!.id as string, it);
  }

  // Downloads every attachment of `it` into Storage and records the rows.
  // Shared by first insert and by repair, so both archive files identically.
  async function storeFiles(clippingId: string, it: CollectedItem) {
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
          upload: async (path, bytes, contentType) => {
            const { error: upErr } = await supabase.storage.from("clipping-files").upload(path, bytes, { upsert: true, contentType });
            if (upErr) throw upErr;
          },
        },
        // Index-prefix the storage-key name so multiple attachments whose
        // Korean/parenthesis filenames sanitize to the same key don't overwrite
        // each other. Display name (below) stays the original f.name.
        it.board, it.sourceRef, { ...f, name: `${fileIdx}-${f.name}` }
      );
      fileIdx++;
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

  // Tops up a row an earlier run stored incompletely. Three terminal defects are
  // repairable, and each stops recurring once fixed: no body, no attachments at
  // all, an attachment that is really the source's "download everything" archive
  // (FTC's downloadBbsFileAll.do, stored as one file named "파일다운로드"), or a
  // file whose bytes never made it into Storage.
  async function repairExisting(existing: ExistingRow, it: CollectedItem): Promise<boolean> {
    let changed = false;

    if (!existing.body.trim() && it.body.trim()) {
      const { error } = await supabase.from("clippings").update({ body: it.body }).eq("id", existing.id);
      if (error) throw new Error(`body: ${error.message}`);
      changed = true;
    }

    const isBulkArchive = existing.files.some((f) => f.external_url.includes("downloadBbsFileAll.do"));
    const notArchived = existing.files.some((f) => !f.storage_path);
    if (it.files.length > 0 && (existing.files.length === 0 || isBulkArchive || notArchived)) {
      const paths = existing.files.map((f) => f.storage_path).filter(Boolean);
      if (paths.length) await supabase.storage.from("clipping-files").remove(paths);
      if (existing.files.length) await supabase.from("clipping_files").delete().eq("clipping_id", existing.id);
      await storeFiles(existing.id, it);
      changed = true;
    }
    return changed;
  }

  const cutoffIso = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { newItems, repaired, errors: collectErrors } = await runCollectors({
    collectors: COLLECTORS,
    minCollectedAt: cutoffIso,
    findExisting: async (key) => {
      const [board, ...rest] = key.split("::");
      const source_ref = rest.join("::");
      const { data } = await supabase
        .from("clippings")
        .select("id, body, clipping_files(id, external_url, storage_path)")
        .eq("board", board)
        .eq("source_ref", source_ref)
        .maybeSingle();
      if (!data) return null;
      return { id: data.id as string, body: (data.body as string) ?? "", files: data.clipping_files ?? [] };
    },
    insertItem,
    repairExisting,
  });
  errors.push(...collectErrors);

  // Fix 1: notify from the backlog of un-notified rows in the DB (not just
  // this run's newItems), so a transient email failure never permanently
  // drops items — they simply stay notified_at IS NULL and retry next run.
  let notifiedCount = 0;
  const { data: backlog, error: backlogErr } = await supabase
    .from("clippings")
    .select("id, source, keyword, title, collected_at")
    .is("notified_at", null)
    .order("collected_at", { ascending: true })
    .limit(200);

  if (backlogErr) {
    errors.push(`backlog query: ${backlogErr.message}`);
  } else if (backlog && backlog.length > 0) {
    const backlogItems = (backlog as BacklogRow[]).map((r) => ({
      id: r.id,
      source: r.source,
      keyword: r.keyword ?? "",
      title: r.title,
      collectedAt: r.collected_at,
    }));
    const { data: recips } = await supabase.from("alert_recipients").select("email").eq("active", true);
    const emails = (recips ?? []).map((r: { email: string }) => r.email);
    try {
      await sendDigest(emails, buildDigest(backlogItems, SITE_URL));
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

  // Record the run so the board's "최근 수집" reflects when we last checked the
  // sources, not just when a new post happened to arrive. Never fails the run:
  // the table is optional (migration 0004) and this is only display metadata.
  const { error: runErr } = await supabase.from("collect_runs").insert({
    source: "collect",
    new_count: newItems.length,
    repaired_count: repaired,
    error_count: errors.length,
  });
  if (runErr) console.error("[collect] collect_runs insert:", runErr.message);

  // Non-200 marks the run as failed for `?wait=1` callers; the background path
  // logs the same payload to the Vercel function log.
  return {
    status: errors.length > 0 ? 500 : 200,
    body: { new: newItems.length, repaired, notified: notifiedCount, errors },
  };
}
