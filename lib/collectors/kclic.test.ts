// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseKclicNotices, kclicFileUrl, noticesToItems } from "./kclic";

const html = readFileSync(new URL("./__fixtures__/kclic-notice.html", import.meta.url), "utf8");

describe("parseKclicNotices", () => {
  const notices = parseKclicNotices(html);

  it("parses each notice row", () => {
    expect(notices.length).toBe(2);
  });

  it("extracts contId, title, department, KST date", () => {
    const n = notices[0];
    expect(n.contId).toBe("11808");
    expect(n.title).toBe("유가증권시장 공시규정 일부개정 안내");
    expect(n.department).toBe("한국거래소");
    expect(n.collectedAt).toBe("2026-07-01T15:00:00.000Z"); // 2026-07-02 KST
  });

  it("extracts attachments (seq + real filename) from fn_fileDownload", () => {
    expect(notices[0].files).toEqual([
      { seq: "1", name: "[공문] 유가증권시장 공시규정 일부개정 통보.pdf" },
      { seq: "2", name: "신구조문대비표.hwp" },
    ]);
    expect(notices[1].files.length).toBe(1);
  });
});

describe("kclicFileUrl", () => {
  it("builds a GET download URL with the required params", () => {
    const url = kclicFileUrl("11808", "1", "a b.pdf");
    expect(url).toContain("/sprtroom/fileDownload.do?");
    expect(url).toContain("method=searchBbsAttachFile");
    expect(url).toContain("sprtRoomNo=11808");
    expect(url).toContain("attachSeq=1");
    expect(url).toContain("attachFileNm=a+b.pdf");
  });
});

describe("noticesToItems", () => {
  it("maps to CollectedItems with cookie-bearing file headers", () => {
    const items = noticesToItems(parseKclicNotices(html), "JSESSIONID=abc");
    expect(items[0].board).toBe("kclic");
    expect(items[0].sourceRef).toBe("11808");
    expect(items[0].files[0].headers?.Cookie).toBe("JSESSIONID=abc");
    expect(items[0].files[0].externalUrl).toContain("fileDownload.do");
  });
});
