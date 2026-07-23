# Handoff: IR 클리핑 게시판 (IR Clipping Board)

## Overview
사내 IR팀이 기업 공시 관련 정보(공시 법규·규정, FnGuide 리서치/소식)를 여러 외부 사이트에서
**자동으로 클리핑하여 한 곳에 모아 보는** 사내 게시판입니다. 게시글은 담당자가 수동 등록하지
않습니다 — 별도 수집 프로세스가 DB에 적재하고, 이 화면은 그 DB를 읽어 목록으로 보여줍니다.

두 개의 최상위 메뉴가 있습니다:
- **공시법규 규정** — 금융감독원/한국거래소/금융위 등 공시 법규·규정·제도 소식
- **FnGuide** — 컨센서스, 산업 동향, 수급 등 리서치 클리핑

각 글은 **제목 · 등록일(수집일) · 등록자(담당부서) · 출처 · 첨부파일**을 가집니다.

## About the Design Files
이 번들의 파일들은 **HTML로 제작한 디자인 레퍼런스**입니다 — 의도한 외형과 동작을 보여주는
프로토타입이며, 그대로 복사해 프로덕션에 넣을 코드가 아닙니다. 목표는 이 HTML 디자인을
**대상 코드베이스의 기존 환경**(React, Vue, 서버사이드 템플릿 등)에서 그 프로젝트의 기존
패턴·라이브러리로 **재구현**하는 것입니다. 아직 환경이 없다면 프로젝트에 가장 적합한
프레임워크를 선택해 구현하면 됩니다.

`.dc.html` 파일은 브라우저에서 바로 열려 렌더링을 확인할 수 있습니다 (커스텀 런타임으로 동작하므로
소스 문법은 참고만 하고, 아래 명세를 기준으로 구현하세요).

## Fidelity
**High-fidelity (hifi)** — 최종 색상/타이포/간격/인터랙션이 확정된 목업입니다. 아래 디자인 토큰과
컴포넌트 명세대로 픽셀 단위로 재현하세요.

## Screens / Views

### 1. 게시판 목록 (Board List) — 메인 화면
파일: `IR Clipping Board.dc.html`

**Purpose:** 선택한 메뉴(탭)의 클리핑 목록을 표 형태로 조회, 검색, 페이지 이동. 행 클릭 시 상세 모달.

**Layout (전체 컨테이너):**
- 페이지 배경 `#eceae3`, 상하 패딩 40px, 중앙 정렬
- 카드: `width: 1040px` (max-width:100%), 배경 `#fbfaf6`, `border-radius: 12px`
- 카드 그림자: `0 24px 60px -24px rgba(20,26,45,.35), 0 2px 8px rgba(0,0,0,.06)`
- 내부 좌우 패딩 기준 `36px`

**컴포넌트:**

1. **헤더 (상단 브랜드 영역)** — 패딩 `28px 36px 0`, flex space-between, 하단 정렬
   - 좌: 오버라인 `IR CLIPPING` (IBM Plex Mono, 600, 10px, letter-spacing .28em, `#9a7b46`)
     + 제목 `공시 · 규제 클리핑` (Noto Serif KR, 600, 24px, `#1a2338`, letter-spacing -.01em)
   - 우: `최근 수집` 라벨(Pretendard 500, 11.5px, `#8a8f99`) + 값 `2026.07.22 09:12`(600, `#3a4150`, block)

2. **탭 (메뉴 전환)** — 패딩 `22px 36px 0`, 하단 보더 `1px solid #e6e2d7`, gap 2px
   - 각 탭: 패딩 `12px 20px 14px`, Pretendard 600 14px
   - 활성: 글자 `#1a2338`, 하단 보더 `2px solid #9a7b46`
   - 비활성: 글자 `#a0a4ad`, 하단 보더 transparent
   - 탭 우측 상단 카운트(superscript): IBM Plex Mono 600 10px, 활성 `#c2a86e` / 비활성 `#cbcdd3`, margin-left 7px
   - 탭 목록: `공시법규 규정`(count 8예시), `FnGuide`(count 5예시)

