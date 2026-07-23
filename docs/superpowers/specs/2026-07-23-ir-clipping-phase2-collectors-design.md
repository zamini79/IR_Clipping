# IR 클리핑 게시판 Phase 2 — 자동 수집기 + 신규 알림 설계 문서

- **작성일**: 2026-07-23
- **상태**: 승인 대기
- **선행**: Phase 1(게시판/DB/배포) 완료. 본 문서는 `공시법규 규정`(disclosure) 탭 데이터를 자동 수집하고 신규 항목을 이메일로 알린다.
- **조사 근거**: `docs/superpowers/research/2026-07-23-phase2-source-crawlability.md`

## 1. 목표

1. 지정된 7개 공개 게시판을 **주기적(매시간)으로 전수 점검**하여 신규 게시물을 Supabase에 적재(게시판에 자동 노출).
2. 신규 게시물 발견 시 **미리 정의된 담당자(공통 목록)에게 이메일 알림** — 제목·출처·원문 링크 포함.

## 2. 확정 사항

| 항목 | 결정 |
|---|---|
| 이메일 발송 | **Gmail SMTP + 앱 비밀번호**(Nodemailer). 발신 = 기존 개인 Gmail. |
| 수신자 | **공통 수신 목록**(Supabase `alert_recipients` 테이블). |
| 수집 주기 | **1시간마다**. |
| 스케줄러 | **GitHub Actions 스케줄 워크플로**(cron `0 * * * *`)가 Vercel의 보호된 `/api/collect` 호출. (Vercel Hobby Cron은 1일 1회 제한이므로.) Vercel Pro면 Vercel Cron으로 대체 가능. |
| 적재 권한 | 서버에서 Supabase **service_role 키**로 upsert(RLS 우회). 클라이언트 노출 금지. |
| 알림 형태 | 실행 1회당 **신규 항목을 모은 다이제스트 1통**(출처별 그룹, 각 항목 제목+링크). 신규 0건이면 미발송. |
| 첨부파일 | **실제 파일을 Supabase Storage에 복제 저장**(영구 아카이브). 게시판은 서명 URL로 다운로드 제공. |

## 3. 수집 대상 (7개, 전부 `disclosure` 카테고리)

| source 값 | 게시판 | URL | 방법 |
|---|---|---|---|
| `금융위원회` | 보도자료 | fsc.go.kr/no010101 | RSS `fsc.go.kr/about/fsc_bbs_rss/?fid=0111` |
| `금융위원회` | 소관규정/고시/공고/훈령 | fsc.go.kr/po040200 | HTML (`curPage`) |
| `공정거래위원회` | 보도자료 | ftc.go.kr/…selectBbsNttList.do?bordCd=3 | HTML (`pageIndex`) |
| `금융감독원` | 기업공시 길라잡이 보도자료 | dart.fss.or.kr/info/searchBodo.do | HTML (JS `search()` 백엔드 요청 재현) |
| `금융감독원` | 기업공시 길라잡이 안내/제도 | dart.fss.or.kr/info/searchGuide.do | HTML (동일) |
| `상장회사협의회` | 공문/공지 | klca.or.kr/sub/comm/official_document.asp | HTML (`rGotoPage`) |
| `상장회사협의회` | 법령정보 | klca.or.kr/sub/law/legal_information.asp | HTML (서버 페이지네이션) |

> `source`가 같은 기관이라도 게시판이 다르므로, 세부 게시판은 별도 `board` 식별자로도 구분한다(예: `fsc-bodo`, `fsc-reg`, `ftc-bodo`, `fss-bodo`, `fss-guide`, `klca-doc`, `klca-law`).

## 4. 아키텍처

```
GitHub Actions (cron 매시간)
   └─ POST https://<app>/api/collect  (헤더 x-cron-secret: CRON_SECRET)
        └─ collectors[] 순회
             fetch 목록 → parse → 정규화(CollectedItem)
             Supabase upsert (중복키로 신규만 insert)
             신규 목록 수집
        └─ 신규 있으면 Gmail SMTP로 담당자에게 다이제스트 발송
        └─ 결과 요약 반환 (실행 로그)
```

- `/api/collect`는 Next.js Route Handler(**Node.js 런타임**, `export const runtime = "nodejs"`; Nodemailer/cheerio가 Edge 불가). `CRON_SECRET` 헤더 검증으로 외부 무단 호출 차단.
- 각 수집기는 공통 인터페이스를 구현: `collect(): Promise<CollectedItem[]>`.
- 파서: RSS는 `fast-xml-parser`, HTML은 `cheerio`.

## 5. 데이터 모델 변경 (`supabase/migrations/0002_phase2.sql`)

`clippings` 테이블에 컬럼 추가:
- `board` text — 세부 게시판 식별자.
- `source_ref` text — 출처 내 고유 식별자(게시물 ID 또는 정규화 상세 URL).
- `source_url` text — 원문 게시물 링크(게시판 상세/이메일 링크에 사용).
- `notified_at` timestamptz null — 알림 발송 시각(재발송 방지).
- **UNIQUE (`board`, `source_ref`)** — 중복 방지 키.

`clipping_files`에 컬럼 추가:
- `external_url` text — 원본 첨부 다운로드 URL(출처 추적/재수집용 기록).
- (`storage_path`는 기존 컬럼 사용 — Storage에 업로드한 실제 파일 경로.)

Supabase **Storage 버킷 `clipping-files`** 사용. 수집기가 원본 파일을 내려받아 `{board}/{source_ref}/{파일명}` 경로로 업로드하고 `storage_path`에 기록. 다운로드는 서버에서 서명 URL(signed URL) 생성해 제공. 버킷은 비공개(공개 버킷 대신 서명 URL) 권장.

