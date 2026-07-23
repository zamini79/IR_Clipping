import type { Clipping } from "./types";
import { formatDate, padNo, attachmentLabel } from "./format";

export const PER_PAGE = 6;

export interface BoardRow {
  id: string;
  no: string;
  title: string;
  source: string;
  department: string;
  date: string;
  attachmentLabel: string;
  hasAttachment: boolean;
  isNew: boolean;
}

export interface BoardView {
  rows: BoardRow[];
  total: number;
  pageCount: number;
  page: number;
}

export function buildBoardView(
  items: Clipping[],
  opts: { query: string; page: number }
): BoardView {
  const q = opts.query.trim().toLowerCase();
  const total = items.length;

  // Precompute No and NEW against the FULL list (index 0 = newest).
  const decorated = items.map((it, index) => ({
    it,
    no: padNo(total - index),
    isNew: index < 2,
  }));

  const filtered = decorated.filter(({ it }) => {
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) ||
      it.department.toLowerCase().includes(q) ||
      (it.source ?? "").toLowerCase().includes(q)
    );
  });

  const matchTotal = filtered.length;
  const pageCount = Math.max(1, Math.ceil(matchTotal / PER_PAGE));
  const page = Math.min(Math.max(0, opts.page), pageCount - 1);
  const start = page * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  const rows: BoardRow[] = slice.map(({ it, no, isNew }) => ({
    id: it.id,
    no,
    title: it.title,
    source: it.source,
    department: it.department,
    date: formatDate(it.collectedAt),
    attachmentLabel: attachmentLabel(it.files.length),
    hasAttachment: it.files.length > 0,
    isNew,
  }));

  return { rows, total: matchTotal, pageCount, page };
}