3. **툴바** — 패딩 `18px 36px 14px`, flex space-between
   - 좌: `검색결과 N건 · <활성탭명>` (Pretendard 500 12px `#8a8f99`, 숫자·탭명 강조 `#1a2338`)
   - 우: 검색 인풋. 배경 `#fff`, 보더 `1px solid #e6e2d7`, radius 7px, width 240px,
     좌측 ⌕ 아이콘(`#b3b7c0`), placeholder "제목 · 담당부서 검색", 입력 시 실시간 필터

4. **테이블 헤더** — grid `52px 1fr 130px 96px 68px`, 상단 보더 `1px solid #1a2338`,
   하단 보더 `1px solid #e6e2d7`. 각 셀: Pretendard 600 10.5px letter-spacing .06em `#8a8f99`,
   패딩 11px 0. 컬럼: `No / 제목 / 담당부서 / 등록일 / 첨부(우측정렬)`

5. **테이블 행 (반복)** — 동일 grid, 좌우 패딩 36px, 하단 보더 `1px solid #efece3`,
   `cursor:pointer`, hover 배경 `#f4f1e8` (권장; 목업은 정적 `#fbfaf6`)
   - No: IBM Plex Mono 500 12px `#b3b7c0`, 두 자리 0-패딩 (예 "08")
   - 제목 셀: 패딩 16px 0, 세로 flex gap 5px
     - 제목: Pretendard 500 14.5px/1.35 `#20242c` letter-spacing -.01em
     - NEW 배지(최신 2건): 제목 옆 inline, IBM Plex Mono 700 9px `#b23b3b`, margin-left 7px
     - 출처(src): Pretendard 500 11px `#9a7b46` (예 "금융감독원")
   - 담당부서: Pretendard 500 12px `#4a5160`
   - 등록일: IBM Plex Mono 500 12.5px `#6a7180` (형식 `YYYY.MM.DD`)
   - 첨부: 우측정렬, IBM Plex Mono 600 12px. 파일 있으면 `📎 N` (`#8a8f99`), 없으면 `—` (`#cfd2d8`)
   - 빈 결과: "검색 결과가 없습니다." (패딩 56px, 중앙, Pretendard 500 13px `#a0a4ad`)

6. **페이지네이션** — 패딩 24px, 중앙 flex gap 5px. 각 버튼 30×30, radius 6px,
   IBM Plex Mono 600 12px. 활성 페이지 배경 `#1a2338` 글자 `#fff`, 비활성 글자 `#8a8f99`.
   `‹` `1` `2` … `›`. 페이지당 **6건**.

### 2. 글 상세 모달 (Detail Modal)
행 클릭 시 표시.
- 오버레이: `position:fixed; inset:0; background:rgba(20,26,45,.4); backdrop-filter:blur(3px)`,
  중앙 정렬, z-index 50. 오버레이 클릭 시 닫힘, 내부 클릭은 stopPropagation.
- 패널: width 640px, 배경 `#fbfaf6`, radius 12px, 그림자 `0 30px 70px -20px rgba(20,26,45,.5)`
- 헤더(패딩 26px 32px, 하단 보더 `1px solid #e6e2d7`):
  - 출처+탭명 라인: Pretendard 600 11px `#9a7b46`, 구분점 `#cfc9bd`, 탭명 `#8a8f99` 500
  - 제목: Noto Serif KR 600 20px/1.4 `#1a2338`, text-wrap:pretty
  - 메타: gap 20px, Pretendard 500 12px `#6a7180`, 값 `#3a4150` 600 (등록일은 IBM Plex Mono)
    — `담당부서 <부서>`, `등록일 <YYYY.MM.DD>`
- 본문(패딩 26px 32px): Pretendard 400 13.5px/1.8 `#3a4150`
- 첨부 영역(패딩 0 32px 28px):
  - 라벨 "첨부파일" Pretendard 600 10.5px letter-spacing .06em `#8a8f99`
  - 파일 행(반복): flex, 패딩 11px 14px, 배경 `#fff`, 보더 `1px solid #e6e2d7`, radius 8px, margin-bottom 8px
    - 📎 아이콘 / 파일명(Pretendard 500 13px `#20242c`, flex:1) / 크기(IBM Plex Mono 500 11px `#9aa0ab`) / "다운로드"(Pretendard 600 11.5px `#9a7b46`)
  - 첨부 없으면 "첨부파일 없음" (Pretendard 500 12.5px `#a0a4ad`)

