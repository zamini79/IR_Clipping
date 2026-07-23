import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Board } from "./Board";
import type { Category, Clipping } from "@/lib/types";

function clip(cat: Category, i: number, extra: Partial<Clipping> = {}): Clipping {
  return { id: `${cat}-${i}`, category: cat, title: `${cat} 제목 ${i}`, source: "출처",
    department: "공시제도팀", body: "본문", collectedAt: "2026-07-21T00:00:00.000Z",
    createdAt: "2026-07-21T00:00:00.000Z", files: [], ...extra };
}

const data = {
  disclosure: Array.from({ length: 8 }, (_, i) => clip("disclosure", i)),
  fnguide: [clip("fnguide", 0, { title: "FnGuide 리포트", department: "IR기획팀" })],
} as Record<Category, Clipping[]>;

describe("Board", () => {
  it("shows the active tab count and paginates at 6 per page", () => {
    render(<Board data={data} updated="2026.07.22 09:12" />);
    expect(screen.getByText(/검색결과/)).toHaveTextContent("8건");
    // 6 rows on first page
    expect(screen.getByText("disclosure 제목 0")).toBeInTheDocument();
    expect(screen.queryByText("disclosure 제목 7")).not.toBeInTheDocument();
  });

  it("switching tab resets page and query, and swaps data", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.type(screen.getByPlaceholderText("제목 · 담당부서 검색"), "리포트");
    await userEvent.click(screen.getByText("FnGuide"));
    expect(screen.getByText("FnGuide 리포트")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("제목 · 담당부서 검색")).toHaveValue("");
  });

  it("filters rows by search query", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.type(screen.getByPlaceholderText("제목 · 담당부서 검색"), "제목 3");
    expect(screen.getByText("disclosure 제목 3")).toBeInTheDocument();
    expect(screen.queryByText("disclosure 제목 0")).not.toBeInTheDocument();
  });

  it("opens and closes the detail modal on row click", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.click(screen.getByText("disclosure 제목 0"));
    const dialog = screen.getByText("첨부파일").closest("div")!.parentElement!;
    expect(within(dialog).getByText("첨부파일 없음")).toBeInTheDocument();
  });
});
