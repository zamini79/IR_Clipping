"use client";
import { useEffect } from "react";
import { CRAWL_SOURCES } from "@/lib/sources";

export function SourcesModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = CRAWL_SOURCES.reduce((n, g) => n + g.sources.length, 0);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,45,.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: "100%", maxHeight: "70vh", display: "flex", flexDirection: "column", background: "#fbfaf6", borderRadius: 12, boxShadow: "0 30px 70px -20px rgba(20,26,45,.5)", overflow: "hidden" }}>
        <div style={{ padding: "24px 32px", borderBottom: "1px solid #e6e2d7", flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ font: "600 10px/1 'IBM Plex Mono',monospace", letterSpacing: ".22em", color: "#9a7b46" }}>COLLECTION SOURCES</div>
            <div style={{ marginTop: 8, font: "600 19px/1 'Noto Serif KR',serif", color: "#1a2338", letterSpacing: "-.01em" }}>수집 사이트 리스트</div>
          </div>
          <div style={{ font: "500 11.5px 'Pretendard'", color: "#8a8f99" }}>총 <b style={{ color: "#3a4150", fontWeight: 600 }}>{total}</b>개 게시판</div>
        </div>

        <div style={{ overflowY: "auto", flexGrow: 1, minHeight: 0, padding: "20px 32px 28px" }}>
          {CRAWL_SOURCES.map((group) => (
            <div key={group.category} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ font: "600 12.5px 'Pretendard'", color: "#1a2338" }}>{group.label}</span>
                <span style={{ font: "600 10px 'IBM Plex Mono'", color: "#c2a86e" }}>{group.sources.length}</span>
              </div>
              {group.sources.map((s, i) => (
                <a key={`${group.category}-${i}`} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#fff", border: "1px solid #e6e2d7", borderRadius: 8, marginBottom: 8, textDecoration: "none", transition: "background .15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f1e8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ font: "600 13px 'Pretendard'", color: "#20242c" }}>
                      {s.org}
                      <span style={{ color: "#cfc9bd", margin: "0 6px" }}>·</span>
                      <span style={{ fontWeight: 500, color: "#4a5160" }}>{s.board}</span>
                    </div>
                    <div style={{ marginTop: 4, font: "500 11px 'IBM Plex Mono'", color: "#9aa0ab", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.url}</div>
                    {s.note && <div style={{ marginTop: 3, font: "500 10.5px 'Pretendard'", color: "#b0928f" }}>{s.note}</div>}
                    {s.keywords && s.keywords.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ font: "600 9.5px 'Pretendard'", letterSpacing: ".05em", color: "#8a8f99", marginBottom: 6 }}>검색 키워드 {s.keywords.length}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {s.keywords.map((kw) => (
                            <span key={kw} style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, background: "#f0ece0", font: "600 10px/1.4 'Pretendard'", color: "#8a6d3a" }}>{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span aria-hidden style={{ font: "600 12px 'Pretendard'", color: "#9a7b46", flexShrink: 0 }}>↗</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
