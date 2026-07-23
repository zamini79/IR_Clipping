# IR 클리핑 게시판 — 설계 문서 (Design Spec)

- **작성일**: 2026-07-23
- **상태**: 승인됨 (Phase 1 착수)
- **디자인 레퍼런스**: `IR Clipping Board.dc.html`, `README.md`

## 1. 목적

사내 IR팀이 기업 공시 관련 정보(공시 법규·규정, FnGuide 리서치)를 여러 외부 사이트에서
클리핑하여 한 곳에 모아 보는 **사외 공개 읽기 전용 게시판**. 두 개의 최상위 메뉴로 구분한다:

- **공시법규 규정** (`disclosure`) — 금감원/거래소/금융위 등 공시 법규·규정·제도 소식
- **FnGuide** (`fnguide`) — 컨센서스, 산업 동향, 수급 등 리서치 클리핑

## 2. 확정 사항

| 항목 | 결정 |
|---|---|
| 범위 | 게시판 + 자동 수집(크롤링) — 단, 하위 시스템별 단계적 진행 |
| 기술 스택 | Next.js (App Router, TypeScript) 풀스택 |
| DB / 파일 | Supabase (Postgres + Storage) |
| 배포 | Vercel |
| 형상관리 | GitHub |
| 인증 | 없음 — 사외 공개 정보이므로 누구나 접근 가능한 읽기 전용 |
| ORM/접근 | Supabase JS 클라이언트 (`@supabase/ssr`) |

## 3. 단계 구분 (Decomposition)

이 프로젝트는 3개의 독립 하위 시스템으로 구성되며, 각각 별도 스펙 → 구현 사이클을 가진다.

- **Phase 1 (본 스펙)**: 게시판 UI + 조회 API + DB 스키마 + 시드 데이터. 실제 Supabase 연동 완료 상태로 배포 가능.
- **Phase 2 (별도 스펙)**: 소스별 자동 수집기. 금감원은 **DART OpenAPI**(공식 경로) 우선, FnGuide는 계약/API 확인 필요, 나머지 소스는 개별 검토. 스케줄링은 Vercel Cron 또는 Supabase pg_cron.

## 4. 아키텍처

```
[크롤러(Phase 2)] ──write──▶ [Supabase Postgres]  ◀──read── [Next.js 게시판]
                             [Supabase Storage]    (첨부파일)       │
                                                          Vercel 배포 ◀── GitHub
```

- 게시판은 Supabase에서 읽기만 한다. 쓰기는 Phase 2 크롤러(서비스 롤 키) 또는 향후 관리자 경로가 담당.
- 공개 읽기는 Supabase RLS로 `select`만 anon 허용, `insert/update/delete`는 차단.

## 5. 데이터 모델

### `clippings`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK, default gen_random_uuid) | 고유 ID |
| `category` | text (`disclosure` \| `fnguide`) | 메뉴 구분 |
| `title` | text | 제목 |
| `source` | text | 출처 (예: 금융감독원) |
| `department` | text | 등록자(담당부서) |
| `body` | text | 본문 |
| `collected_at` | timestamptz | 등록일(수집일) — 목록/상세에 `YYYY.MM.DD`로 표시 |
| `created_at` | timestamptz (default now) | 레코드 생성 시각 |

인덱스: `(category, collected_at desc)`.

### `clipping_files`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid (PK) | 고유 ID |
| `clipping_id` | uuid (FK → clippings.id, on delete cascade) | 소속 글 |
| `name` | text | 파일명 (예: 사업보고서_기재요령_개정.pdf) |
| `size` | text | 표시용 크기 (예: 1.8MB) |
| `storage_path` | text | Supabase Storage 내 경로 |

- 첨부 실제 파일은 Supabase Storage 버킷(`clipping-files`)에 저장. 다운로드는 서명 URL로 제공.
- 시드 단계에서는 실제 파일 없이 메타데이터(name, size)만 넣고 다운로드는 비활성/placeholder 처리 가능.

## 6. 화면 / 컴포넌트 (Phase 1)

