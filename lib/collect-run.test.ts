import { describe, it, expect } from "vitest";
import { runCollectors } from "./collect-run";
import type { Collector, CollectedItem } from "./collectors/types";

function item(board: string, ref: string): CollectedItem {
  return { board, source: "S", sourceRef: ref, title: `t-${ref}`, department: "", collectedAt: "2026-07-23T00:00:00.000Z", sourceUrl: `https://x/${ref}`, body: "", files: [] };
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
});
