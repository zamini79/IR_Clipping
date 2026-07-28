import { describe, it, expect } from "vitest";
import { CRAWL_SOURCES, boardLabel, boardFullLabel } from "./sources";
import { fscBodoCollector } from "./collectors/fsc-bodo";
import { fscRegCollector } from "./collectors/fsc-reg";
import { ftcBodoCollector } from "./collectors/ftc-bodo";
import { fssBodoCollector } from "./collectors/fss-bodo";
import { fssGuideCollector } from "./collectors/fss-guide";
import { fssGuide02Collector } from "./collectors/fss-guide02";
import { klcaDocCollector } from "./collectors/klca-doc";
import { klcaNewsCollector } from "./collectors/klca-news";
import { klcaLawCollector } from "./collectors/klca-law";
import { kclicCollector } from "./collectors/kclic";
import { molegCollector } from "./collectors/moleg";
import { fnguideCollector } from "./collectors/fnguide";

const COLLECTORS = [
  fscBodoCollector, fscRegCollector, ftcBodoCollector,
  fssBodoCollector, fssGuideCollector, fssGuide02Collector,
  klcaDocCollector, klcaNewsCollector, klcaLawCollector,
  kclicCollector, molegCollector, fnguideCollector,
];

describe("CRAWL_SOURCES", () => {
  const sources = CRAWL_SOURCES.flatMap((g) => g.sources);

  it("gives every source a unique collector id", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The 게시판 column resolves clippings.board through this registry, so a
  // collector missing from it would silently show a blank 하위 분류.
  it("covers every collector's board id", () => {
    const registered = new Set(sources.map((s) => s.id));
    const missing = COLLECTORS.map((c) => c.board).filter((b) => !registered.has(b));
    expect(missing).toEqual([]);
  });

  it("has no registry entry without a collector", () => {
    const collected = new Set(COLLECTORS.map((c) => c.board));
    expect(sources.map((s) => s.id).filter((id) => !collected.has(id))).toEqual([]);
  });
});

describe("boardLabel", () => {
  it("returns the short name for the table and the full name elsewhere", () => {
    expect(boardLabel("fsc-reg")).toBe("소관규정 · 고시");
    expect(boardFullLabel("fsc-reg")).toBe("소관규정 · 고시 · 공고 · 훈령");
  });

  it("uses the board name as-is when no short form is defined", () => {
    expect(boardLabel("klca-doc")).toBe("공문");
    expect(boardFullLabel("klca-doc")).toBe("공문");
  });

  it("returns empty for an unknown board", () => {
    expect(boardLabel("nope")).toBe("");
    expect(boardFullLabel("nope")).toBe("");
  });
});
