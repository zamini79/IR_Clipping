"use client";

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e6e2d7", borderRadius: 7, padding: "0 12px", width: 240 }}>
      <span style={{ color: "#b3b7c0", fontSize: 13 }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="제목 · 담당부서 검색"
        style={{ border: 0, outline: 0, background: "transparent", padding: "9px 0", width: "100%", font: "400 12.5px 'Pretendard'", color: "#20242c" }}
      />
    </div>
  );
}
