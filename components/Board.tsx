"use client";
import { useMemo, useState } from "react";
import type { Category, Clipping } from "@/lib/types";
import { buildBoardView } from "@/lib/board-view";
import { BoardTable } from "./BoardTable";
import { SearchBar } from "./SearchBar";
import { Pagination } from "./Pagination";
import { DetailModal } from "./DetailModal";

const TABS: { key: Category; label: string }[] = [
  { key: "disclosure", label: "공시법규 규정" },
  { key: "fnguide", label: "FnGuide" },
];

export function Board({ data, updated }: { data: Record<Category, Clipping[]>; updated: string }) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeKey = TABS[tab].key;
  const items = data[activeKey];
  const view = useMemo(() => buildBoardView(items, { query, page }), [items, query, page]);
  const detail = detailId ? items.find((c) => c.id === detailId) ?? null : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "40px 20px", background: "#eceae3" }}>
      <div style={{ width: 1040, maxWidth: "100%", background: "#fbfaf6", borderRadius: 12, boxShadow: "0 24px 60px -24px rgba(20,26,45,.35),0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "28px 36px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ font: "600 10px/1 'IBM Plex Mono',monospace", letterSpacing: ".28em", color: "#9a7b46" }}>IR CLIPPING</div>
            <div style={{ font: "600 24px/1 'Noto Serif KR',serif", color: "#1a2338", letterSpacing: "-.01em" }}>공시 · 규제 클리핑</div>
          </div>
          <div style={{ font: "500 11.5px/1.5 'Pretendard'", color: "#8a8f99", textAlign: "right" }}>
            최근 수집<b style={{ display: "block", color: "#3a4150", fontWeight: 600 }}>{updated}</b>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 2, padding: "22px 36px 0", borderBottom: "1px solid #e6e2d7" }}>
          {TABS.map((t, i) => (
            <div key={t.key} onClick={() => { setTab(i); setPage(0); setQuery(""); setDetailId(null); }}
              style={{ padding: "12px 20px 14px", font: "600 14px/1 'Pretendard'", cursor: "pointer", borderBottom: `2px solid ${i === tab ? "#9a7b46" : "transparent"}`, color: i === tab ? "#1a2338" : "#a0a4ad" }}>
              {t.label}
              <span style={{ font: "600 10px 'IBM Plex Mono'", color: i === tab ? "#c2a86e" : "#cbcdd3", marginLeft: 7, verticalAlign: "super" }}>{data[t.key].length}</span>
            </div>
          ))}
        </div>

        {/* bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px 14px" }}>
          <div style={{ font: "500 12px 'Pretendard'", color: "#8a8f99" }}>
            검색결과 <b style={{ color: "#1a2338", fontWeight: 600 }}>{view.total}건</b> · <b style={{ color: "#1a2338", fontWeight: 600 }}>{TABS[tab].label}</b>
          </div>
          <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(0); }} />
        </div>

        {/* table */}
        <BoardTable rows={view.rows} onOpen={(id) => setDetailId(id)} />

        {/* pagination */}
        <Pagination page={view.page} pageCount={view.pageCount} onGo={(p) => setPage(p)} />
      </div>

      {detail && <DetailModal clipping={detail} activeLabel={TABS[tab].label} onClose={() => setDetailId(null)} />}
    </div>
  );
}
