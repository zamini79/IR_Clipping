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
import type { CollectedItem } from "@/lib/collectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COLLECTORS = [fscBodoCollector, fscRegCollector, ftcBodoCollector, klcaDocCollector, klcaLawCollector]; // Task 8에서 추가

export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();

  async function insertItem(it: CollectedItem) {
    const { data, error } = await supabase.from("clippings").insert(itemToRow(it)).select("id").single();
    if (error) throw new Error(`insert ${dedupKey(it)}: ${error.message}`);
    const clippingId = data!.id as string;
    for (const f of it.files) {
      const uploaded = await uploadAttachment(
        {
          fetchBytes: async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()),
          upload: async (path, bytes) => {
            const { error: upErr } = await supabase.storage.from("clipping-files").upload(path, bytes, { upsert: true });
            if (upErr) throw upErr;
          },
        },
        it.board, it.sourceRef, f
      );
      await supabase.from("clipping_files").insert({
        clipping_id: clippingId,
        name: f.name,
        size: uploaded?.size ?? "",
        storage_path: uploaded?.storagePath ?? "",
        external_url: f.externalUrl,
      });
    }
  }

  const { newItems, errors } = await runCollectors({
    collectors: COLLECTORS,
    isExisting: async (key) => {
      const [board, ...rest] = key.split("::");
      const source_ref = rest.join("::");
      const { count } = await supabase.from("clippings").select("id", { count: "exact", head: true }).eq("board", board).eq("source_ref", source_ref);
      return (count ?? 0) > 0;
    },
    insertItem,
  });

  if (newItems.length > 0) {
    const { data: recips } = await supabase.from("alert_recipients").select("email").eq("active", true);
    const emails = (recips ?? []).map((r: { email: string }) => r.email);
    try {
      await sendDigest(emails, buildDigest(newItems));
      const ids = newItems.map((i) => dedupKey(i));
      // notified_at 갱신
      for (const it of newItems) {
        await supabase.from("clippings").update({ notified_at: new Date().toISOString() }).eq("board", it.board).eq("source_ref", it.sourceRef);
      }
      void ids;
    } catch (e) {
      errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ new: newItems.length, errors });
}
