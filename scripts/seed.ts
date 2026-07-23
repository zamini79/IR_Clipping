import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { SEED_CLIPPINGS } from "../lib/seed-data";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Idempotent: clear then insert
  await supabase.from("clipping_files").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("clippings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const c of SEED_CLIPPINGS) {
    const { data, error } = await supabase
      .from("clippings")
      .insert({
        category: c.category,
        title: c.title,
        source: c.source,
        department: c.department,
        body: c.body,
        collected_at: c.collectedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert clipping failed: ${error.message}`);

    if (c.files.length > 0) {
      const files = c.files.map((f) => ({
        clipping_id: data!.id,
        name: f.name,
        size: f.size,
        storage_path: "",
      }));
      const { error: fErr } = await supabase.from("clipping_files").insert(files);
      if (fErr) throw new Error(`insert files failed: ${fErr.message}`);
    }
  }
  console.log(`Seeded ${SEED_CLIPPINGS.length} clippings.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
