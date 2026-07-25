// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseFssDetailBody } from "./fss-detail";

// Mirrors the DART board-view template shared by 보도자료 / 안내·해설 / 공시유의사항:
// the post content sits in a `td.main_txt` cell.
const html = `<html><body><table>
  <tr><th>제목</th><td></td></tr>
  <tr><th>담당부서</th><td>기업공시국</td></tr>
  <tr><th>등록일</th><td>2026.07.23</td></tr>
  <tr><th></th><td class="main_txt">ㅁ 소액공모 범위 확대<br>ㅇ 자세한 내용은 붙임을 참조하시기 바랍니다.</td></tr>
</table></body></html>`;

describe("parseFssDetailBody", () => {
  it("extracts the detail-page body (td.main_txt) as HTML", () => {
    const body = parseFssDetailBody(html);
    expect(body).toContain("소액공모 범위 확대");
    // Inner HTML is preserved so read-time htmlToText renders the <br> breaks.
    expect(body).toMatch(/<br\s*\/?>/i);
  });
  it("returns '' when the content cell is absent", () => {
    expect(parseFssDetailBody("<html><body><p>nope</p></body></html>")).toBe("");
  });
});
