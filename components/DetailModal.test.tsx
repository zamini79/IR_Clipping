import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailModal } from "./DetailModal";
import type { Clipping } from "@/lib/types";

function clip(board: string, files: Clipping["files"] = []): Clipping {
  return {
    id: "1", category: "disclosure", board, keyword: "", title: "제목",
    source: "상장회사협의회", sourceRef: "834", sourceUrl: "https://www.klca.or.kr/x",
    department: "기업법제팀", body: "", collectedAt: "2026-07-23T00:00:00.000Z",
    createdAt: "2026-07-23T00:00:00.000Z", files,
  };
}

describe("DetailModal 원문 링크", () => {
  it("marks login-gated boards (KLCA/KCLIC) with (로그인 필요)", () => {
    render(<DetailModal clipping={clip("klca-law")} activeLabel="공시법규 규정" onClose={() => {}} />);
    expect(screen.getByText("원문 보기")).toBeInTheDocument();
    expect(screen.getByText("(로그인 필요)")).toBeInTheDocument();
  });
  it("does not mark public boards", () => {
    render(<DetailModal clipping={clip("fsc-bodo")} activeLabel="공시법규 규정" onClose={() => {}} />);
    expect(screen.getByText("원문 보기")).toBeInTheDocument();
    expect(screen.queryByText("(로그인 필요)")).not.toBeInTheDocument();
  });
});

describe("DetailModal 첨부파일", () => {
  const archived = [{ id: "f1", name: "붙임1 안내.pdf", size: "1.2MB", storagePath: "fsc-bodo/1/0-a.pdf", externalUrl: "https://src/a.pdf" }];

  it("offers 열기 (inline, new tab) and 다운로드 (attachment) for archived files", () => {
    render(<DetailModal clipping={clip("fsc-bodo", archived)} activeLabel="공시법규 규정" onClose={() => {}} />);
    const open = screen.getByText("열기").closest("a")!;
    const dl = screen.getByText("다운로드").closest("a")!;
    const path = encodeURIComponent("fsc-bodo/1/0-a.pdf");
    expect(open).toHaveAttribute("href", `/api/download?path=${path}`);
    expect(open).toHaveAttribute("target", "_blank");
    expect(dl).toHaveAttribute("href", `/api/download?path=${path}&dl=1`);
    // The download must stay in the current tab so the board isn't navigated away.
    expect(dl).not.toHaveAttribute("target");
  });

  it("falls back to the source URL when the file was not archived", () => {
    const external = [{ id: "f2", name: "b.pdf", size: "", storagePath: "", externalUrl: "https://src/b.pdf" }];
    render(<DetailModal clipping={clip("fsc-bodo", external)} activeLabel="공시법규 규정" onClose={() => {}} />);
    expect(screen.queryByText("열기")).not.toBeInTheDocument();
    expect(screen.getByText("다운로드").closest("a")).toHaveAttribute("href", "https://src/b.pdf");
  });
});
