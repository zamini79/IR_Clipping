export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function padNo(n: number): string {
  return String(n).padStart(2, "0");
}

export function attachmentLabel(count: number): string {
  return count > 0 ? `📎 ${count}` : "—";
}
