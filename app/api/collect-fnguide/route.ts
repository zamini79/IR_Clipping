import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { itemToRow } from "@/lib/collectors/normalize";
import { storagePathFor, humanSize } from "@/lib/collectors/attachments";
import {
  fnguideLogin, searchAllKeywords, fetchDocumentData, FN_PDF_DOWNLOAD, FN_UA, fnguideReferer,
} from "@/lib/collectors/fnguide";
import type { CollectedItem } from "@/lib/collectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

// FnGuide (keyword-based, category=fnguide) on its own daily schedule, separate
// from the hourly pipeline (FnGuide login force-disconnects the user's single
// session; searches + PDF downloads are heavy). Only NEW reports incur the
// expensive per-report documentData + PDF download — existing ones are skipped
// before any viewer/PDF fetch, keeping the run within the function timeout.
// New items are emailed by the hourly run's un-notified backlog digest.
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

  // Same reasoning as /api/collect: cron services time out long before a run
  // with PDF downloads finishes, so acknowledge now and work in the background.
  // `?wait=1` runs it synchronously and returns the result.
  if (new URL(req.url).searchParams.get("wait") === "1") {
    const { status, body } = await runFnguide(supabase);
    return NextResponse.json(body, { status });
  }
  after(async () => {
    const { status, body } = await runFnguide(supabase);
    console[status === 200 ? "log" : "error"]("[collect-fnguide]", JSON.stringify(body));
  });
  return NextResponse.json({ started: true }, { status: 202 });
}

async function runFnguide(supabase: ReturnType<typeof createServiceClient>) {
  const errors: string[] = [];
  let cookie: string | null;
  try {
    cookie = await fnguideLogin();
  } catch (e) {
    return { status: 500, body: { error: `login: ${e instanceof Error ? e.message : String(e)}` } };
  }
  if (!cookie) return { status: 500, body: { error: "FnGuide credentials not configured" } };

  let reports;
  try {
    reports = await searchAllKeywords(cookie);
  } catch (e) {
    return { status: 500, body: { error: `search: ${e instanceof Error ? e.message : String(e)}` } };
  }

  let inserted = 0;
  for (const rep of reports) {
    const { count } = await supabase
      .from("clippings")
      .select("id", { count: "exact", head: true })
      .eq("board", "fnguide")
      .eq("source_ref", rep.rptId);
    if ((count ?? 0) > 0) continue; // already have it — skip the expensive PDF work

    const item: CollectedItem = {
      board: "fnguide", category: "fnguide", keyword: rep.keyword, source: rep.brokerage || "FnGuide",
      sourceRef: rep.rptId, title: rep.title, department: rep.analysts,
      collectedAt: rep.anlDt, sourceUrl: fnguideReferer(rep.rptId), body: "", files: [],
    };
    try {
      const { data, error } = await supabase.from("clippings").insert(itemToRow(item)).select("id").single();
      if (error) {
        if (error.code === "23505" || /duplicate key/i.test(error.message)) continue;
        throw new Error(error.message);
      }
      inserted++;
      // Download the PDF (new report only).
      try {
        const documentData = await fetchDocumentData(cookie, rep.rptId);
        if (documentData) {
          const fd = new FormData();
          fd.append("documentData", documentData);
          const res = await fetch(FN_PDF_DOWNLOAD, {
            method: "POST",
            headers: { "User-Agent": FN_UA, Cookie: cookie, Referer: fnguideReferer(rep.rptId) },
            body: fd,
          });
          if (!res.ok) throw new Error(`pdf HTTP ${res.status}`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error(`pdf ${bytes.byteLength} exceeds cap`);
          const path = storagePathFor("fnguide", rep.rptId, `0-${rep.title}.pdf`);
          const { error: upErr } = await supabase.storage.from("clipping-files").upload(path, bytes, { upsert: true, contentType: "application/pdf" });
          if (upErr) throw upErr;
          await supabase.from("clipping_files").insert({
            clipping_id: data!.id, name: `${rep.title}.pdf`,
            size: humanSize(bytes.byteLength), storage_path: path, external_url: fnguideReferer(rep.rptId),
          });
        }
      } catch (e) {
        errors.push(`pdf ${rep.rptId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      errors.push(`insert ${rep.rptId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Display metadata for the board header (see /api/collect); optional table.
  const { error: runErr } = await supabase.from("collect_runs").insert({
    source: "collect-fnguide",
    new_count: inserted,
    error_count: errors.length,
  });
  if (runErr) console.error("[collect-fnguide] collect_runs insert:", runErr.message);

  return {
    status: errors.length > 0 ? 500 : 200,
    body: { new: inserted, checked: reports.length, errors },
  };
}
