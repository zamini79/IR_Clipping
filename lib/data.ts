import type { Category, Clipping } from "./types";
import { createPublicClient } from "./supabase";

export interface ClippingFileRow {
  id: string;
  name: string;
  size: string;
  storage_path: string;
  external_url: string;
}

export interface ClippingRow {
  id: string;
  category: string;
  board: string;
  title: string;
  source: string;
  source_ref: string;
  source_url: string;
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
    board: row.board,
    title: row.title,
    source: row.source,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    department: row.department,
    body: row.body,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    files: (row.clipping_files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      storagePath: f.storage_path,
      externalUrl: f.external_url,
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
