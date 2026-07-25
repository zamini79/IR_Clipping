"use client";
import type { BoardRow } from "@/lib/board-view";

const GRID_BASE = "52px 120px 1fr 130px 96px 68px";
const GRID_KW = "52px 120px 132px 1fr 130px 96px 68px";
const th = { padding: "11px 0", font: "600 10.5px/1 'Pretendard'", letterSpacing: ".06em", color: "#8a8f99", textAlign: "center" } as const;

export function BoardTable({ rows, onOpen, showKeyword = false }: { rows: BoardRow[]; onOpen: (id: string) => void; showKeyword?: boolean }) {
  const GRID = showKeyword ? GRID_KW : GRID_BASE;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", borderTop: "1px solid #1a2338", borderBottom: "1px solid #e6e2d7" }}>
        <span style={th}>No</span>
        <span style={th}>출처</span>
        {showKeyword && <span style={th}>키워드</span>}
        <span style={th}>제목</span>
        <span style={th}>담당부서</span>
        <span style={th}>등록일</span>
        <span style={th}>첨부</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} onClick={() => onOpen(r.id)}
          style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", alignItems: "center", borderBottom: "1px solid #efece3", cursor: "pointer", background: "#fbfaf6", transition: "background .15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f1e8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fbfaf6")}>
          <div style={{ font: "500 12px 'IBM Plex Mono'", color: "#b3b7c0", textAlign: "center" }}>{r.no}</div>
          <div style={{ font: "500 12px 'Pretendard'", color: "#9a7b46", textAlign: "center", padding: "0 8px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source}</div>
          {showKeyword && (
            <div style={{ padding: "0 8px", minWidth: 0, textAlign: "center" }}>
              {r.keyword
                ? <span style={{ display: "inline-block", maxWidth: "100%", padding: "3px 8px", borderRadius: 4, background: "#f0ece0", font: "600 10.5px/1.3 'Pretendard'", color: "#8a6d3a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.keyword}>{r.keyword}</span>
                : <span style={{ font: "500 11px 'Pretendard'", color: "#cfd2d8" }}>—</span>}
            </div>
          )}
          <div style={{ padding: "16px 0", minWidth: 0 }}>
            <div style={{ font: "500 14.5px/1.35 'Pretendard'", color: "#20242c", letterSpacing: "-.01em" }}>
              {r.title}
              {r.isNew && <span style={{ display: "inline-block", marginLeft: 7, font: "700 9px/1 'IBM Plex Mono'", color: "#b23b3b", verticalAlign: "middle" }}>NEW</span>}
            </div>
          </div>
          <div style={{ font: "500 12px 'Pretendard'", color: "#4a5160", textAlign: "center", padding: "0 8px" }}>{r.department}</div>
          <div style={{ font: "500 12.5px 'IBM Plex Mono'", color: "#6a7180" }}>{r.date}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, font: "600 12px 'IBM Plex Mono'", color: r.hasAttachment ? "#8a8f99" : "#cfd2d8" }}>{r.attachmentLabel}</div>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ padding: 56, textAlign: "center", font: "500 13px 'Pretendard'", color: "#a0a4ad" }}>검색 결과가 없습니다.</div>
      )}
    </>
  );
}
