"use client";
import type { BoardRow } from "@/lib/board-view";

const GRID = "52px 120px 1fr 130px 96px 68px";
const th = { padding: "11px 0", font: "600 10.5px/1 'Pretendard'", letterSpacing: ".06em", color: "#8a8f99" } as const;

export function BoardTable({ rows, onOpen }: { rows: BoardRow[]; onOpen: (id: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", borderTop: "1px solid #1a2338", borderBottom: "1px solid #e6e2d7" }}>
        <span style={th}>No</span>
        <span style={th}>출처</span>
        <span style={th}>제목</span>
        <span style={th}>담당부서</span>
        <span style={th}>등록일</span>
        <span style={{ ...th, textAlign: "right" }}>첨부</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} onClick={() => onOpen(r.id)}
          style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", alignItems: "center", borderBottom: "1px solid #efece3", cursor: "pointer", background: "#fbfaf6", transition: "background .15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f1e8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fbfaf6")}>
          <div style={{ font: "500 12px 'IBM Plex Mono'", color: "#b3b7c0" }}>{r.no}</div>
          <div style={{ font: "500 12px 'Pretendard'", color: "#9a7b46", paddingRight: 10, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source}</div>
          <div style={{ padding: "16px 0", minWidth: 0 }}>
            <div style={{ font: "500 14.5px/1.35 'Pretendard'", color: "#20242c", letterSpacing: "-.01em" }}>
              {r.title}
              {r.isNew && <span style={{ display: "inline-block", marginLeft: 7, font: "700 9px/1 'IBM Plex Mono'", color: "#b23b3b", verticalAlign: "middle" }}>NEW</span>}
            </div>
          </div>
          <div style={{ font: "500 12px 'Pretendard'", color: "#4a5160" }}>{r.department}</div>
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
