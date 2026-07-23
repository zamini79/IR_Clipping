# IR 클리핑 게시판 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공시법규 규정 / FnGuide 두 메뉴의 클리핑을 Supabase에서 읽어 목록·검색·페이지네이션·상세 모달로 보여주는 공개 읽기 전용 게시판을 배포 가능한 상태로 만든다.

**Architecture:** Next.js App Router 서버 컴포넌트가 Supabase에서 두 카테고리 데이터를 모두 조회해 클라이언트 `Board` 컴포넌트로 전달한다. 탭 전환·검색·페이지네이션·상세 모달은 인메모리로 처리하며(데이터가 작아 원본 목업 동작을 1:1 재현), 핵심 변환 로직은 순수 함수 `buildBoardView`로 분리해 단위 테스트한다. 색상·타이포는 목업의 인라인 스타일을 그대로 이식한다.

**Tech Stack:** Next.js (App Router, TypeScript), Supabase (`@supabase/supabase-js`), Tailwind CSS(스캐폴딩용), Vitest + React Testing Library(테스트), Vercel(배포).

## Global Constraints

- 인증 없음. 클라이언트는 anon 키만 사용. 서비스 롤 키를 클라이언트 번들에 넣지 않는다.
- 페이지당 **6건**.
- 카테고리 값: `disclosure`(공시법규 규정), `fnguide`(FnGuide). UI 라벨과 매핑 고정.
- 검색 대상: `title` + `department` + `source`, 대소문자 무시, 부분일치.
- 탭 전환 시 `page=0`, `query=""`로 리셋.
- NEW 배지: 각 카테고리 최신순(collected_at desc) 상위 2건.
- No: 카테고리 내 역순 인덱스를 두 자리 0패딩(최신=가장 큰 번호).
- 날짜 표시 형식: `YYYY.MM.DD`.
- 디자인 토큰 값은 `README.md`, 레이아웃/스타일은 `IR Clipping Board.dc.html` 기준으로 픽셀 단위 재현.
- 데이터는 `collected_at desc`로 정렬된 상태를 전제로 UI 로직을 작성한다.
- Node 18+ / npm 사용. 모든 명령은 프로젝트 루트에서 실행.

---

