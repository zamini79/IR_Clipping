"use client";
import { useEffect } from "react";
import type { Clipping } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function DetailModal({ clipping, activeLabel, onClose }: { clipping: Clipping; activeLabel: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,45,.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: "100%", background: "#fbfaf6", borderRadius: 12, boxShadow: "0 30px 70px -20px rgba(20,26,45,.5)", overflow: "hidden" }}>
        <div style={{ padding: "26px 32px", borderBottom: "1px solid #e6e2d7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 11px 'Pretendard'", color: "#9a7b46" }}>
            {clipping.source}<span style={{ color: "#cfc9bd" }}>·</span>
            <span style={{ color: "#8a8f99", fontWeight: 500 }}>{activeLabel}</span>
          </div>
          <div style={{ marginTop: 9, font: "600 20px/1.4 'Noto Serif KR',serif", color: "#1a2338", letterSpacing: "-.01em", textWrap: "pretty" }}>{clipping.title}</div>
          <div style={{ marginTop: 14, display: "flex", gap: 20, font: "500 12px 'Pretendard'", color: "#6a7180" }}>
            <span>담당부서 <b style={{ color: "#3a4150", marginLeft: 4 }}>{clipping.department}</b></span>
            <span>등록일 <b style={{ color: "#3a4150", marginLeft: 4, fontFamily: "'IBM Plex Mono'" }}>{formatDate(clipping.collectedAt)}</b></span>
          </div>
        </div>
        <div style={{ padding: "26px 32px", font: "400 13.5px/1.8 'Pretendard'", color: "#3a4150" }}>{clipping.body}</div>
        <div style={{ padding: "0 32px 28px" }}>
          <div style={{ font: "600 10.5px 'Pretendard'", letterSpacing: ".06em", color: "#8a8f99", marginBottom: 10 }}>첨부파일</div>
          {clipping.files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "#fff", border: "1px solid #e6e2d7", borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 15 }}>📎</span>
              <span style={{ font: "500 13px 'Pretendard'", color: "#20242c", flex: 1 }}>{f.name}</span>
              <span style={{ font: "500 11px 'IBM Plex Mono'", color: "#9aa0ab" }}>{f.size}</span>
              {f.storagePath ? (
                <a href={`/api/download?path=${encodeURIComponent(f.storagePath)}`}
                  style={{ font: "600 11.5px 'Pretendard'", color: "#9a7b46", textDecoration: "none" }}>다운로드</a>
              ) : f.externalUrl ? (
                <a href={f.externalUrl} target="_blank" rel="noopener noreferrer"
                  style={{ font: "600 11.5px 'Pretendard'", color: "#9a7b46", textDecoration: "none" }}>다운로드</a>
              ) : (
                <span style={{ font: "600 11.5px 'Pretendard'", color: "#9a7b46" }}>다운로드</span>
              )}
            </div>
          ))}
          {clipping.files.length === 0 && (
            <div style={{ font: "500 12.5px 'Pretendard'", color: "#a0a4ad" }}>첨부파일 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}
