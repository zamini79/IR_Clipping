# DART 기업공시 길라잡이 (searchBodo / searchGuide) 요청 조사 (2026-07-23)

## 조사 방법

```bash
curl -sL "https://dart.fss.or.kr/info/searchBodo.do" -A "Mozilla/5.0 ..." -o /tmp/sb.html
curl -sL "https://dart.fss.or.kr/info/searchGuide.do" -A "Mozilla/5.0 ..." -o /tmp/sg.html
grep -n "function search(" -A 20 /tmp/sb.html
grep -n "<form" /tmp/sb.html
```

## 결론 요약

두 게시판 모두 **초기 GET 응답에 목록 행이 이미 서버 렌더링되어 있음** (currentPage 파라미터 없이 접속하면 1페이지가 기본으로 채워짐). 별도 AJAX/XHR 없이 페이지 소스 자체가 목록 표를 담고 있어, 픽스처는 초기 페이지 HTML을 그대로 저장하면 된다.

페이지네이션은 `function search(page)`가 hidden form(`currentPage`)의 값을 바꾸고 form을 **POST**로 재제출하는 방식이지만, 실측 결과 서버는 **GET 쿼리스트링(`?currentPage=N`)도 동일하게 처리**한다 (`searchBodo.do?currentPage=2`가 `currentPage=1`과 다른 15건의 `selectBodo('nnnnn')` seqno 목록을 반환함을 확인). 따라서 collector는 단순 GET으로 재현 가능.

## searchBodo (보도자료)

- **목록 엔드포인트**: `GET https://dart.fss.or.kr/info/searchBodo.do` (기본 = 1페이지, `?currentPage=1` 동일)
- **폼**: `<form name="searchBodoForm" id="searchBodoForm" action="selectBodo.do" method="post">` — hidden inputs: `currentPage`, `seqno`, text input `title`(제목 검색어)
- **JS**: `function search(page){ frm.currentPage.value=page; frm.action="/info/searchBodo.do"; frm.submit(); }` — 실제로는 GET으로도 페이지 전환 가능(위 확인).
- **목록 행 구조** (서버 렌더링, `table.tbList tbody tr`):
  - td[0] 번호(cen_txt) — 게시글 순번(표시용, 페이지 넘어가면 재사용 안 됨. 다만 seqno가 더 안정적)
  - td[1] 제목 — `<a href="#bodoName" onclick="selectBodo('28363'); return false;" title="...">제목</a>` — **href는 `#bodoName` 프래그먼트뿐**이고 실제 클릭 동작은 JS `selectBodo(seqno)`가 hidden form의 `seqno`를 채우고 `action=/info/selectBodo.do`로 **POST** 제출.
  - td[2] 담당부서(cen_txt) — 예: "기업공시국"
  - td[3] 작성일자(cen_txt) — `YYYY.MM.DD` (예: `2026.07.21`), KST로 관측됨(시각 정보 없음)
  - td[4] 조회수(cen_txt)
  - td[5] 첨부파일(cen_txt end) — `<a onclick="getFSSFileUrl('<atchFileId>','<fileSn> ');...">` 안에 `<button class="btnHan|btnPdf" title="<파일명>">`
- **상세 링크 실측**:
  - `GET /info/selectBodo.do?seqno=28363` → **302 → /html/error1.htm** (GET 거부)
  - `POST /info/selectBodo.do` body `seqno=28363` → **200 OK** (상세 HTML, 29,887 bytes) — 실제 상세 데이터는 존재하지만 **GET으로 링크 공유 가능한 URL이 없음** (POST-only, referer/hidden form 의존적인 순수 서버사이드 라우트).
  - 결론: 실질적으로 "실제 상세 URL"은 없다고 판단 — 브라우저에서 그냥 열 수 있는 링크가 아니라 JS가 hidden form을 채워 POST하는 방식뿐. **브리프의 "JS 프래그먼트만 있고 실제 상세 URL이 없는 경우" 조건에 해당**.
  - → **sourceUrl = 목록 페이지 URL**(`https://dart.fss.or.kr/info/searchBodo.do`), **sourceRef = `selectBodo('SEQNO')`의 SEQNO** (행마다 고유·안정적인 게시물 seq).
- **첨부파일 다운로드**: `getFSSFileUrl(fileid, sn)` → `https://www.fss.or.kr/fss/cmmn/file/fileDown.do?atchFileId={fileid}&fileSn={sn}` (sn 값에 후행 공백이 있어 trim 필요). 이 URL은 GET으로 직접 접근 가능한 실제 다운로드 링크이므로 `files[].externalUrl`로 사용.

## searchGuide (안내/제도, "자료실")

- **목록 엔드포인트**: `GET https://dart.fss.or.kr/info/searchGuide.do` (기본 = 1페이지)
- **폼**: `<form name="searchGuideForm" id="searchGuideForm" action="/info/searchGuide.do" method="post">` — hidden inputs: `currentPage`, `pageGrouping`(="01"), `seqno`, text `title`
- **JS**: `function search(page){ frm.currentPage.value=page; frm.submit(); }` (action은 폼 자체에 이미 `/info/searchGuide.do`로 지정, POST). GET 쿼리스트링으로도 동일 동작 확인.
- **목록 행 구조** (`table.tbList tbody tr`) — searchBodo와 완전히 동일한 6컬럼(번호/제목/담당부서/작성일자/조회수/첨부파일)이나 제목 링크만 다름:
  - td[1]: `<a href="#gongsi" onclick="selectGongsi('446'); return false;">제목</a>` — 역시 `#`프래그먼트 + JS(`selectGongsi`), 실제 상세는 `seqno` hidden input 채운 뒤 POST 제출 방식으로 searchBodo와 동일한 한계.
  - td[3] 작성일자: `YYYY.MM.DD` (예: `2026.07.23`)
  - td[5] 첨부파일: searchBodo와 동일한 `getFSSFileUrl(fileid, sn)` 패턴.
- **결론**: searchBodo와 동일하게 **sourceUrl = 목록 URL**, **sourceRef = `selectGongsi('SEQNO')`의 SEQNO**.

## 픽스처

- `lib/collectors/__fixtures__/fss-bodo.html` ← `searchBodo.do` 초기 GET 응답 그대로 저장 (15개 데이터 행)
- `lib/collectors/__fixtures__/fss-guide.html` ← `searchGuide.do` 초기 GET 응답 그대로 저장 (15개 데이터 행)

## sourceRef 전략 결정 이유

두 게시판 모두 제목 링크가 `#bodoName`/`#gongsi` 프래그먼트뿐이며, 실제 상세 라우트(`selectBodo.do`, `selectGuide.do`류)는 GET을 거부하고 POST(hidden-form 기반)만 허용하므로 "복사해서 브라우저에 붙여넣을 수 있는 상세 URL"이 존재하지 않는다. 브리프 지침에 따라 `sourceUrl`은 목록 페이지 URL로 고정하고, 각 행에 항상 존재하는 안정적 식별자인 `selectBodo/selectGongsi`의 seqno 인자를 `sourceRef`로 사용한다 (표시용 "번호" 컬럼은 페이지가 바뀌면 값이 바뀌므로 사용하지 않음).
