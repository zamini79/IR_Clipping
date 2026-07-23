"use client";

function pgStyle(on: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 6,
    cursor: "pointer", font: "600 12px 'IBM Plex Mono'",
    ...(on ? { background: "#1a2338", color: "#fff" } : { color: "#8a8f99" }),
  };
}

export function Pagination({ page, pageCount, onGo }: { page: number; pageCount: number; onGo: (p: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 24 }}>
      <div style={pgStyle(false)} onClick={() => onGo(Math.max(0, page - 1))}>‹</div>
      {Array.from({ length: pageCount }, (_, i) => (
        <div key={i} style={pgStyle(i === page)} onClick={() => onGo(i)}>{i + 1}</div>
      ))}
      <div style={pgStyle(false)} onClick={() => onGo(Math.min(pageCount - 1, page + 1))}>›</div>
    </div>
  );
}
