# Phase 2 — 수집 대상 게시판 크롤링 가능성 조사 (2026-07-23)

모두 **로그인 불필요, 공개 접근 가능**. 콘텐츠 카테고리는 전부 게시판의 `공시법규 규정`(disclosure) 탭에 해당.

| # | 출처 / 게시판 | URL | 규모 | 수집 방법 | 페이지네이션 | 항목 필드 | 난이도 |
|---|---|---|---|---|---|---|---|
| 1 | 금융위 보도자료 | fsc.go.kr/no010101 | 15,252건 | **RSS** `fsc.go.kr/about/fsc_bbs_rss/?fid=0111` (권장) 또는 HTML | `curPage`, 상세 `/no010101/{id}` | 제목·날짜·담당부서·첨부 | ★ 쉬움 |
| 2 | 금융위 소관규정/고시/공고/훈령 | fsc.go.kr/po040200 | 4,381건 | HTML 스크래핑 (전용 RSS 없음) | `curPage` | 제목·담당부서·날짜·첨부 | ★★ |
| 3 | 공정위 보도자료 | ftc.go.kr/…selectBbsNttList.do?bordCd=3 | ~9,700건 | HTML 스크래핑 (깔끔한 쿼리파라미터) | `pageIndex`,`pageUnit`; 상세 `selectBbsNttView.do?nttSn={id}` | 구분(보도/참고)·제목·담당부서·등록일·첨부 | ★★ |
| 4 | 금감원 기업공시 길라잡이 — 보도자료 | dart.fss.or.kr/info/searchBodo.do | 1,182건 | HTML 스크래핑 (**JS `search(page)` 호출** — 백엔드 요청 재현 필요) | `javascript:search(n)` | 제목·담당부서·작성일자·첨부 (스키마와 1:1) | ★★★ |
| 5 | 금감원 기업공시 길라잡이 — 안내/제도 | dart.fss.or.kr/info/searchGuide.do | 196건 | HTML 스크래핑 (동일 JS 패턴) | `javascript:search(n)` | 제목·담당부서·작성일자·첨부 | ★★★ |
| 6 | 상장회사협의회(KLCA) 공문/공지 | klca.or.kr/sub/comm/official_document.asp | ~2,590건 | HTML 스크래핑 (ASP) | `rWork=TblList&rGotoPage=N` | 번호·제목·날짜·부서·조회 | ★★ |
| 7 | 상장회사협의회(KLCA) 법령정보 | klca.or.kr/sub/law/legal_information.asp | 832건 | HTML 스크래핑 (ASP) | 서버 페이지네이션 | 번호·제목·날짜·분류(규제개혁/회계 등)·조회 | ★★ |

## 방법별 요약
- **RSS (가장 안정적)**: 금융위 보도자료(1)만 전용 피드 확인. XML 파싱만 하면 됨.
- **깔끔한 HTML 스크래핑 (쿼리파라미터 페이지네이션)**: 금융위 소관규정(2), 공정위(3), KLCA 2종(6,7). HTTP GET + HTML 파서(cheerio 등).
- **JS 구동 스크래핑**: 금감원 DART 2종(4,5) — 목록이 `javascript:search(n)`로 로드되고 상세가 `#bodoName` 프래그먼트. 실제 백엔드 요청(GET/POST 파라미터)을 찾아 직접 호출해야 함. 구현 시 네트워크 탭 분석 1회 필요.

## 공통 설계 함의
- **중복 방지 키**: `(source, 원문 상세 URL 또는 게시물 ID)`. 접수/게시물 ID가 있으면 그걸, 없으면 정규화한 상세 URL.
- **첨부파일**: 모두 HWP/HWPX/PDF 첨부 존재. 원본 URL을 저장해 링크로 다운로드 유도(Storage 복제 대신) 권장 — 저장공간·저작권 부담 감소.
- **본문(body)**: RSS는 요약 제공. 스크래핑 대상은 상세 페이지에서 본문 텍스트 추출 가능하나, MVP는 제목·출처·부서·날짜·원문링크 중심으로도 충분.
- **카테고리 매핑**: 7개 모두 `disclosure`(공시법규 규정) 탭. `source` 필드로 기관 구분(금융위/금감원/공정위/KLCA).
- **로봇/약관**: 모두 공개 정부·협회 자료. robots.txt 및 이용약관 확인 후 적정 주기(예: 1시간~수시간)로 정중히 수집.

## 신규 등록 알림 (요구사항 2)
- 스케줄 수집 시 신규(중복키 미존재) 항목 발견 → **미리 정의된 담당자에게 이메일 발송(제목 + 출처 + 원문 링크 포함)**.
- 이메일 발송 수단 후보: Resend(Vercel 친화, 간단), 사내 SMTP, AWS SES.
- 수신자 관리: Supabase 테이블(`alert_recipients`: email, 활성여부, 선택적 source/카테고리 필터) 권장.