> 참고: `IR Clipping Concepts.dc.html`에는 채택되지 않은 대안 컨셉 2종(에디토리얼, 다크 터미널)이
> 함께 들어 있습니다. 구현 대상은 위 1a(Ledger) 방향인 `IR Clipping Board.dc.html`입니다.

## Interactions & Behavior
- **탭 전환**: 클릭 시 해당 메뉴의 데이터로 교체, 페이지 0으로 리셋, 검색어 초기화.
- **검색**: 입력 즉시(onInput) 필터. 대상 필드 = 제목 + 담당부서 + 출처, 대소문자 무시, 부분일치. 검색 시 페이지 0으로.
- **페이지네이션**: 클릭한 페이지로 이동, `‹`/`›`는 이전/다음(범위 클램프).
- **행 클릭**: 상세 모달 오픈.
- **모달 닫기**: 오버레이 클릭 또는 (구현 시) ESC.
- 정적 목업에는 hover 트랜지션이 최소화돼 있으나, 행 hover 배경 `#f4f1e8`, 트랜지션 `background .15s` 권장.

## State Management
- `activeTab` (0=공시법규 규정, 1=FnGuide)
- `query` (검색어)
- `page` (0-index 현재 페이지)
- `detailId` (열린 글 id, 없으면 null)
- 데이터 페칭: 메뉴별 목록을 DB/API에서 조회. 목업은 하드코딩. 실제로는
  `GET /clippings?category=<disclosure|fnguide>&q=<검색어>&page=<n>&size=6` 형태 권장.
  각 아이템 필드: `id, category, title, source(출처), department(담당부서), collectedAt(수집일), body, files[]`
  파일: `{ name, size, url }`. NEW 배지는 최신순 상위 2건 또는 최근 N일 기준으로 판단.

## Design Tokens

**Colors**
- 페이지 배경: `#eceae3`
- 카드/패널 배경: `#fbfaf6`
- 인풋/파일칩 배경: `#fff`
- 잉크(제목 진함): `#1a2338`
- 본문 텍스트: `#20242c` / `#3a4150`
- 보조 텍스트: `#6a7180` / `#8a8f99` / `#a0a4ad`
- 연한 텍스트/비활성: `#b3b7c0` / `#cbcdd3` / `#cfd2d8` / `#cfc9bd`
- 액센트(골드): `#9a7b46` / `#c2a86e`
- NEW 배지(레드): `#b23b3b`
- 부서 텍스트: `#4a5160`
- 보더: `#e6e2d7` (연함), `#efece3` (행 구분), `#1a2338` (테이블 상단 강조선)

**Typography**
- 본문/UI: **Pretendard** (CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css`)
- 디스플레이/제목: **Noto Serif KR** (Google Fonts, 400–700)
- 숫자/날짜/코드: **IBM Plex Mono** (Google Fonts, 400–600)
- 크기: 제목 24px, 상세 제목 20px, 행 제목 14.5px, 본문 13.5px/1.8, 라벨 10.5px, 오버라인 10px

**Radius**: 카드 12px, 인풋/버튼 7px, 파일칩·페이지버튼 6–8px
**Grid columns (테이블)**: `52px 1fr 130px 96px 68px`
**Container width**: 1040px (목록), 640px (상세 모달)
**Shadows**:
- 카드: `0 24px 60px -24px rgba(20,26,45,.35), 0 2px 8px rgba(0,0,0,.06)`
- 모달: `0 30px 70px -20px rgba(20,26,45,.5)`

## Assets
- 별도 이미지 없음. 아이콘은 이모지 placeholder(⌕ 검색, 📎 첨부)로 표현 — 구현 시 코드베이스의
  아이콘 세트(예: Lucide, Material Symbols)로 교체 권장.
- 폰트는 위 CDN 사용 또는 자체 호스팅.

## Files
- `IR Clipping Board.dc.html` — **구현 대상** (채택안 1a: Ledger). 목록 + 탭 + 검색 + 페이지네이션 + 상세 모달.
- `IR Clipping Concepts.dc.html` — 초기 3개 컨셉 비교(1a Ledger / 1b 에디토리얼 / 1c 다크 터미널). 참고용.
