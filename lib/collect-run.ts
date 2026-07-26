import type { Collector, CollectedItem } from "./collectors/types";
import { dedupKey } from "./collectors/normalize";

/** The stored shape of an already-collected post, enough to judge completeness. */
export interface ExistingRow {
  id: string;
  body: string;
  files: { id: string; external_url: string; storage_path: string }[];
}

export interface RunDeps {
  collectors: Collector[];
  findExisting: (key: string) => Promise<ExistingRow | null>;
  insertItem: (item: CollectedItem) => Promise<void>;
  /**
   * Tops up a row that an earlier run stored incompletely — typically because a
   * source's detail page failed to load, leaving it with no body or no
   * attachments. Collectors re-enrich everything inside the collect window on
   * every run, so the complete version is already in hand; without this the
   * dedup check would skip it and the row would stay broken forever.
   * Returns true when it changed something.
   */
  repairExisting?: (existing: ExistingRow, item: CollectedItem) => Promise<boolean>;
  // Only ingest items whose collectedAt (ISO) is >= this cutoff (ISO). Bounds the
  // first-run volume (and thus attachment downloads) to recent posts so the run
  // fits within the serverless function timeout. Omit to ingest everything.
  minCollectedAt?: string;
}

export async function runCollectors(
  deps: RunDeps
): Promise<{ newItems: CollectedItem[]; repaired: number; errors: string[] }> {
  const newItems: CollectedItem[] = [];
  const errors: string[] = [];
  let repaired = 0;
  for (const c of deps.collectors) {
    try {
      const items = await c.collect();
      for (const it of items) {
        if (deps.minCollectedAt && it.collectedAt < deps.minCollectedAt) continue;
        const existing = await deps.findExisting(dedupKey(it));
        if (existing) {
          if (deps.repairExisting) {
            try {
              if (await deps.repairExisting(existing, it)) repaired++;
            } catch (e) {
              errors.push(`[${c.board}] repair ${it.sourceRef}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          continue;
        }
        await deps.insertItem(it);
        newItems.push(it);
      }
    } catch (e) {
      errors.push(`[${c.board}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { newItems, repaired, errors };
}