### Task 1: Next.js 스캐폴딩 · 폰트 · 기본 레이아웃

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (create-next-app 생성)
- Modify: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`

**Interfaces:**
- Produces: 실행 가능한 Next.js 앱 뼈대. 이후 Task들이 `app/`, `components/`, `lib/`에 파일을 추가한다.

- [ ] **Step 1: create-next-app으로 스캐폴딩**

기존 파일(README.md, docs 등)이 있으므로 임시 디렉터리에 생성 후 병합한다.

Run:
```bash
npx create-next-app@latest .app-scaffold --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
cp -r .app-scaffold/. .
rm -rf .app-scaffold
rm -f app/favicon.ico public/*.svg 2>/dev/null || true
```
Expected: 루트에 `package.json`, `app/`, `next.config.ts`, `tsconfig.json` 생성. 기존 README/docs 유지.

- [ ] **Step 2: 폰트 링크를 레이아웃에 추가**

`app/layout.tsx`를 아래로 교체(목업과 동일한 CDN 폰트):

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IR 클리핑 게시판",
  description: "공시 · 규제 클리핑 및 FnGuide 리서치 클리핑 보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: globals.css를 목업 기본 스타일로 교체**

`app/globals.css` 전체를 아래로 교체:

```css
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#eceae3;font-family:"Pretendard",system-ui,sans-serif}
a{color:inherit;text-decoration:none}
```

- [ ] **Step 4: 임시 홈 화면으로 교체**

`app/page.tsx` 전체를 아래로 교체(placeholder, Task 7에서 실제 Board로 대체):

```tsx
export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <span style={{ font: "500 13px 'Pretendard'", color: "#a0a4ad" }}>IR 클리핑 게시판 — 준비 중</span>
    </div>
  );
}
```

- [ ] **Step 5: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공(에러 0). 경고는 허용.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app with design fonts and base styles"
```

---

### Task 2: 도메인 타입 · 표시 헬퍼 (TDD)

**Files:**
- Create: `lib/types.ts`
- Create: `lib/format.ts`
- Test: `lib/format.test.ts`
- Modify: `package.json`(vitest 스크립트), Create: `vitest.config.ts`

**Interfaces:**
- Produces:
  - `type Category = "disclosure" | "fnguide"`
  - `interface ClippingFile { id: string; name: string; size: string; storagePath: string }`
  - `interface Clipping { id: string; category: Category; title: string; source: string; department: string; body: string; collectedAt: string; createdAt: string; files: ClippingFile[] }`
  - `formatDate(iso: string): string` → `"YYYY.MM.DD"`
  - `padNo(n: number): string` → 2자리 0패딩
  - `attachmentLabel(count: number): string` → `"📎 N"` 또는 `"—"`

- [ ] **Step 1: Vitest 설치 및 설정**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
```

Run: `npm install -D @vitejs/plugin-react`

Create `vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `lib/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatDate, padNo, attachmentLabel } from "./format";

describe("formatDate", () => {
  it("converts ISO date to YYYY.MM.DD", () => {
    expect(formatDate("2026-07-21T00:00:00.000Z")).toBe("2026.07.21");
  });
  it("zero-pads month and day", () => {
    expect(formatDate("2026-01-05T00:00:00.000Z")).toBe("2026.01.05");
  });
});

describe("padNo", () => {
  it("pads single digit to two digits", () => {
    expect(padNo(8)).toBe("08");
  });
  it("leaves two-digit numbers unchanged", () => {
    expect(padNo(12)).toBe("12");
  });
});

describe("attachmentLabel", () => {
  it("shows paperclip with count when files exist", () => {
    expect(attachmentLabel(3)).toBe("📎 3");
  });
  it("shows em dash when no files", () => {
    expect(attachmentLabel(0)).toBe("—");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- lib/format.test.ts`
Expected: FAIL (`Cannot find module './format'`).

- [ ] **Step 4: 타입과 헬퍼 구현**

Create `lib/types.ts`:
```ts
export type Category = "disclosure" | "fnguide";

export interface ClippingFile {
  id: string;
  name: string;
  size: string;
  storagePath: string;
}

export interface Clipping {
  id: string;
  category: Category;
  title: string;
  source: string;
  department: string;
  body: string;
  collectedAt: string; // ISO string
  createdAt: string; // ISO string
  files: ClippingFile[];
}
```

Create `lib/format.ts`:
```ts
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function padNo(n: number): string {
  return String(n).padStart(2, "0");
}

export function attachmentLabel(count: number): string {
  return count > 0 ? `📎 ${count}` : "—";
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- lib/format.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add domain types and display helpers with tests"
```

---

### Task 3: buildBoardView 순수 로직 (TDD) — 핵심

**Files:**
- Create: `lib/board-view.ts`
- Test: `lib/board-view.test.ts`

**Interfaces:**
- Consumes: `Clipping` (Task 2), `formatDate`/`padNo`/`attachmentLabel` (Task 2).
- Produces:
  - `interface BoardRow { id: string; no: string; title: string; source: string; department: string; date: string; attachmentLabel: string; hasAttachment: boolean; isNew: boolean }`
  - `interface BoardView { rows: BoardRow[]; total: number; pageCount: number; page: number }`
  - `const PER_PAGE = 6`
  - `buildBoardView(items: Clipping[], opts: { query: string; page: number }): BoardView`
  - 전제: `items`는 `collected_at desc`(최신 우선)로 정렬되어 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/board-view.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildBoardView, PER_PAGE } from "./board-view";
import type { Clipping } from "./types";

function make(n: number): Clipping[] {
  // newest first; item[0] is newest
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    category: "disclosure" as const,
    title: `제목 ${i}`,
    source: i === 0 ? "금융감독원" : "한국거래소",
    department: i === 1 ? "IR기획팀" : "공시제도팀",
    body: "본문",
    collectedAt: "2026-07-21T00:00:00.000Z",
    createdAt: "2026-07-21T00:00:00.000Z",
    files: i % 2 === 0 ? [{ id: `f-${i}`, name: "a.pdf", size: "1MB", storagePath: "p" }] : [],
  }));
}

describe("buildBoardView", () => {
  it("numbers rows descending, zero-padded (newest gets highest No)", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows[0].no).toBe("08");
    expect(v.rows[5].no).toBe("03");
  });

  it("marks the two newest items as NEW", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows[0].isNew).toBe(true);
    expect(v.rows[1].isNew).toBe(true);
    expect(v.rows[2].isNew).toBe(false);
  });

  it("paginates to PER_PAGE items per page", () => {
    const v = buildBoardView(make(8), { query: "", page: 0 });
    expect(v.rows).toHaveLength(PER_PAGE);
    expect(v.total).toBe(8);
    expect(v.pageCount).toBe(2);
  });

  it("returns the second page slice", () => {
    const v = buildBoardView(make(8), { query: "", page: 1 });
    expect(v.rows).toHaveLength(2);
    expect(v.rows[0].no).toBe("02");
  });

  it("clamps page above range to last page", () => {
    const v = buildBoardView(make(8), { query: "", page: 99 });
    expect(v.page).toBe(1);
    expect(v.rows).toHaveLength(2);
  });

  it("filters by title, department, and source case-insensitively", () => {
    const v = buildBoardView(make(8), { query: "ir기획", page: 0 });
    expect(v.total).toBe(1);
    expect(v.rows[0].department).toBe("IR기획팀");
  });

  it("keeps No/NEW based on full list even when filtered", () => {
    const v = buildBoardView(make(8), { query: "금융감독원", page: 0 });
    expect(v.total).toBe(1);
    expect(v.rows[0].no).toBe("08");
    expect(v.rows[0].isNew).toBe(true);
  });

  it("sets attachment label and hasAttachment", () => {
    const v = buildBoardView(make(2), { query: "", page: 0 });
    expect(v.rows[0].attachmentLabel).toBe("📎 1");
    expect(v.rows[0].hasAttachment).toBe(true);
    expect(v.rows[1].attachmentLabel).toBe("—");
    expect(v.rows[1].hasAttachment).toBe(false);
  });

  it("reports pageCount 1 and empty rows for no matches", () => {
    const v = buildBoardView(make(8), { query: "존재하지않는검색어", page: 0 });
    expect(v.total).toBe(0);
    expect(v.pageCount).toBe(1);
    expect(v.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- lib/board-view.test.ts`
Expected: FAIL (`Cannot find module './board-view'`).

- [ ] **Step 3: buildBoardView 구현**

Create `lib/board-view.ts`:
```ts
import type { Clipping } from "./types";
import { formatDate, padNo, attachmentLabel } from "./format";

export const PER_PAGE = 6;

export interface BoardRow {
  id: string;
  no: string;
  title: string;
  source: string;
  department: string;
  date: string;
  attachmentLabel: string;
  hasAttachment: boolean;
  isNew: boolean;
}

export interface BoardView {
  rows: BoardRow[];
  total: number;
  pageCount: number;
  page: number;
}

export function buildBoardView(
  items: Clipping[],
  opts: { query: string; page: number }
): BoardView {
  const q = opts.query.trim().toLowerCase();
  const total = items.length;

  // Precompute No and NEW against the FULL list (index 0 = newest).
  const decorated = items.map((it, index) => ({
    it,
    no: padNo(total - index),
    isNew: index < 2,
  }));

  const filtered = decorated.filter(({ it }) => {
    if (!q) return true;
    return (
      it.title.toLowerCase().includes(q) ||
      it.department.toLowerCase().includes(q) ||
      (it.source ?? "").toLowerCase().includes(q)
    );
  });

  const matchTotal = filtered.length;
  const pageCount = Math.max(1, Math.ceil(matchTotal / PER_PAGE));
  const page = Math.min(Math.max(0, opts.page), pageCount - 1);
  const start = page * PER_PAGE;
  const slice = filtered.slice(start, start + PER_PAGE);

  const rows: BoardRow[] = slice.map(({ it, no, isNew }) => ({
    id: it.id,
    no,
    title: it.title,
    source: it.source,
    department: it.department,
    date: formatDate(it.collectedAt),
    attachmentLabel: attachmentLabel(it.files.length),
    hasAttachment: it.files.length > 0,
    isNew,
  }));

  return { rows, total: matchTotal, pageCount, page };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/board-view.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add buildBoardView pure logic for filter/paginate/No/NEW"
```

---

### Task 4: Supabase 스키마 · 클라이언트 · 데이터 접근 (TDD)

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `lib/supabase.ts`
- Create: `lib/data.ts`
- Test: `lib/data.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: `Clipping`, `Category` (Task 2).
- Produces:
  - `mapRowToClipping(row: ClippingRow): Clipping` — DB row → 도메인 객체 매핑(순수).
  - `interface ClippingRow` — Supabase 조회 결과 형태.
  - `getBoardData(): Promise<Record<Category, Clipping[]>>` — 두 카테고리 전체를 `collected_at desc`로 조회.

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `supabase/migrations/0001_init.sql`:
```sql
create extension if not exists "pgcrypto";

create table if not exists clippings (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('disclosure','fnguide')),
  title text not null,
  source text not null default '',
  department text not null default '',
  body text not null default '',
  collected_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists clippings_category_collected_at_idx
  on clippings (category, collected_at desc);

create table if not exists clipping_files (
  id uuid primary key default gen_random_uuid(),
  clipping_id uuid not null references clippings(id) on delete cascade,
  name text not null,
  size text not null default '',
  storage_path text not null default ''
);

create index if not exists clipping_files_clipping_id_idx
  on clipping_files (clipping_id);

-- Public read-only access
alter table clippings enable row level security;
alter table clipping_files enable row level security;

create policy "public read clippings" on clippings
  for select using (true);
create policy "public read clipping_files" on clipping_files
  for select using (true);
```

- [ ] **Step 2: 환경변수 예시 작성**

Create `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# 서버 전용(시드/Phase 2 크롤러). 클라이언트에 노출 금지.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Supabase 클라이언트 팩토리**

Run: `npm install @supabase/supabase-js`

Create `lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key);
}
```

- [ ] **Step 4: 실패하는 매핑 테스트 작성**

Create `lib/data.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapRowToClipping } from "./data";

describe("mapRowToClipping", () => {
  it("maps a DB row with files to a Clipping", () => {
    const row = {
      id: "c1",
      category: "disclosure",
      title: "제목",
      source: "금융감독원",
      department: "공시제도팀",
      body: "본문",
      collected_at: "2026-07-21T00:00:00.000Z",
      created_at: "2026-07-21T01:00:00.000Z",
      clipping_files: [
        { id: "f1", name: "a.pdf", size: "1.8MB", storage_path: "clipping-files/a.pdf" },
      ],
    };
    const c = mapRowToClipping(row);
    expect(c).toEqual({
      id: "c1",
      category: "disclosure",
      title: "제목",
      source: "금융감독원",
      department: "공시제도팀",
      body: "본문",
      collectedAt: "2026-07-21T00:00:00.000Z",
      createdAt: "2026-07-21T01:00:00.000Z",
      files: [{ id: "f1", name: "a.pdf", size: "1.8MB", storagePath: "clipping-files/a.pdf" }],
    });
  });

  it("defaults files to an empty array when missing", () => {
    const row = {
      id: "c2",
      category: "fnguide",
      title: "t",
      source: "FnGuide",
      department: "IR기획팀",
      body: "b",
      collected_at: "2026-07-05T00:00:00.000Z",
      created_at: "2026-07-05T00:00:00.000Z",
      clipping_files: null,
    };
    expect(mapRowToClipping(row).files).toEqual([]);
  });
});
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `npm test -- lib/data.test.ts`
Expected: FAIL (`Cannot find module './data'`).

- [ ] **Step 6: 데이터 접근 구현**

Create `lib/data.ts`:
```ts
import type { Category, Clipping } from "./types";
import { createPublicClient } from "./supabase";

export interface ClippingFileRow {
  id: string;
  name: string;
  size: string;
  storage_path: string;
}

export interface ClippingRow {
  id: string;
  category: string;
  title: string;
  source: string;
  department: string;
  body: string;
  collected_at: string;
  created_at: string;
  clipping_files: ClippingFileRow[] | null;
}

export function mapRowToClipping(row: ClippingRow): Clipping {
  return {
    id: row.id,
    category: row.category as Category,
    title: row.title,
    source: row.source,
    department: row.department,
    body: row.body,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
    files: (row.clipping_files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      storagePath: f.storage_path,
    })),
  };
}

export async function getBoardData(): Promise<Record<Category, Clipping[]>> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("clippings")
    .select("*, clipping_files(*)")
    .order("collected_at", { ascending: false });

  if (error) throw new Error(`Failed to load clippings: ${error.message}`);

  const all = (data as ClippingRow[]).map(mapRowToClipping);
  return {
    disclosure: all.filter((c) => c.category === "disclosure"),
    fnguide: all.filter((c) => c.category === "fnguide"),
  };
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test -- lib/data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Supabase schema, client, and data-access layer"
```

---

### Task 5: 시드 데이터 · 시드 스크립트

**Files:**
- Create: `lib/seed-data.ts`
- Create: `scripts/seed.ts`
- Modify: `package.json`(seed 스크립트)

**Interfaces:**
- Consumes: `Category` (Task 2), 마이그레이션된 테이블 (Task 4).
- Produces: `SEED_CLIPPINGS` 배열, `npm run seed` 명령.

- [ ] **Step 1: 시드 데이터 작성**

`README.md` / 목업 `data()`의 샘플 13건(공시법규 규정 8, FnGuide 5)을 옮긴다. Create `lib/seed-data.ts`:
```ts
import type { Category } from "./types";

export interface SeedClipping {
  category: Category;
  title: string;
  source: string;
  department: string;
  collectedAt: string; // ISO
  body: string;
  files: { name: string; size: string }[];
}

export const SEED_CLIPPINGS: SeedClipping[] = [
  // 공시법규 규정 (disclosure) — newest first
  { category: "disclosure", title: "2026년 사업보고서 기재요령 개정 안내", source: "금융감독원", department: "공시제도팀", collectedAt: "2026-07-21T00:00:00.000Z",
    body: "금융감독원이 2026년 사업보고서 기재요령을 개정·공지했습니다. 주요 개정 사항과 적용 시점, 실무 체크포인트를 정리한 자료입니다.",
    files: [{ name: "사업보고서_기재요령_개정.pdf", size: "1.8MB" }, { name: "신구조문대비표.xlsx", size: "320KB" }] },
  { category: "disclosure", title: "ESG 지속가능경영보고서 공시 의무화 단계별 일정", source: "한국거래소", department: "IR기획팀", collectedAt: "2026-07-18T00:00:00.000Z",
    body: "자산규모별 ESG 공시 의무화 도입 일정과 준비 사항을 단계별로 안내합니다.",
    files: [{ name: "ESG공시_로드맵.pdf", size: "2.4MB" }] },
  { category: "disclosure", title: "주요사항보고서 제출기한 관련 실무 유의사항", source: "금융위원회", department: "공시제도팀", collectedAt: "2026-07-15T00:00:00.000Z",
    body: "주요사항보고서 제출기한 산정 및 지연 시 제재 관련 유의사항입니다.",
    files: [{ name: "주요사항보고서_유의사항.pdf", size: "960KB" }, { name: "제출_체크리스트.docx", size: "180KB" }, { name: "FAQ.pdf", size: "540KB" }] },
  { category: "disclosure", title: "내부정보 관리규정 개정 — 자기주식 취득 신고 절차", source: "내부 규정", department: "준법지원팀", collectedAt: "2026-07-11T00:00:00.000Z",
    body: "자기주식 취득·처분 시 내부 신고 절차가 강화되었습니다. 변경된 승인 라인을 확인하세요.",
    files: [{ name: "내부정보관리규정_개정본.pdf", size: "720KB" }] },
  { category: "disclosure", title: "공정공시 대상 확대 관련 실무 가이드라인", source: "한국거래소", department: "공시제도팀", collectedAt: "2026-07-08T00:00:00.000Z",
    body: "공정공시 적용 대상 확대에 따른 실무 대응 가이드라인입니다.",
    files: [{ name: "공정공시_가이드.pdf", size: "1.1MB" }, { name: "사례집.pdf", size: "2.0MB" }] },
  { category: "disclosure", title: "분기보고서 XBRL 재무제표 작성 매뉴얼 (v3.2)", source: "재무회계팀", department: "재무회계팀", collectedAt: "2026-07-03T00:00:00.000Z",
    body: "XBRL 재무제표 작성 매뉴얼 v3.2 버전입니다.", files: [] },
  { category: "disclosure", title: "임원·주요주주 소유상황보고 제출 안내", source: "금융감독원", department: "준법지원팀", collectedAt: "2026-06-27T00:00:00.000Z",
    body: "임원 및 주요주주 특정증권등 소유상황보고서 제출 관련 안내입니다.",
    files: [{ name: "소유상황보고_안내.pdf", size: "640KB" }] },
  { category: "disclosure", title: "연결재무제표 주석 공시 강화 방안", source: "금융위원회", department: "재무회계팀", collectedAt: "2026-06-20T00:00:00.000Z",
    body: "연결재무제표 주석 공시 항목이 확대됩니다.",
    files: [{ name: "주석공시_강화방안.pdf", size: "880KB" }] },
  // FnGuide (fnguide) — newest first
  { category: "fnguide", title: "2Q26 실적 컨센서스 프리뷰 — 반도체 섹터", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-22T00:00:00.000Z",
    body: "FnGuide 컨센서스 기준 2분기 실적 전망과 당사 가이던스 비교 자료입니다.",
    files: [{ name: "2Q26_컨센서스_프리뷰.pdf", size: "1.5MB" }] },
  { category: "fnguide", title: "산업 동향 위클리 — 07월 3주차", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-19T00:00:00.000Z",
    body: "주요 산업 지표 및 경쟁사 동향 주간 리포트입니다.",
    files: [{ name: "산업동향_0719.pdf", size: "2.2MB" }] },
  { category: "fnguide", title: "당사 목표주가 컨센서스 변동 요약", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-16T00:00:00.000Z",
    body: "증권사별 목표주가 및 투자의견 변동 내역을 요약했습니다.",
    files: [{ name: "목표주가_컨센서스.xlsx", size: "260KB" }] },
  { category: "fnguide", title: "기관 수급 및 외국인 지분율 리포트", source: "FnGuide", department: "IR기획팀", collectedAt: "2026-07-12T00:00:00.000Z",
    body: "최근 기관/외국인 매매 동향과 지분율 추이 분석입니다.",
    files: [{ name: "수급리포트.pdf", size: "1.0MB" }] },
  { category: "fnguide", title: "경쟁사 실적 비교 데이터셋 (2Q26)", source: "FnGuide", department: "재무회계팀", collectedAt: "2026-07-05T00:00:00.000Z",
    body: "동종업계 경쟁사 실적 비교 데이터입니다.", files: [] },
];
```

- [ ] **Step 2: 시드 스크립트 작성**

Run: `npm install -D tsx dotenv`

Create `scripts/seed.ts`:
```ts
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { SEED_CLIPPINGS } from "../lib/seed-data";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Idempotent: clear then insert
  await supabase.from("clipping_files").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("clippings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  for (const c of SEED_CLIPPINGS) {
    const { data, error } = await supabase
      .from("clippings")
      .insert({
        category: c.category,
        title: c.title,
        source: c.source,
        department: c.department,
        body: c.body,
        collected_at: c.collectedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert clipping failed: ${error.message}`);

    if (c.files.length > 0) {
      const files = c.files.map((f) => ({
        clipping_id: data!.id,
        name: f.name,
        size: f.size,
        storage_path: "",
      }));
      const { error: fErr } = await supabase.from("clipping_files").insert(files);
      if (fErr) throw new Error(`insert files failed: ${fErr.message}`);
    }
  }
  console.log(`Seeded ${SEED_CLIPPINGS.length} clippings.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`package.json`의 `scripts`에 추가:
```json
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 3: (수동) Supabase 프로젝트 준비 및 마이그레이션 적용**

사람이 수행(자격증명 필요):
1. Supabase 프로젝트 생성.
2. SQL Editor에서 `supabase/migrations/0001_init.sql` 실행.
3. 프로젝트 URL/anon key/service_role key를 `.env.local`에 기입(`.env.example` 참고).

Run(자격증명 준비 후): `npm run seed`
Expected: `Seeded 13 clippings.`

> 자격증명이 아직 없으면 이 스텝은 보류하고 Task 6~7을 먼저 진행할 수 있다(컴포넌트 테스트는 인메모리 props 기반이라 DB 불필요). 배포 전 반드시 완료.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add seed data and idempotent seed script"
```

---

### Task 6: 프레젠테이션 컴포넌트 (BoardTable · SearchBar · Pagination · DetailModal)

목업 인라인 스타일을 그대로 이식한 props 기반 순수 컴포넌트. 상태 없음(부모가 주입).

**Files:**
- Create: `components/BoardTable.tsx`
- Create: `components/SearchBar.tsx`
- Create: `components/Pagination.tsx`
- Create: `components/DetailModal.tsx`
- Test: `components/Pagination.test.tsx`

**Interfaces:**
- Consumes: `BoardRow` (Task 3), `Clipping` (Task 2).
- Produces:
  - `BoardTable({ rows, onOpen }: { rows: BoardRow[]; onOpen: (id: string) => void })`
  - `SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void })`
  - `Pagination({ page, pageCount, onGo }: { page: number; pageCount: number; onGo: (p: number) => void })`
  - `DetailModal({ clipping, activeLabel, onClose }: { clipping: Clipping; activeLabel: string; onClose: () => void })`

- [ ] **Step 1: BoardTable 작성**

Create `components/BoardTable.tsx`:
```tsx
"use client";
import type { BoardRow } from "@/lib/board-view";

const GRID = "52px 1fr 130px 96px 68px";
const th = { padding: "11px 0", font: "600 10.5px/1 'Pretendard'", letterSpacing: ".06em", color: "#8a8f99" } as const;

export function BoardTable({ rows, onOpen }: { rows: BoardRow[]; onOpen: (id: string) => void }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", borderTop: "1px solid #1a2338", borderBottom: "1px solid #e6e2d7" }}>
        <span style={th}>No</span>
        <span style={th}>제목</span>
        <span style={th}>담당부서</span>
        <span style={th}>등록일</span>
        <span style={{ ...th, textAlign: "right" }}>첨부</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} onClick={() => onOpen(r.id)}
          style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 36px", alignItems: "center", borderBottom: "1px solid #efece3", cursor: "pointer", background: "#fbfaf6", transition: "background .15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f1e8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fbfaf6")}>
          <div style={{ font: "500 12px 'IBM Plex Mono'", color: "#b3b7c0" }}>{r.no}</div>
          <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <div style={{ font: "500 14.5px/1.35 'Pretendard'", color: "#20242c", letterSpacing: "-.01em" }}>
              {r.title}
              {r.isNew && <span style={{ display: "inline-block", marginLeft: 7, font: "700 9px/1 'IBM Plex Mono'", color: "#b23b3b", verticalAlign: "middle" }}>NEW</span>}
            </div>
            <div style={{ font: "500 11px 'Pretendard'", color: "#9a7b46" }}>{r.source}</div>
          </div>
          <div style={{ font: "500 12px 'Pretendard'", color: "#4a5160" }}>{r.department}</div>
          <div style={{ font: "500 12.5px 'IBM Plex Mono'", color: "#6a7180" }}>{r.date}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, font: "600 12px 'IBM Plex Mono'", color: r.hasAttachment ? "#8a8f99" : "#cfd2d8" }}>{r.attachmentLabel}</div>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ padding: 56, textAlign: "center", font: "500 13px 'Pretendard'", color: "#a0a4ad" }}>검색 결과가 없습니다.</div>
      )}
    </>
  );
}
```

- [ ] **Step 2: SearchBar 작성**

Create `components/SearchBar.tsx`:
```tsx
"use client";

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e6e2d7", borderRadius: 7, padding: "0 12px", width: 240 }}>
      <span style={{ color: "#b3b7c0", fontSize: 13 }}>⌕</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="제목 · 담당부서 검색"
        style={{ border: 0, outline: 0, background: "transparent", padding: "9px 0", width: "100%", font: "400 12.5px 'Pretendard'", color: "#20242c" }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Pagination 실패 테스트 작성**

Create `components/Pagination.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders one button per page plus prev/next", () => {
    render(<Pagination page={0} pageCount={2} onGo={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("‹")).toBeInTheDocument();
    expect(screen.getByText("›")).toBeInTheDocument();
  });

  it("calls onGo with the clicked page index", async () => {
    const onGo = vi.fn();
    render(<Pagination page={0} pageCount={2} onGo={onGo} />);
    await userEvent.click(screen.getByText("2"));
    expect(onGo).toHaveBeenCalledWith(1);
  });

  it("clamps next at the last page and prev at zero", async () => {
    const onGo = vi.fn();
    render(<Pagination page={1} pageCount={2} onGo={onGo} />);
    await userEvent.click(screen.getByText("›"));
    expect(onGo).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByText("‹"));
    expect(onGo).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npm test -- components/Pagination.test.tsx`
Expected: FAIL (`Cannot find module './Pagination'`).

- [ ] **Step 5: Pagination 구현**

Create `components/Pagination.tsx`:
```tsx
"use client";

function pgStyle(on: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 6,
    cursor: "pointer", font: "600 12px 'IBM Plex Mono'",
    ...(on ? { background: "#1a2338", color: "#fff" } : { color: "#8a8f99" }),
  };
}

export function Pagination({ page, pageCount, onGo }: { page: number; pageCount: number; onGo: (p: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: 24 }}>
      <div style={pgStyle(false)} onClick={() => onGo(Math.max(0, page - 1))}>‹</div>
      {Array.from({ length: pageCount }, (_, i) => (
        <div key={i} style={pgStyle(i === page)} onClick={() => onGo(i)}>{i + 1}</div>
      ))}
      <div style={pgStyle(false)} onClick={() => onGo(Math.min(pageCount - 1, page + 1))}>›</div>
    </div>
  );
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- components/Pagination.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: DetailModal 구현**

Create `components/DetailModal.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import type { Clipping } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function DetailModal({ clipping, activeLabel, onClose }: { clipping: Clipping; activeLabel: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,45,.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 640, maxWidth: "100%", background: "#fbfaf6", borderRadius: 12, boxShadow: "0 30px 70px -20px rgba(20,26,45,.5)", overflow: "hidden" }}>
        <div style={{ padding: "26px 32px", borderBottom: "1px solid #e6e2d7" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 11px 'Pretendard'", color: "#9a7b46" }}>
            {clipping.source}<span style={{ color: "#cfc9bd" }}>·</span>
            <span style={{ color: "#8a8f99", fontWeight: 500 }}>{activeLabel}</span>
          </div>
          <div style={{ marginTop: 9, font: "600 20px/1.4 'Noto Serif KR',serif", color: "#1a2338", letterSpacing: "-.01em", textWrap: "pretty" }}>{clipping.title}</div>
          <div style={{ marginTop: 14, display: "flex", gap: 20, font: "500 12px 'Pretendard'", color: "#6a7180" }}>
            <span>담당부서 <b style={{ color: "#3a4150", marginLeft: 4 }}>{clipping.department}</b></span>
            <span>등록일 <b style={{ color: "#3a4150", marginLeft: 4, fontFamily: "'IBM Plex Mono'" }}>{formatDate(clipping.collectedAt)}</b></span>
          </div>
        </div>
        <div style={{ padding: "26px 32px", font: "400 13.5px/1.8 'Pretendard'", color: "#3a4150" }}>{clipping.body}</div>
        <div style={{ padding: "0 32px 28px" }}>
          <div style={{ font: "600 10.5px 'Pretendard'", letterSpacing: ".06em", color: "#8a8f99", marginBottom: 10 }}>첨부파일</div>
          {clipping.files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "#fff", border: "1px solid #e6e2d7", borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 15 }}>📎</span>
              <span style={{ font: "500 13px 'Pretendard'", color: "#20242c", flex: 1 }}>{f.name}</span>
              <span style={{ font: "500 11px 'IBM Plex Mono'", color: "#9aa0ab" }}>{f.size}</span>
              <span style={{ font: "600 11.5px 'Pretendard'", color: "#9a7b46" }}>다운로드</span>
            </div>
          ))}
          {clipping.files.length === 0 && (
            <div style={{ font: "500 12.5px 'Pretendard'", color: "#a0a4ad" }}>첨부파일 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

> 참고: Phase 1 시드는 실제 파일이 없으므로 "다운로드"는 표시만 하고 동작하지 않는다. 실제 다운로드(Storage 서명 URL)는 Phase 2.

- [ ] **Step 8: 빌드/타입 검증 + Commit**

Run: `npm run build`
Expected: 빌드 성공.

```bash
git add -A
git commit -m "feat: add presentational board components (table, search, pagination, modal)"
```

---

### Task 7: Board 컨테이너 · page.tsx 통합 · 상호작용 테스트

**Files:**
- Create: `components/Board.tsx`
- Test: `components/Board.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getBoardData` (Task 4), `buildBoardView` (Task 3), Task 6 컴포넌트들, `Clipping`/`Category` (Task 2).
- Produces:
  - `Board({ data, updated }: { data: Record<Category, Clipping[]>; updated: string })` — 탭/검색/페이지/모달 상태를 인메모리로 관리.

- [ ] **Step 1: 실패하는 상호작용 테스트 작성**

Create `components/Board.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Board } from "./Board";
import type { Category, Clipping } from "@/lib/types";

function clip(cat: Category, i: number, extra: Partial<Clipping> = {}): Clipping {
  return { id: `${cat}-${i}`, category: cat, title: `${cat} 제목 ${i}`, source: "출처",
    department: "공시제도팀", body: "본문", collectedAt: "2026-07-21T00:00:00.000Z",
    createdAt: "2026-07-21T00:00:00.000Z", files: [], ...extra };
}

const data = {
  disclosure: Array.from({ length: 8 }, (_, i) => clip("disclosure", i)),
  fnguide: [clip("fnguide", 0, { title: "FnGuide 리포트", department: "IR기획팀" })],
} as Record<Category, Clipping[]>;

describe("Board", () => {
  it("shows the active tab count and paginates at 6 per page", () => {
    render(<Board data={data} updated="2026.07.22 09:12" />);
    expect(screen.getByText(/검색결과/)).toHaveTextContent("8건");
    // 6 rows on first page
    expect(screen.getByText("disclosure 제목 0")).toBeInTheDocument();
    expect(screen.queryByText("disclosure 제목 7")).not.toBeInTheDocument();
  });

  it("switching tab resets page and query, and swaps data", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.type(screen.getByPlaceholderText("제목 · 담당부서 검색"), "리포트");
    await userEvent.click(screen.getByText("FnGuide"));
    expect(screen.getByText("FnGuide 리포트")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("제목 · 담당부서 검색")).toHaveValue("");
  });

  it("filters rows by search query", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.type(screen.getByPlaceholderText("제목 · 담당부서 검색"), "제목 3");
    expect(screen.getByText("disclosure 제목 3")).toBeInTheDocument();
    expect(screen.queryByText("disclosure 제목 0")).not.toBeInTheDocument();
  });

  it("opens and closes the detail modal on row click", async () => {
    render(<Board data={data} updated="x" />);
    await userEvent.click(screen.getByText("disclosure 제목 0"));
    const dialog = screen.getByText("첨부파일").closest("div")!;
    expect(within(dialog).getByText("첨부파일 없음")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- components/Board.test.tsx`
Expected: FAIL (`Cannot find module './Board'`).

- [ ] **Step 3: Board 컨테이너 구현**

Create `components/Board.tsx`:
```tsx
"use client";
import { useMemo, useState } from "react";
import type { Category, Clipping } from "@/lib/types";
import { buildBoardView } from "@/lib/board-view";
import { BoardTable } from "./BoardTable";
import { SearchBar } from "./SearchBar";
import { Pagination } from "./Pagination";
import { DetailModal } from "./DetailModal";

const TABS: { key: Category; label: string }[] = [
  { key: "disclosure", label: "공시법규 규정" },
  { key: "fnguide", label: "FnGuide" },
];

export function Board({ data, updated }: { data: Record<Category, Clipping[]>; updated: string }) {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeKey = TABS[tab].key;
  const items = data[activeKey];
  const view = useMemo(() => buildBoardView(items, { query, page }), [items, query, page]);
  const detail = detailId ? items.find((c) => c.id === detailId) ?? null : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "40px 20px", background: "#eceae3" }}>
      <div style={{ width: 1040, maxWidth: "100%", background: "#fbfaf6", borderRadius: 12, boxShadow: "0 24px 60px -24px rgba(20,26,45,.35),0 2px 8px rgba(0,0,0,.06)", overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "28px 36px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ font: "600 10px/1 'IBM Plex Mono',monospace", letterSpacing: ".28em", color: "#9a7b46" }}>IR CLIPPING</div>
            <div style={{ font: "600 24px/1 'Noto Serif KR',serif", color: "#1a2338", letterSpacing: "-.01em" }}>공시 · 규제 클리핑</div>
          </div>
          <div style={{ font: "500 11.5px/1.5 'Pretendard'", color: "#8a8f99", textAlign: "right" }}>
            최근 수집<b style={{ display: "block", color: "#3a4150", fontWeight: 600 }}>{updated}</b>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 2, padding: "22px 36px 0", borderBottom: "1px solid #e6e2d7" }}>
          {TABS.map((t, i) => (
            <div key={t.key} onClick={() => { setTab(i); setPage(0); setQuery(""); setDetailId(null); }}
              style={{ padding: "12px 20px 14px", font: "600 14px/1 'Pretendard'", cursor: "pointer", borderBottom: `2px solid ${i === tab ? "#9a7b46" : "transparent"}`, color: i === tab ? "#1a2338" : "#a0a4ad" }}>
              {t.label}
              <span style={{ font: "600 10px 'IBM Plex Mono'", color: i === tab ? "#c2a86e" : "#cbcdd3", marginLeft: 7, verticalAlign: "super" }}>{data[t.key].length}</span>
            </div>
          ))}
        </div>

        {/* bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px 14px" }}>
          <div style={{ font: "500 12px 'Pretendard'", color: "#8a8f99" }}>
            검색결과 <b style={{ color: "#1a2338", fontWeight: 600 }}>{view.total}건</b> · <b style={{ color: "#1a2338", fontWeight: 600 }}>{TABS[tab].label}</b>
          </div>
          <SearchBar value={query} onChange={(v) => { setQuery(v); setPage(0); }} />
        </div>

        {/* table */}
        <BoardTable rows={view.rows} onOpen={(id) => setDetailId(id)} />

        {/* pagination */}
        <Pagination page={view.page} pageCount={view.pageCount} onGo={(p) => setPage(p)} />
      </div>

      {detail && <DetailModal clipping={detail} activeLabel={TABS[tab].label} onClose={() => setDetailId(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- components/Board.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: page.tsx에서 데이터 연결**

`app/page.tsx` 전체를 아래로 교체:
```tsx
import { Board } from "@/components/Board";
import { getBoardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getBoardData();
  const updated = "2026.07.22 09:12"; // Phase 2: 최근 수집 시각을 DB에서 산출
  return <Board data={data} updated={updated} />;
}
```

- [ ] **Step 6: 전체 테스트 + 빌드 검증**

Run: `npm test`
Expected: 모든 테스트 PASS.

Run: `npm run build`
Expected: 빌드 성공. (환경변수가 없으면 `getBoardData`가 빌드 중 실행되지 않도록 `force-dynamic`으로 런타임 조회함 — 빌드는 통과해야 함.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire Board container and page data fetch"
```

---

### Task 8: 배포 설정 · 문서 · 로컬 확인

**Files:**
- Modify: `README.md`(실행/배포 섹션 추가)
- Modify: `CLAUDE.md`(스택/명령 갱신)
- Create: `vercel.json`(선택)

**Interfaces:**
- Consumes: 전체 앱.
- Produces: 실행/배포 문서, Vercel 배포 준비 완료 상태.

- [ ] **Step 1: 로컬 실행 확인(자격증명 있을 때)**

`.env.local`에 Supabase 값이 있고 시드 완료 상태에서:

Run: `npm run dev`
Expected: `http://localhost:3000`에서 목록 렌더, 탭 전환/검색/페이지네이션/모달 동작 확인.

> 자격증명이 없으면 이 스텝은 배포 시점에 검증한다.

- [ ] **Step 2: README에 실행/배포 섹션 추가**

`README.md` 맨 아래에 아래 섹션을 추가:
```markdown

## 실행 (Phase 1 구현체)

```bash
npm install
cp .env.example .env.local   # Supabase URL/키 입력
# Supabase SQL Editor에서 supabase/migrations/0001_init.sql 실행
npm run seed                 # 시드 데이터 13건 삽입
npm run dev                  # http://localhost:3000
```

명령:
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm test` — 단위/컴포넌트 테스트
- `npm run seed` — 시드 데이터 재적재(멱등)

## 배포 (Vercel)
1. GitHub 레포에 push.
2. Vercel에서 레포 import.
3. 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정.
4. 배포. push 시 자동 재배포.
```

- [ ] **Step 3: CLAUDE.md 갱신**

`CLAUDE.md`의 "What this repository is" 섹션을, 이제 실제 구현 레포가 되었음을 반영해 갱신한다. 최소한 아래 내용을 추가:
- 스택: Next.js(App Router) + Supabase + Vercel.
- 주요 명령: `npm run dev` / `npm run build` / `npm test` / `npm run seed`.
- 핵심 로직: `lib/board-view.ts`(순수 변환, 테스트 우선), 데이터 접근 `lib/data.ts`, 화면 `components/Board.tsx`.
- 디자인 원본: `IR Clipping Board.dc.html` + `README.md` 토큰. 컴포넌트는 인라인 스타일로 이식.
- Phase 2(수집기)는 `docs/superpowers/specs`의 향후 스펙.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add run/deploy instructions and update project guidance"
```

---

## Self-Review

**Spec coverage:**
- 두 메뉴/카테고리 → Task 2(타입), Task 3(뷰), Task 7(탭). ✓
- 제목·일자·등록자(부서)·첨부 저장 → Task 4(스키마), Task 5(시드). ✓
- 검색/페이지네이션(6건)/NEW/No/모달 → Task 3(로직) + Task 6/7(UI). ✓
- 공개 읽기 전용(RLS) → Task 4. ✓
- Supabase/Vercel/GitHub → Task 4, Task 8. ✓
- 디자인 픽셀 재현 → Task 1(폰트/기본), Task 6/7(인라인 스타일 이식). ✓
- Phase 2(수집기)는 범위 밖으로 명시 → 설계 문서 §3, §10. ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "다운로드" 비동작·최근수집 시각 하드코딩은 Phase 2로 명시된 의도된 제한. ✓

**Type consistency:** `Clipping`/`ClippingFile`/`Category`(Task 2) → `buildBoardView`/`BoardRow`(Task 3) → `mapRowToClipping`/`getBoardData`(Task 4) → `Board`/컴포넌트(Task 6/7)에서 동일 시그니처 사용. `PER_PAGE`(Task 3) 단일 정의. ✓
