import { describe, it, expect } from "vitest";
import { runCollectors } from "./collect-run";
import type { Collector, CollectedItem } from "./collectors/types";

function item(board: string, ref: string, collectedAt = "2026-07-23T00:00:00.000Z"): CollectedItem {
  return { board, source: "S", sourceRef: ref, title: `t-${ref}`, department: "", collectedAt, sourceUrl: `https://x/${ref}`, body: "", files: [] };
}

describe("runCollectors", () => {
  it("inserts only items not already present and returns new ones", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [item("b", "1"), item("b", "2")] },
    ];
    const existing = new Set(["b::1"]);
    const inserted: string[] = [];
    const deps = {
      collectors,
      isExisting: async (key: string) => existing.has(key),
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
      isExisting: async () => false,
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
      isExisting: async () => false,
      insertItem: async (it: CollectedItem) => { inserted.push(it.sourceRef); },
      minCollectedAt: "2026-07-16T00:00:00.000Z",
    };
    const { newItems } = await runCollectors(deps);
    expect(inserted).toEqual(["new"]);
    expect(newItems.map((i) => i.sourceRef)).toEqual(["new"]);
  });
});
