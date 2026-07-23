import type { Collector, CollectedItem } from "./collectors/types";
import { dedupKey } from "./collectors/normalize";

export interface RunDeps {
  collectors: Collector[];
  isExisting: (key: string) => Promise<boolean>;
  insertItem: (item: CollectedItem) => Promise<void>;
  // Only ingest items whose collectedAt (ISO) is >= this cutoff (ISO). Bounds the
  // first-run volume (and thus attachment downloads) to recent posts so the run
  // fits within the serverless function timeout. Omit to ingest everything.
  minCollectedAt?: string;
}

export async function runCollectors(deps: RunDeps): Promise<{ newItems: CollectedItem[]; errors: string[] }> {
  const newItems: CollectedItem[] = [];
  const errors: string[] = [];
  for (const c of deps.collectors) {
    try {
      const items = await c.collect();
      for (const it of items) {
        if (deps.minCollectedAt && it.collectedAt < deps.minCollectedAt) continue;
        const key = dedupKey(it);
        if (await deps.isExisting(key)) continue;
        await deps.insertItem(it);
        newItems.push(it);
      }
    } catch (e) {
      errors.push(`[${c.board}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { newItems, errors };
}