신규 테이블 `alert_recipients`:
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `email` | text unique | 수신 이메일 |
| `active` | boolean default true | 발송 대상 여부 |
| `created_at` | timestamptz default now() | |

RLS: `alert_recipients`는 공개 select 정책 **부여하지 않음**(민감). 서버(service_role)만 접근.

## 6. 수집기 공통 규약

```ts
interface CollectedItem {
  board: string;          // 예: "fsc-bodo"
  source: string;         // 예: "금융위원회"
  sourceRef: string;      // 게시물 ID 또는 정규화 URL (board 내 유일)
  title: string;
  department: string;     // 없으면 ""
  collectedAt: string;    // 게시일 ISO (없으면 수집시각)
  sourceUrl: string;      // 원문 링크
  body: string;           // 요약/본문(없으면 "")
  files: { name: string; externalUrl: string }[];  // externalUrl에서 다운로드 → Storage 업로드
}
interface Collector { board: string; source: string; collect(): Promise<CollectedItem[]>; }
```

- 각 수집기는 **최근 N건(예: 1~2페이지)만** 조회(신규 감지 목적, 전체 백필 아님). 초기 1회 백필은 별도 스크립트로 선택 실행.
- 실패 격리: 한 수집기가 에러나도 나머지는 진행(에러는 로깅, 알림에 실패 요약 포함 가능).

## 7. 알림 (이메일)

- 발송 조건: 이번 실행에서 새로 insert된 항목이 1건 이상.
- 수신: `alert_recipients`에서 `active=true` 전체(공통 목록).
- 내용: 제목 "[IR 클리핑] 신규 N건", 본문에 출처별 그룹 → 각 항목 `제목` + `원문 링크` + 게시일. HTML + 텍스트 대체본.
- 발송 후 해당 항목 `notified_at` 갱신 → 중복 알림 방지.
- 전송: Nodemailer, `service: "gmail"` 또는 `smtp.gmail.com:465(SSL)`, 인증 `GMAIL_USER`/`GMAIL_APP_PASSWORD`.

## 8. 환경변수 (서버 전용)

- `SUPABASE_SERVICE_ROLE_KEY` (기존)
- `NEXT_PUBLIC_SUPABASE_URL` (기존)
- `CRON_SECRET` — `/api/collect` 호출 인증
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — Gmail SMTP
- GitHub Actions Secrets에 `APP_COLLECT_URL`, `CRON_SECRET` 저장.

## 9. 게시판(Phase 1) 소폭 연동

- `DetailModal`의 "다운로드"를 `storage_path` 기반 **서명 URL**로 연결(서버에서 생성). 없으면 기존처럼 표시만.
- `source_url`이 있으면 상세 모달에 "원문 보기" 링크 추가(선택).
- "최근 수집" 시각을 마지막 성공 수집 시각으로 표시(선택; 별도 상태 테이블 또는 max(created_at)).

## 10. 단계적 구현 순서 (수직 슬라이스)

1. **DB 마이그레이션 0002** + Storage 버킷 `clipping-files`(비공개) 생성 + `alert_recipients` 시드(담당자 이메일).
2. **수집 파이프라인 골격**: `/api/collect`(Node, CRON_SECRET), 공통 인터페이스, upsert 로직, **첨부 다운로드→Storage 업로드 유틸**, 다이제스트 이메일(Nodemailer). 수집기 1개(금융위 보도자료 RSS)로 엔드투엔드 완성 + 테스트.
3. **HTML 수집기 추가**(첨부 복제 포함): 금융위 소관규정, 공정위 보도자료, KLCA 2종.
4. **DART 2종**(JS `search()` 요청 재현) 추가.
5. **GitHub Actions 스케줄 워크플로**(매시간) 연결 + Vercel 환경변수 설정.
6. (선택) 게시판 다운로드/원문 링크 연동, 최근 수집 시각 표시.

## 11. 리스크 / 유의

- **스크래핑 취약성**: 사이트 HTML 변경 시 파서 깨질 수 있음 → 수집기별 파싱 실패를 잡아 알림/로깅.
- **약관/로봇**: 공개 정부·협회 자료이나 각 사이트 robots.txt/이용약관 확인, 정중한 주기(1시간)·User-Agent 명시.
- **Gmail 한도/차단**: 개인 Gmail 발송 한도(~500/일) 내. sk.com이 아닌 개인 Gmail이라 Workspace 정책 이슈 없음. 앱 비밀번호는 2단계 인증 필요.
- **JS 구동 DART**: `search()`의 실제 요청(파라미터/POST) 분석 필요 — 구현 시 1회 조사 태스크 포함.
- **본문**: MVP는 제목·출처·부서·게시일·원문링크 중심. 본문은 best-effort(상세 페이지 파싱).
- **첨부 복제**: 파일을 Storage에 저장. 대용량 HWP/PDF 다수 → 실행당 다운로드 크기/시간 상한 고려(예: 파일당 최대 크기 제한, 실패 시 external_url만 기록하고 계속). 동일 파일 재업로드 방지(경로에 source_ref 포함, 이미 있으면 skip). Storage 용량·요금 모니터링.

## 12. 범위 밖 (향후)

- FnGuide 탭 수집(유료 로그인 필요 — 별도 스펙에서 방식 확정).
- 관리자 UI(수신자·수집기 관리 화면).
- 전체 이력 백필(대량 과거 게시물 적재).
