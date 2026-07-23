import type { Category, Clipping } from "./types";
import { createPublicClient } from "./supabase";

export interface ClippingFileRow {
  id: string;
  name: string;
  size: string;
  storage_path: string;
}

export interface ClippingRow {
  id: string;
  category: string;
  title: string;
  source: string;
  department: string;
  body: string;
  collected_at: string;
  created_at: string;
  clipping_files: ClippingFileRow[] | null;
}

export function mapRowToClipping(row: ClippingRow): Clipping {
  return {
    id: row.id,
    category: row.category as Category,
    title: row.title,
    source: row.source,
    department: row.department,
    body: row.body,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    files: (row.clipping_files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      storagePath: f.storage_path,
    })),
  };
}

export async function getBoardData(): Promise<Record<Category, Clipping[]>> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("clippings")
    .select("*, clipping_files(*)")
    .order("collected_at", { ascending: false });

  if (error) throw new Error(`Failed to load clippings: ${error.message}`);

  const all = (data as ClippingRow[]).map(mapRowToClipping);
  return {
    disclosure: all.filter((c) => c.category === "disclosure"),
    fnguide: all.filter((c) => c.category === "fnguide"),
  };
}
