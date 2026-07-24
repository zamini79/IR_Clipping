import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetailModal } from "./DetailModal";
import type { Clipping } from "@/lib/types";

function clip(board: string): Clipping {
  return {
    id: "1", category: "disclosure", board, keyword: "", title: "제목",
    source: "상장회사협의회", sourceRef: "834", sourceUrl: "https://www.klca.or.kr/x",
    department: "기업법제팀", body: "", collectedAt: "2026-07-23T00:00:00.000Z",
    createdAt: "2026-07-23T00:00:00.000Z", files: [],
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
