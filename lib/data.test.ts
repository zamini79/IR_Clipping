import { describe, it, expect } from "vitest";
import { mapRowToClipping } from "./data";

describe("mapRowToClipping", () => {
  it("maps a DB row with files to a Clipping", () => {
    const row = {
      id: "c1",
      category: "disclosure",
      board: "fss-bodo",
      title: "제목",
      source: "금융감독원",
      source_ref: "1182",
      source_url: "https://dart.fss.or.kr/info/searchBodoView.do?rcpNo=1182",
      department: "공시제도팀",
      body: "본문",
      collected_at: "2026-07-21T00:00:00.000Z",
      created_at: "2026-07-21T01:00:00.000Z",
      clipping_files: [
        {
          id: "f1",
          name: "a.pdf",
          size: "1.8MB",
          storage_path: "clipping-files/a.pdf",
          external_url: "https://dart.fss.or.kr/pdf/a.pdf",
        },
      ],
    };
    const c = mapRowToClipping(row);
    expect(c).toEqual({
      id: "c1",
      category: "disclosure",
      board: "fss-bodo",
      title: "제목",
      source: "금융감독원",
      sourceRef: "1182",
      sourceUrl: "https://dart.fss.or.kr/info/searchBodoView.do?rcpNo=1182",
      department: "공시제도팀",
      body: "본문",
      collectedAt: "2026-07-21T00:00:00.000Z",
      createdAt: "2026-07-21T01:00:00.000Z",
      files: [
        {
          id: "f1",
          name: "a.pdf",
          size: "1.8MB",
          storagePath: "clipping-files/a.pdf",
          externalUrl: "https://dart.fss.or.kr/pdf/a.pdf",
        },
      ],
    });
    expect(c.board).toBe("fss-bodo");
    expect(c.sourceRef).toBe("1182");
    expect(c.sourceUrl).toBe("https://dart.fss.or.kr/info/searchBodoView.do?rcpNo=1182");
    expect(c.files[0].externalUrl).toBe("https://dart.fss.or.kr/pdf/a.pdf");
  });

  it("defaults files to an empty array when missing", () => {
    const row = {
      id: "c2",
      category: "fnguide",
      board: "seed",
      title: "t",
      source: "FnGuide",
      source_ref: "c2",
      source_url: "",
      department: "IR기획팀",
      body: "b",
      collected_at: "2026-07-05T00:00:00.000Z",
      created_at: "2026-07-05T00:00:00.000Z",
      clipping_files: null,
    };
    expect(mapRowToClipping(row).files).toEqual([]);
  });
});
