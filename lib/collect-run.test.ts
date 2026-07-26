import { describe, it, expect } from "vitest";
import { runCollectors, type ExistingRow } from "./collect-run";
import type { Collector, CollectedItem } from "./collectors/types";

function item(board: string, ref: string, collectedAt = "2026-07-23T00:00:00.000Z"): CollectedItem {
  return { board, source: "S", sourceRef: ref, title: `t-${ref}`, department: "", collectedAt, sourceUrl: `https://x/${ref}`, body: "", files: [] };
}

const row = (over: Partial<ExistingRow> = {}): ExistingRow => ({ id: "row-1", body: "본문", files: [], ...over });

describe("runCollectors", () => {
  it("inserts only items not already present and returns new ones", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [item("b", "1"), item("b", "2")] },
    ];
    const existing = new Set(["b::1"]);
    const inserted: string[] = [];
    const deps = {
      collectors,
      findExisting: async (key: string) => (existing.has(key) ? row() : null),
      insertItem: async (it: CollectedItem) => { inserted.push(`${it.board}::${it.sourceRef}`); },
    };
    const { newItems, errors } = await runCollectors(deps);
    expect(inserted).toEqual(["b::2"]);
    expect(newItems.map((i) => i.sourceRef)).toEqual(["2"]);
    expect(errors).toEqual([]);
  });

  it("isolates a failing collector and records the error", async () => {
    const collectors: Collector[] = [
      { board: "bad", source: "S", collect: async () => { throw new Error("boom"); } },
      { board: "ok", source: "S", collect: async () => [item("ok", "9")] },
    ];
    const deps = {
      collectors,
      findExisting: async () => null,
      insertItem: async () => {},
    };
    const { newItems, errors } = await runCollectors(deps);
    expect(newItems.map((i) => i.board)).toEqual(["ok"]);
    expect(errors.join()).toContain("bad");
  });

  it("skips items older than minCollectedAt (recent-window cutoff)", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [
        item("b", "new", "2026-07-22T00:00:00.000Z"),
        item("b", "old", "2026-07-01T00:00:00.000Z"),
      ] },
    ];
    const inserted: string[] = [];
    const deps = {
      collectors,
      findExisting: async () => null,
      insertItem: async (it: CollectedItem) => { inserted.push(it.sourceRef); },
      minCollectedAt: "2026-07-16T00:00:00.000Z",
    };
    const { newItems } = await runCollectors(deps);
    expect(inserted).toEqual(["new"]);
    expect(newItems.map((i) => i.sourceRef)).toEqual(["new"]);
  });

  it("hands already-stored items to repairExisting instead of dropping them", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [item("b", "1"), item("b", "2")] },
    ];
    const seen: string[] = [];
    const { newItems, repaired } = await runCollectors({
      collectors,
      findExisting: async () => row({ body: "" }),
      insertItem: async () => { throw new Error("should not insert"); },
      repairExisting: async (_existing, it) => { seen.push(it.sourceRef); return it.sourceRef === "1"; },
    });
    expect(seen).toEqual(["1", "2"]); // every existing item is offered for repair
    expect(repaired).toBe(1); // only the one that reported a change is counted
    expect(newItems).toEqual([]);
  });

  it("records a repair failure without aborting the run", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [item("b", "1"), item("b", "2")] },
    ];
    const { repaired, errors } = await runCollectors({
      collectors,
      findExisting: async () => row(),
      insertItem: async () => {},
      repairExisting: async (_e, it) => {
        if (it.sourceRef === "1") throw new Error("db down");
        return true;
      },
    });
    expect(errors.join()).toContain("db down");
    expect(repaired).toBe(1); // item 2 still processed
  });
});