디자인은 `IR Clipping Board.dc.html`의 채택안(1a Ledger)을 픽셀 단위로 재현한다. 토큰 값은 `README.md` 기준.

### 라우트 / 컴포넌트
- `app/page.tsx` (Server Component) — URL 쿼리(`?category=&q=&page=`)를 읽어 Supabase에서 초기 데이터 조회 후 렌더.
- `components/Board.tsx` (Client) — 탭/검색/페이지네이션 상태를 URL과 동기화하며 관리.
- `components/BoardTable.tsx` — 테이블 헤더 + 행. grid `52px 1fr 130px 96px 68px`.
- `components/SearchBar.tsx` — 실시간 입력 필터(디바운스), URL `q` 갱신.
- `components/Pagination.tsx` — 페이지당 6건, `‹`/`›` 범위 클램프.
- `components/DetailModal.tsx` — 행 클릭 시 오픈, 오버레이/ESC 닫기, 첨부 목록.

### 데이터 조회
- Supabase 쿼리: `category` 필터 + `title/department/source` 부분일치(`ilike`) + `collected_at desc` 정렬 + range로 페이지당 6건.
- 총 건수는 `count`로 조회하여 툴바 "검색결과 N건" 및 페이지 수 계산.

### 상태 규칙 (디자인 스펙 유지)
- 상태: `activeTab`(0=공시법규 규정, 1=FnGuide), `query`, `page`(0-index), `detailId`.
- 탭 전환 시 `page=0`, `query=""` 리셋.
- 검색은 title + department + source 대상, 대소문자 무시, 부분일치, 입력 시 `page=0`.
- 페이지당 6건. 페이지네이션 범위 클램프.
- **NEW 배지**: 해당 탭 최신순 상위 2건.
- **No**: 탭 내 역순 인덱스를 두 자리 0패딩 (최신 = 큰 번호).
- 첨부 있으면 `📎 N`, 없으면 `—`. 상세 모달 첨부 없으면 "첨부파일 없음".

## 7. 디자인 토큰 적용

- Tailwind CSS 설정에 README의 색상 팔레트를 커스텀 컬러로 등록 (페이지 `#eceae3`, 카드 `#fbfaf6`, 잉크 `#1a2338`, 골드 액센트 `#9a7b46`/`#c2a86e`, NEW 레드 `#b23b3b` 등).
- 폰트: Pretendard(UI/본문), Noto Serif KR(제목), IBM Plex Mono(숫자/날짜/코드) — CDN 또는 `next/font`.
- Radius(카드 12, 인풋/버튼 7, 칩/페이지버튼 6–8), 그림자(카드/모달), 컨테이너 폭(목록 1040, 모달 640) 스펙대로.
- 아이콘 이모지 placeholder(⌕, 📎)는 구현 시 아이콘 세트로 교체 가능(선택).

## 8. 시드 데이터

`README.md` / `IR Clipping Board.dc.html`의 `data()`에 있는 샘플(공시법규 규정 8건, FnGuide 5건, 총 13건)을 Supabase 시드 스크립트로 삽입하여 Phase 1을 실제 DB 연동 상태로 완성한다. `collected_at`은 샘플의 날짜 사용.

## 9. 배포 / 형상관리

- GitHub 레포에 코드 관리. Vercel에 연결하여 push 시 자동 배포.
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (공개 읽기용). 서비스 롤 키는 Phase 2 크롤러 전용, 클라이언트에 노출 금지.
- Supabase 마이그레이션은 SQL 파일로 레포에 포함.

## 10. 미결 / 향후 (Out of scope for Phase 1)

- **담당부서 채우기**: 크롤러 도입 전에는 시드/수동. 수동 관리가 필요하면 향후 보호된 관리자 페이지 추가 검토.
- **Phase 2 수집기**: 소스별 수집 방식(DART OpenAPI, FnGuide 계약 등)은 Phase 2 스펙에서 상세화.
- 첨부파일 실제 업로드/다운로드 파이프라인 세부는 크롤러 도입 시 확정.
