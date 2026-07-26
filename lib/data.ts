import type { Category, Clipping } from "./types";
import { createPublicClient } from "./supabase";
import { htmlToText } from "./format";

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
  keyword: string | null;
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
    keyword: row.keyword ?? "",
    title: row.title,
    source: row.source,
    sourceRef: row.source_ref,
    sourceUrl: row.source_url,
    department: row.department,
    body: htmlToText(row.body),
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

/**
 * When collection last ran (ISO), for the header's "최근 수집".
 *
 * Reads collect_runs rather than the newest clipping: the board should show
 * that we checked the sources an hour ago even when nothing new turned up.
 * Returns null before migration 0004 is applied, or if no run is recorded yet —
 * the caller falls back to the newest post.
 */
export async function getLastRunAt(): Promise<string | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collect_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data.ran_at as string) ?? null;
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
