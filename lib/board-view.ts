import type { Clipping } from "./types";
import { formatDate, padNo, attachmentLabel } from "./format";
import { boardLabel } from "./sources";

export const PER_PAGE = 10;

export interface BoardRow {
  id: string;
  no: string;
  keyword: string;
  title: string;
  source: string; // 기관(대분류)
  boardLabel: string; // 게시판(하위 분류)
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

/** The KST calendar day an instant falls on, e.g. "2026-07-26". */
function kstDay(value: string | number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function buildBoardView(
  items: Clipping[],
  opts: { query: string; page: number; now?: number }
): BoardView {
  const q = opts.query.trim().toLowerCase();
  const total = items.length;
  // NEW marks what today's collection brought in, so it reflects ingest time
  // (createdAt), not the source's publication date — a post published days ago
  // still counts as new to us on the day we first pick it up.
  const today = kstDay(opts.now ?? Date.now());

  // Precompute No and NEW against the FULL list (index 0 = newest).
  const decorated = items.map((it, index) => ({
    it,
    no: padNo(total - index),
    isNew: Boolean(it.createdAt) && kstDay(it.createdAt) === today,
  }));

  const filtered = decorated.filter(({ it }) => {
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) ||
      it.department.toLowerCase().includes(q) ||
      (it.source ?? "").toLowerCase().includes(q) ||
      boardLabel(it.board).toLowerCase().includes(q) ||
      (it.keyword ?? "").toLowerCase().includes(q)
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
    keyword: it.keyword ?? "",
    title: it.title,
    source: it.source,
    boardLabel: boardLabel(it.board),
    department: it.department,
    date: formatDate(it.collectedAt),
    attachmentLabel: attachmentLabel(it.files.length),
    hasAttachment: it.files.length > 0,
    isNew,
  }));

  return { rows, total: matchTotal, pageCount, page };
}
