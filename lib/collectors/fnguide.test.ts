// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseReports, FNGUIDE_KEYWORDS } from "./fnguide";

const dataSet = [
  {
    RPT_ID: 1115875,
    RPT_TITLE: "Non-banking unit to drive up shares [SAMSUNG]",
    ANL_DT: "26.07.24",
    BROKERAGE: { NAME: "삼성증권", VALUE: "1" },
    ANALYSTS: [{ NAME: "김재우", VALUE: "250034" }, { NAME: "윤희재", VALUE: "941538" }],
  },
  { RPT_ID: 1115000, RPT_TITLE: "제약바이오 산업 동향", ANL_DT: "26.07.20", BROKERAGE: { NAME: "미래에셋증권" }, ANALYSTS: [] },
  { RPT_ID: null, RPT_TITLE: "no id -> dropped", ANL_DT: "26.07.24" },
];

describe("parseReports", () => {
  const r = parseReports(dataSet);

  it("maps valid reports and drops ones without an id/title", () => {
    expect(r.length).toBe(2);
  });
  it("extracts id, title, brokerage, analysts, and KST date", () => {
    expect(r[0].rptId).toBe("1115875");
    expect(r[0].title).toContain("Non-banking");
    expect(r[0].brokerage).toBe("삼성증권");
    expect(r[0].analysts).toBe("김재우, 윤희재");
    expect(r[0].anlDt).toBe("2026-07-23T15:00:00.000Z"); // 26.07.24 KST
  });
  it("returns [] for a non-array input", () => {
    expect(parseReports(null)).toEqual([]);
  });
});

describe("FNGUIDE_KEYWORDS", () => {
  it("has the full keyword list", () => {
    expect(FNGUIDE_KEYWORDS.length).toBe(24);
    expect(FNGUIDE_KEYWORDS).toContain("삼성바이오로직스");
    expect(FNGUIDE_KEYWORDS).toContain("JPM헬스케어");
  });
});
