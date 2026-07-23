# IR 클리핑 게시판 Phase 2 Implementation Plan — 자동 수집기 + 신규 알림

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7개 공개 게시판을 매시간 수집해 신규 공시규정 소식을 Supabase에 적재하고 첨부파일을 Storage에 보관하며, 신규 항목을 담당자에게 Gmail로 알린다.

**Architecture:** GitHub Actions(cron 매시간) → 보호된 Next.js Route Handler `/api/collect`(Node 런타임) → 각 수집기(RSS/HTML 파서)가 목록을 `CollectedItem[]`로 정규화 → Supabase에 중복키(board+source_ref)로 신규만 upsert, 첨부는 다운로드 후 Storage 업로드 → 신규가 있으면 Nodemailer(Gmail SMTP)로 다이제스트 1통 발송. 파서·중복·다이제스트 등 순수 로직은 저장한 픽스처로 단위 테스트.

**Tech Stack:** Next.js(App Router, TS), Supabase(Postgres + Storage, service_role), cheerio(HTML 파싱), fast-xml-parser(RSS), nodemailer(Gmail SMTP), Vitest, GitHub Actions.

## Global Constraints

- 수집·적재·발송은 모두 **서버 전용**. `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`는 클라이언트 번들/커밋 금지.
- 카테고리: 7개 게시판 전부 `disclosure`. `source`=기관명, `board`=세부 게시판 식별자.
- 중복 방지 키: UNIQUE(`board`, `source_ref`). `source_ref`는 게시물 ID 또는 정규화 상세 URL.
- 신규 감지 목적이므로 각 수집기는 **최근 1~2페이지만** 조회(전체 백필 아님).
- 첨부는 **Supabase Storage 버킷 `clipping-files`(비공개)에 복제 저장**, 경로 `{board}/{source_ref}/{filename}`, 다운로드는 서명 URL. 실패 시 external_url만 기록하고 계속.
- 알림: 실행당 신규 항목 다이제스트 **1통**(출처별 그룹, 제목+원문링크+게시일). 신규 0건이면 미발송. 발송 후 `notified_at` 기록해 재발송 방지.
- 수집기 실패 격리: 한 수집기 에러가 전체를 중단시키지 않음(에러 로깅 후 다음 진행).
- `/api/collect`는 `export const runtime = "nodejs"`, `x-cron-secret` 헤더로 `CRON_SECRET` 검증.
- 네트워크가 필요한 파서 테스트는 **저장한 픽스처 파일**로 수행(테스트에서 실제 사이트 요청 금지).
- 커밋 자주. TDD(순수 로직). Node 18+/npm.

## board 식별자 표
`fsc-bodo`(금융위 보도자료), `fsc-reg`(금융위 소관규정), `ftc-bodo`(공정위 보도자료), `fss-bodo`(금감원 공시 보도자료), `fss-guide`(금감원 공시 안내/제도), `klca-doc`(상장협 공문), `klca-law`(상장협 법령정보).

---

### Task 1: DB 마이그레이션 0002 · Storage 버킷 · alert_recipients · 타입 확장

**Files:**
- Create: `supabase/migrations/0002_phase2.sql`
- Modify: `lib/types.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: 확장된 `clippings`(board, source_ref, source_url, notified_at + UNIQUE), `clipping_files.external_url`, `alert_recipients` 테이블, Storage 버킷 안내. `Clipping` 타입에 `board`, `sourceRef`, `sourceUrl` 추가.

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `supabase/migrations/0002_phase2.sql`:
```sql
alter table clippings add column if not exists board text not null default '';
alter table clippings add column if not exists source_ref text not null default '';
alter table clippings add column if not exists source_url text not null default '';
alter table clippings add column if not exists notified_at timestamptz;

-- 기존 시드 행은 board/source_ref가 비어 UNIQUE 충돌 가능 → 시드는 board='seed', source_ref=id로 채움
update clippings set board = 'seed', source_ref = id::text
  where board = '' and source_ref = '';

create unique index if not exists clippings_board_source_ref_key
  on clippings (board, source_ref);

alter table clipping_files add column if not exists external_url text not null default '';

create table if not exists alert_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- alert_recipients: 공개 select 정책 없음(서버 service_role만 접근). RLS 활성화만.
alter table alert_recipients enable row level security;
```

- [ ] **Step 2: Storage 버킷 안내 주석 추가**

`0002_phase2.sql` 맨 아래에 주석으로 사람 수행 단계를 남긴다:
```sql
-- MANUAL (Supabase Dashboard 또는 CLI):
-- 1) Storage에 비공개 버킷 'clipping-files' 생성.
-- 2) 공개 정책 없이 두고, 서버(service_role)만 업로드/서명URL 발급.
```

- [ ] **Step 3: 타입 확장**

`lib/types.ts`의 `Clipping`에 필드 추가(기존 필드 유지):
```ts
export interface Clipping {
  id: string;
  category: Category;
  board: string;
  title: string;
  source: string;
  sourceRef: string;
  sourceUrl: string;
  department: string;
  body: string;
  collectedAt: string;
  createdAt: string;
  files: ClippingFile[];
}
```
`ClippingFile`에 `externalUrl` 추가:
```ts
export interface ClippingFile {
  id: string;
  name: string;
  size: string;
  storagePath: string;
  externalUrl: string;
}
```

- [ ] **Step 4: .env.example 갱신**

`.env.example`에 추가:
```
CRON_SECRET=long-random-string
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

- [ ] **Step 5: 타입/빌드 확인**

Run: `npm run build`
Expected: 타입 에러 발생 가능(기존 `mapRowToClipping`, seed, 컴포넌트가 새 필드 미반영). **이 태스크에서는 타입 정의만 추가**하고, 실제 사용처 수정은 Task 2에서. 빌드가 새 필드로 깨지면 최소 수정(옵셔널 처리 대신)으로 다음 태스크에 넘길 항목을 report에 명시. 우선 `npm test`가 통과하는지 확인.

Run: `npm test`
Expected: 기존 테스트 통과(또는 타입 변경으로 인한 실패를 report에 기록).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(phase2): migration 0002, storage bucket note, alert_recipients, extended types"
```

> 주: 마이그레이션 적용과 버킷 생성, `alert_recipients` 실제 이메일 시드는 **자격증명 필요 → 사람 수행**(Task 9 배포 단계에서 안내). 이 태스크는 파일만 생성.

---

### Task 2: data 계층 확장 — 매핑/upsert (기존 테스트 유지)

**Files:**
- Modify: `lib/data.ts`
- Modify: `lib/data.test.ts`
- Modify: `lib/seed-data.ts` (필요 시 board/source_ref 반영), `scripts/seed.ts`
- Modify: `components/*.tsx`, `components/Board.test.tsx` (새 필드로 인한 타입 정합만)

**Interfaces:**
- Consumes: `Clipping`/`ClippingFile`(Task 1).
- Produces: `mapRowToClipping`가 board/source_ref/source_url/external_url 매핑. `upsertClipping(item: CollectedItem): Promise<{inserted: boolean; id: string}>` (service_role 클라이언트). `createServiceClient()`.

- [ ] **Step 1: 실패 테스트 갱신(mapRowToClipping 새 필드)**

`lib/data.test.ts`의 기존 두 테스트 기대값에 새 필드 추가. 예:
```ts
const c = mapRowToClipping(row);
expect(c.board).toBe("fss-bodo");
expect(c.sourceRef).toBe("1182");
expect(c.sourceUrl).toBe("https://dart.fss.or.kr/info/searchBodoView.do?...");
expect(c.files[0].externalUrl).toBe("https://.../file.pdf");
```
(row 객체에도 `board`, `source_ref`, `source_url`, `clipping_files[].external_url` 추가.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- lib/data.test.ts`
Expected: FAIL(새 필드 undefined).

- [ ] **Step 3: mapRowToClipping · service 클라이언트 · upsert 구현**

`lib/supabase.ts`에 추가:
```ts
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}
```
`lib/data.ts`의 `ClippingRow`에 `board/source_ref/source_url` 추가, `ClippingFileRow`에 `external_url` 추가, `mapRowToClipping`에서 매핑(`board: row.board`, `sourceRef: row.source_ref`, `sourceUrl: row.source_url`, 파일 `externalUrl: f.external_url`). `getBoardData`의 select에는 변화 없음(`*`).

- [ ] **Step 4: 컴포넌트/시드 타입 정합**

새 필드로 인한 타입 에러 해소: `components/Board.test.tsx`의 `clip()` 헬퍼와 `lib/seed-data.ts`/`scripts/seed.ts`에 필요한 최소 필드 추가(시드는 board 미지정 시 마이그레이션이 'seed'로 채우므로 스크립트는 board/source_ref 없이 insert해도 됨 — 단, 타입상 필요한 곳만 채움). BoardTable/DetailModal은 기존 필드만 쓰므로 변경 최소.

- [ ] **Step 5: 테스트/빌드 통과**

Run: `npm test`
Expected: PASS(기존 + 갱신 테스트).
Run: `npm run build`
Expected: 성공.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(phase2): map new columns, service client, keep suite green"
```

---

### Task 3: 수집기 공통 계약 · 중복키 · CollectedItem→row (TDD)

**Files:**
- Create: `lib/collectors/types.ts`
- Create: `lib/collectors/normalize.ts`
- Test: `lib/collectors/normalize.test.ts`

**Interfaces:**
- Produces:
  - `CollectedItem`(스펙 §6), `Collector` 인터페이스.
  - `dedupKey(item): string` = `${board}::${sourceRef}`.
  - `itemToRow(item)` → clippings insert 페이로드(snake_case, category='disclosure').
  - `normalizeUrl(url)`(쿼리 정렬/trim) — sourceRef를 URL로 쓸 때 안정화.

- [ ] **Step 1: 실패 테스트 작성**

Create `lib/collectors/normalize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { dedupKey, itemToRow, normalizeUrl } from "./normalize";
import type { CollectedItem } from "./types";

const item: CollectedItem = {
  board: "fsc-bodo", source: "금융위원회", sourceRef: "87397",
  title: "보도자료 제목", department: "첨단산업1과",
  collectedAt: "2026-07-23T00:00:00.000Z",
  sourceUrl: "https://www.fsc.go.kr/no010101/87397", body: "",
  files: [{ name: "a.pdf", externalUrl: "https://x/a.pdf" }],
};

describe("dedupKey", () => {
  it("combines board and sourceRef", () => {
    expect(dedupKey(item)).toBe("fsc-bodo::87397");
  });
});

describe("itemToRow", () => {
  it("maps to snake_case disclosure row", () => {
    const r = itemToRow(item);
    expect(r.category).toBe("disclosure");
    expect(r.board).toBe("fsc-bodo");
    expect(r.source_ref).toBe("87397");
    expect(r.source_url).toBe("https://www.fsc.go.kr/no010101/87397");
    expect(r.title).toBe("보도자료 제목");
    expect(r.department).toBe("첨단산업1과");
    expect(r.collected_at).toBe("2026-07-23T00:00:00.000Z");
  });
});

describe("normalizeUrl", () => {
  it("sorts query params and trims", () => {
    expect(normalizeUrl(" https://x/y?b=2&a=1 ")).toBe("https://x/y?a=1&b=2");
  });
  it("leaves paramless url unchanged", () => {
    expect(normalizeUrl("https://x/y")).toBe("https://x/y");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- lib/collectors/normalize.test.ts`
Expected: FAIL(모듈 없음).

- [ ] **Step 3: 구현**

Create `lib/collectors/types.ts`:
```ts
export interface CollectedFile { name: string; externalUrl: string }
export interface CollectedItem {
  board: string;
  source: string;
  sourceRef: string;
  title: string;
  department: string;
  collectedAt: string; // ISO
  sourceUrl: string;
  body: string;
  files: CollectedFile[];
}
export interface Collector {
  board: string;
  source: string;
  collect(): Promise<CollectedItem[]>;
}
```
Create `lib/collectors/normalize.ts`:
```ts
import type { CollectedItem } from "./types";

export function dedupKey(item: Pick<CollectedItem, "board" | "sourceRef">): string {
  return `${item.board}::${item.sourceRef}`;
}

export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  const qi = s.indexOf("?");
  if (qi === -1) return s;
  const base = s.slice(0, qi);
  const params = new URLSearchParams(s.slice(qi + 1));
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const qs = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  return qs ? `${base}?${qs}` : base;
}

export function itemToRow(item: CollectedItem) {
  return {
    category: "disclosure" as const,
    board: item.board,
    source: item.source,
    source_ref: item.sourceRef,
    source_url: item.sourceUrl,
    title: item.title,
    department: item.department,
    body: item.body,
    collected_at: item.collectedAt,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- lib/collectors/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phase2): collector contract, dedupKey, itemToRow, normalizeUrl (TDD)"
```

---

### Task 4: 다이제스트 이메일 빌더 (TDD) · Nodemailer 발송기

**Files:**
- Create: `lib/notify/digest.ts`
- Test: `lib/notify/digest.test.ts`
- Create: `lib/notify/mailer.ts`

**Interfaces:**
- Consumes: `CollectedItem`(Task 3).
- Produces:
  - `buildDigest(items: CollectedItem[]): { subject: string; html: string; text: string }` — 순수.
  - `sendDigest(recipients: string[], digest): Promise<void>` — Nodemailer Gmail.

- [ ] **Step 1: 실패 테스트 작성**

Create `lib/notify/digest.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
import type { CollectedItem } from "../collectors/types";

function it2(board: string, source: string, title: string, url: string): CollectedItem {
  return { board, source, sourceRef: url, title, department: "", collectedAt: "2026-07-23T00:00:00.000Z", sourceUrl: url, body: "", files: [] };
}

describe("buildDigest", () => {
  const items = [
    it2("fsc-bodo", "금융위원회", "A 규정 개정", "https://x/a"),
    it2("ftc-bodo", "공정거래위원회", "B 지침", "https://x/b"),
    it2("fsc-bodo", "금융위원회", "C 공고", "https://x/c"),
  ];
  it("subject includes total new count", () => {
    expect(buildDigest(items).subject).toContain("3");
  });
  it("groups by source and includes every title and link", () => {
    const { html, text } = buildDigest(items);
    for (const s of ["A 규정 개정", "B 지침", "C 공고", "https://x/a", "https://x/b", "https://x/c"]) {
      expect(html).toContain(s);
      expect(text).toContain(s);
    }
    expect(html).toContain("금융위원회");
    expect(html).toContain("공정거래위원회");
  });
  it("escapes HTML in titles", () => {
    const { html } = buildDigest([it2("b", "s", "<script>x</script>", "https://x/z")]);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- lib/notify/digest.test.ts`
Expected: FAIL(모듈 없음).

- [ ] **Step 3: digest 구현**

Create `lib/notify/digest.ts`:
```ts
import type { CollectedItem } from "../collectors/types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildDigest(items: CollectedItem[]): { subject: string; html: string; text: string } {
  const subject = `[IR 클리핑] 신규 ${items.length}건`;
  const bySource = new Map<string, CollectedItem[]>();
  for (const it of items) {
    const arr = bySource.get(it.source) ?? [];
    arr.push(it);
    bySource.set(it.source, arr);
  }
  const htmlParts: string[] = [`<h2>${esc(subject)}</h2>`];
  const textParts: string[] = [`${subject}\n`];
  for (const [source, arr] of bySource) {
    htmlParts.push(`<h3>${esc(source)} (${arr.length})</h3><ul>`);
    textParts.push(`\n[${source}] (${arr.length})`);
    for (const it of arr) {
      const date = it.collectedAt.slice(0, 10).replace(/-/g, ".");
      htmlParts.push(`<li><a href="${esc(it.sourceUrl)}">${esc(it.title)}</a> — ${date}</li>`);
      textParts.push(`- ${it.title} — ${date}\n  ${it.sourceUrl}`);
    }
    htmlParts.push(`</ul>`);
  }
  return { subject, html: htmlParts.join(""), text: textParts.join("\n") };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- lib/notify/digest.test.ts`
Expected: PASS.

- [ ] **Step 5: Nodemailer 발송기**

Run: `npm install nodemailer && npm install -D @types/nodemailer`

Create `lib/notify/mailer.ts`:
```ts
import nodemailer from "nodemailer";

export async function sendDigest(
  recipients: string[],
  digest: { subject: string; html: string; text: string }
): Promise<void> {
  if (recipients.length === 0) return;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: user,
    to: recipients.join(", "),
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
  });
}
```

- [ ] **Step 6: 빌드 + Commit**

Run: `npm run build`
Expected: 성공.
```bash
git add -A
git commit -m "feat(phase2): digest builder (TDD) and Gmail mailer"
```

---

### Task 5: 첨부 다운로드 → Storage 업로드 유틸

**Files:**
- Create: `lib/collectors/attachments.ts`
- Test: `lib/collectors/attachments.test.ts`

**Interfaces:**
- Consumes: `CollectedFile`(Task 3), `createServiceClient`(Task 2).
- Produces: `storagePathFor(board, sourceRef, name): string`; `uploadAttachment(deps, board, sourceRef, file): Promise<{ storagePath: string; size: string; externalUrl: string } | null>` — 다운로드+업로드. 네트워크/Storage는 주입(deps)해 테스트 가능.

- [ ] **Step 1: 실패 테스트 작성 (경로 규칙 + skip/실패 처리)**

Create `lib/collectors/attachments.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { storagePathFor, uploadAttachment } from "./attachments";

describe("storagePathFor", () => {
  it("builds board/sourceRef/filename path, sanitizing", () => {
    expect(storagePathFor("fss-bodo", "1182", "사업보고서 개정.pdf"))
      .toBe("fss-bodo/1182/사업보고서_개정.pdf");
  });
});

describe("uploadAttachment", () => {
  const file = { name: "a.pdf", externalUrl: "https://x/a.pdf" };

  it("downloads then uploads and returns storagePath+size", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const deps = {
      fetchBytes: vi.fn().mockResolvedValue(bytes),
      upload: vi.fn().mockResolvedValue(undefined),
    };
    const r = await uploadAttachment(deps, "fss-bodo", "1182", file);
    expect(deps.fetchBytes).toHaveBeenCalledWith("https://x/a.pdf");
    expect(deps.upload).toHaveBeenCalledWith("fss-bodo/1182/a.pdf", bytes);
    expect(r).toEqual({ storagePath: "fss-bodo/1182/a.pdf", size: "4B", externalUrl: "https://x/a.pdf" });
  });

  it("returns null (does not throw) when download fails", async () => {
    const deps = {
      fetchBytes: vi.fn().mockRejectedValue(new Error("timeout")),
      upload: vi.fn(),
    };
    const r = await uploadAttachment(deps, "fss-bodo", "1182", file);
    expect(r).toBeNull();
    expect(deps.upload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- lib/collectors/attachments.test.ts`
Expected: FAIL(모듈 없음).

- [ ] **Step 3: 구현**

Create `lib/collectors/attachments.ts`:
```ts
import type { CollectedFile } from "./types";

export interface AttachmentDeps {
  fetchBytes: (url: string) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array) => Promise<void>;
}

function humanSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

export function storagePathFor(board: string, sourceRef: string, name: string): string {
  const safe = name.trim().replace(/\s+/g, "_").replace(/[\/\\]/g, "_");
  const ref = sourceRef.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${board}/${ref}/${safe}`;
}

export async function uploadAttachment(
  deps: AttachmentDeps,
  board: string,
  sourceRef: string,
  file: CollectedFile
): Promise<{ storagePath: string; size: string; externalUrl: string } | null> {
  try {
    const bytes = await deps.fetchBytes(file.externalUrl);
    const path = storagePathFor(board, sourceRef, file.name);
    await deps.upload(path, bytes);
    return { storagePath: path, size: humanSize(bytes.byteLength), externalUrl: file.externalUrl };
  } catch {
    return null;
  }
}
```
(실제 deps는 Task 6에서 fetch + Supabase Storage `upload(path, blob, { upsert:true })`로 구성.)

- [ ] **Step 4: 통과 확인 + Commit**

Run: `npm test -- lib/collectors/attachments.test.ts`
Expected: PASS.
```bash
git add -A
git commit -m "feat(phase2): attachment download+upload util with injectable deps (TDD)"
```

---

### Task 6: FSC 보도자료 RSS 수집기 (TDD, 픽스처) + /api/collect 파이프라인 골격

**Files:**
- Create: `lib/collectors/fsc-bodo.ts`
- Create: `lib/collectors/__fixtures__/fsc-bodo.xml` (실제 RSS 저장본)
- Test: `lib/collectors/fsc-bodo.test.ts`
- Create: `lib/collect-run.ts` (오케스트레이션: 순수 부분 분리)
- Test: `lib/collect-run.test.ts`
- Create: `app/api/collect/route.ts`

**Interfaces:**
- Consumes: Task 2~5 전부.
- Produces:
  - `parseFscBodo(xml: string): CollectedItem[]` (순수) + `fscBodoCollector: Collector`.
  - `runCollectors(deps): Promise<{ newItems: CollectedItem[]; errors: string[] }>` — 순수 오케스트레이션(수집기 목록·upsert·첨부·발송을 deps로 주입).
  - `POST /api/collect` — CRON_SECRET 검증 후 실제 deps로 `runCollectors` 실행.

- [ ] **Step 1: RSS 픽스처 확보**

라이브에서 한 번 받아 저장(테스트는 이 파일만 사용):
```bash
curl -sL "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111" -o lib/collectors/__fixtures__/fsc-bodo.xml
head -40 lib/collectors/__fixtures__/fsc-bodo.xml
```
픽스처에서 실제 `<item>`의 title/link/pubDate/description 구조를 확인해 파서와 테스트 기대값을 맞춘다. (구조가 예상과 다르면 report에 실제 태그명을 기록하고 파서를 그에 맞춤.)

- [ ] **Step 2: 실패 테스트 작성 (픽스처 기반)**

Create `lib/collectors/fsc-bodo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFscBodo } from "./fsc-bodo";

const xml = readFileSync(new URL("./__fixtures__/fsc-bodo.xml", import.meta.url), "utf8");

describe("parseFscBodo", () => {
  const items = parseFscBodo(xml);
  it("parses at least one item", () => {
    expect(items.length).toBeGreaterThan(0);
  });
  it("sets board and source", () => {
    expect(items[0].board).toBe("fsc-bodo");
    expect(items[0].source).toBe("금융위원회");
  });
  it("each item has title, sourceUrl, sourceRef, ISO collectedAt", () => {
    for (const it of items) {
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm test -- lib/collectors/fsc-bodo.test.ts`
Expected: FAIL(모듈 없음).

- [ ] **Step 4: 파서 구현**

Run: `npm install fast-xml-parser`

Create `lib/collectors/fsc-bodo.ts` (픽스처의 실제 태그에 맞춰 조정):
```ts
import { XMLParser } from "fast-xml-parser";
import type { Collector, CollectedItem } from "./types";

export const FSC_BODO_RSS = "https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111";

export function parseFscBodo(xml: string): CollectedItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  return arr.map((it: Record<string, unknown>) => {
    const link = String(it.link ?? "").trim();
    const title = String(it.title ?? "").trim();
    const pub = String(it.pubDate ?? "").trim();
    const collectedAt = pub ? new Date(pub).toISOString() : new Date(0).toISOString();
    // sourceRef: link 내 게시물 ID 추출 시도, 없으면 link 자체
    const idMatch = link.match(/\/(\d+)(?:\?|$)/);
    const sourceRef = idMatch ? idMatch[1] : link;
    return {
      board: "fsc-bodo",
      source: "금융위원회",
      sourceRef,
      title,
      department: "",
      collectedAt,
      sourceUrl: link,
      body: String(it.description ?? "").trim(),
      files: [],
    };
  });
}

export const fscBodoCollector: Collector = {
  board: "fsc-bodo",
  source: "금융위원회",
  async collect() {
    const res = await fetch(FSC_BODO_RSS, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FSC RSS ${res.status}`);
    return parseFscBodo(await res.text());
  },
};
```
> `new Date(pub)` 파싱은 collectedAt이 ISO여야 하므로, pubDate가 파싱 불가하면 report에 기록하고 포맷 보정. `new Date()`(현재시각)는 절대 테스트 픽스처 파서에 넣지 말 것 — collectedAt은 pubDate에서만 유도.

- [ ] **Step 5: 파서 테스트 통과**

Run: `npm test -- lib/collectors/fsc-bodo.test.ts`
Expected: PASS.

- [ ] **Step 6: 오케스트레이션(runCollectors) 실패 테스트 작성**

Create `lib/collect-run.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { runCollectors } from "./collect-run";
import type { Collector, CollectedItem } from "./collectors/types";

function item(board: string, ref: string): CollectedItem {
  return { board, source: "S", sourceRef: ref, title: `t-${ref}`, department: "", collectedAt: "2026-07-23T00:00:00.000Z", sourceUrl: `https://x/${ref}`, body: "", files: [] };
}

describe("runCollectors", () => {
  it("inserts only items not already present and returns new ones", async () => {
    const collectors: Collector[] = [
      { board: "b", source: "S", collect: async () => [item("b", "1"), item("b", "2")] },
    ];
    const existing = new Set(["b::1"]);
    const inserted: string[] = [];
    const deps = {
      collectors,
      isExisting: async (key: string) => existing.has(key),
      insertItem: async (it: CollectedItem) => { inserted.push(`${it.board}::${it.sourceRef}`); },
    };
    const { newItems, errors } = await runCollectors(deps);
    expect(inserted).toEqual(["b::2"]);
    expect(newItems.map((i) => i.sourceRef)).toEqual(["2"]);
    expect(errors).toEqual([]);
  });

  it("isolates a failing collector and records the error", async () => {
    const collectors: Collector[] = [
      { board: "bad", source: "S", collect: async () => { throw new Error("boom"); } },
      { board: "ok", source: "S", collect: async () => [item("ok", "9")] },
    ];
    const deps = {
      collectors,
      isExisting: async () => false,
      insertItem: async () => {},
    };
    const { newItems, errors } = await runCollectors(deps);
    expect(newItems.map((i) => i.board)).toEqual(["ok"]);
    expect(errors.join()).toContain("bad");
  });
});
```

- [ ] **Step 7: runCollectors 구현**

Create `lib/collect-run.ts`:
```ts
import type { Collector, CollectedItem } from "./collectors/types";
import { dedupKey } from "./collectors/normalize";

export interface RunDeps {
  collectors: Collector[];
  isExisting: (key: string) => Promise<boolean>;
  insertItem: (item: CollectedItem) => Promise<void>;
}

export async function runCollectors(deps: RunDeps): Promise<{ newItems: CollectedItem[]; errors: string[] }> {
  const newItems: CollectedItem[] = [];
  const errors: string[] = [];
  for (const c of deps.collectors) {
    try {
      const items = await c.collect();
      for (const it of items) {
        const key = dedupKey(it);
        if (await deps.isExisting(key)) continue;
        await deps.insertItem(it);
        newItems.push(it);
      }
    } catch (e) {
      errors.push(`[${c.board}] ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { newItems, errors };
}
```

- [ ] **Step 8: runCollectors 테스트 통과**

Run: `npm test -- lib/collect-run.test.ts`
Expected: PASS.

- [ ] **Step 9: /api/collect route (실 deps 조립)**

Create `app/api/collect/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { runCollectors } from "@/lib/collect-run";
import { itemToRow, dedupKey } from "@/lib/collectors/normalize";
import { uploadAttachment } from "@/lib/collectors/attachments";
import { buildDigest } from "@/lib/notify/digest";
import { sendDigest } from "@/lib/notify/mailer";
import { fscBodoCollector } from "@/lib/collectors/fsc-bodo";
import type { CollectedItem } from "@/lib/collectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COLLECTORS = [fscBodoCollector]; // Task 7,8에서 추가

export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();

  async function insertItem(it: CollectedItem) {
    const { data, error } = await supabase.from("clippings").insert(itemToRow(it)).select("id").single();
    if (error) throw new Error(`insert ${dedupKey(it)}: ${error.message}`);
    const clippingId = data!.id as string;
    for (const f of it.files) {
      const uploaded = await uploadAttachment(
        {
          fetchBytes: async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()),
          upload: async (path, bytes) => {
            const { error: upErr } = await supabase.storage.from("clipping-files").upload(path, bytes, { upsert: true });
            if (upErr) throw upErr;
          },
        },
        it.board, it.sourceRef, f
      );
      await supabase.from("clipping_files").insert({
        clipping_id: clippingId,
        name: f.name,
        size: uploaded?.size ?? "",
        storage_path: uploaded?.storagePath ?? "",
        external_url: f.externalUrl,
      });
    }
  }

  const { newItems, errors } = await runCollectors({
    collectors: COLLECTORS,
    isExisting: async (key) => {
      const [board, ...rest] = key.split("::");
      const source_ref = rest.join("::");
      const { count } = await supabase.from("clippings").select("id", { count: "exact", head: true }).eq("board", board).eq("source_ref", source_ref);
      return (count ?? 0) > 0;
    },
    insertItem,
  });

  if (newItems.length > 0) {
    const { data: recips } = await supabase.from("alert_recipients").select("email").eq("active", true);
    const emails = (recips ?? []).map((r: { email: string }) => r.email);
    try {
      await sendDigest(emails, buildDigest(newItems));
      const ids = newItems.map((i) => dedupKey(i));
      // notified_at 갱신
      for (const it of newItems) {
        await supabase.from("clippings").update({ notified_at: new Date().toISOString() }).eq("board", it.board).eq("source_ref", it.sourceRef);
      }
      void ids;
    } catch (e) {
      errors.push(`email: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ new: newItems.length, errors });
}
```
> `new Date().toISOString()`는 route(런타임)에서만 사용 — 순수 테스트 모듈이 아니므로 허용.

- [ ] **Step 10: 전체 테스트 + 빌드**

Run: `npm test`
Expected: 전체 PASS.
Run: `npm run build`
Expected: 성공(`/api/collect`가 동적 함수로 잡힘).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(phase2): FSC RSS collector + runCollectors + /api/collect pipeline (TDD)"
```

---

### Task 7: HTML 수집기 4종 (금융위 소관규정 · 공정위 · KLCA 공문 · KLCA 법령) — 픽스처 TDD

각 게시판마다 동일 패턴: 라이브 목록 1페이지를 픽스처로 저장 → cheerio 파서로 `CollectedItem[]` 생성 → 픽스처 기대값 테스트 → `COLLECTORS`에 등록.

**Files (보드별 4세트):**
- Create: `lib/collectors/{fsc-reg,ftc-bodo,klca-doc,klca-law}.ts`
- Create: `lib/collectors/__fixtures__/{fsc-reg,ftc-bodo,klca-doc,klca-law}.html`
- Test: `lib/collectors/{...}.test.ts`
- Modify: `app/api/collect/route.ts` (COLLECTORS 배열에 4개 추가)

**Interfaces:**
- 각: `parse<Board>(html: string): CollectedItem[]` (순수) + `<board>Collector: Collector`.

**보드별 파싱 사양(픽스처에서 정확한 selector 확정):**
- **fsc-reg** (금융위 소관규정): `https://www.fsc.go.kr/po040200?curPage=1`. 목록 표에서 제목(상세 링크), 담당부서, 날짜, 첨부. 상세 링크의 게시물 ID→sourceRef, source_url은 절대 URL. board=`fsc-reg`, source=`금융위원회`.
- **ftc-bodo** (공정위 보도자료): `https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02&pageIndex=1`. 항목: 구분/제목/담당부서/등록일/첨부. 상세 `selectBbsNttView.do?...&nttSn={id}` → nttSn=sourceRef. board=`ftc-bodo`, source=`공정거래위원회`.
- **klca-doc** (상장협 공문): `https://www.klca.or.kr/sub/comm/official_document.asp`. ASP 표: 번호/제목/날짜/부서. 상세 링크 파라미터(예: 게시물 seq)→sourceRef. board=`klca-doc`, source=`상장회사협의회`.
- **klca-law** (상장협 법령정보): `https://www.klca.or.kr/sub/law/legal_information.asp`. 표: 번호/제목/날짜/분류. board=`klca-law`, source=`상장회사협의회`.

- [ ] **Step 1: cheerio 설치 + 첫 보드(ftc-bodo) 픽스처 저장**

Run: `npm install cheerio`
Run: `curl -sL "https://www.ftc.go.kr/www/selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02&pageIndex=1" -o lib/collectors/__fixtures__/ftc-bodo.html`
픽스처에서 목록 행의 실제 마크업(선택자, 상세 링크 nttSn 위치, 날짜/부서 셀)을 확인.

- [ ] **Step 2: ftc-bodo 실패 테스트 작성**

Create `lib/collectors/ftc-bodo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFtcBodo } from "./ftc-bodo";

const html = readFileSync(new URL("./__fixtures__/ftc-bodo.html", import.meta.url), "utf8");

describe("parseFtcBodo", () => {
  const items = parseFtcBodo(html);
  it("parses multiple rows", () => { expect(items.length).toBeGreaterThan(3); });
  it("sets board/source and required fields", () => {
    for (const it of items) {
      expect(it.board).toBe("ftc-bodo");
      expect(it.source).toBe("공정거래위원회");
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.sourceRef.length).toBeGreaterThan(0);
      expect(it.sourceUrl).toMatch(/^https?:\/\//);
      expect(it.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
  it("derives sourceRef from nttSn", () => {
    expect(items[0].sourceUrl).toContain(items[0].sourceRef);
  });
});
```

- [ ] **Step 3: 실패 확인 → 파서 구현 → 통과**

Run: `npm test -- lib/collectors/ftc-bodo.test.ts` (FAIL 확인)

Create `lib/collectors/ftc-bodo.ts` (픽스처의 실제 selector로 구현):
```ts
import * as cheerio from "cheerio";
import type { Collector, CollectedItem } from "./types";

const BASE = "https://www.ftc.go.kr/www/";
export const FTC_BODO_LIST = `${BASE}selectBbsNttList.do?bordCd=3&key=12&searchCtgry=01,02&pageIndex=1`;

export function parseFtcBodo(html: string): CollectedItem[] {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];
  // 실제 목록 행 selector는 픽스처에서 확정. 아래는 골격 — 각 행에서 제목 a[href*="nttSn"], 담당부서, 등록일 추출.
  $("table tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const a = $tr.find('a[href*="nttSn"]').first();
    const href = a.attr("href") ?? "";
    const title = a.text().trim();
    if (!title || !href) return;
    const nttSn = (href.match(/nttSn=(\d+)/) ?? [])[1] ?? "";
    const dateText = $tr.find("td").filter((_, td) => /\d{4}-\d{2}-\d{2}/.test($(td).text())).first().text().trim();
    const iso = dateText ? new Date(dateText.match(/\d{4}-\d{2}-\d{2}/)![0]).toISOString() : new Date(0).toISOString();
    const dept = ""; // 픽스처의 부서 셀 위치에 맞춰 채움
    const url = new URL(href, BASE).href;
    items.push({
      board: "ftc-bodo", source: "공정거래위원회",
      sourceRef: nttSn || url, title, department: dept,
      collectedAt: iso, sourceUrl: url, body: "", files: [],
    });
  });
  return items;
}

export const ftcBodoCollector: Collector = {
  board: "ftc-bodo", source: "공정거래위원회",
  async collect() {
    const res = await fetch(FTC_BODO_LIST, { headers: { "User-Agent": "IR-Clipping-Bot/1.0" } });
    if (!res.ok) throw new Error(`FTC ${res.status}`);
    return parseFtcBodo(await res.text());
  },
};
```
Run: `npm test -- lib/collectors/ftc-bodo.test.ts` (PASS까지 selector 보정)

- [ ] **Step 4: 나머지 3개 보드 동일 절차 반복 (fsc-reg, klca-doc, klca-law)**

각 보드에 대해: 픽스처 저장 → `parse<Board>` 테스트(위 ftc 테스트와 동일 구조, board/source 값만 교체) → 파서 구현 → 통과. 각 파서는 해당 사이트 selector·페이지 파라미터·상세 링크 규칙을 픽스처로 확정해 작성한다. sourceRef는 게시물 ID 우선, 없으면 정규화 상세 URL(`normalizeUrl`).

- [ ] **Step 5: COLLECTORS 등록 + 전체 테스트/빌드**

`app/api/collect/route.ts`의 `COLLECTORS`에 4개 콜렉터 추가:
```ts
import { fscRegCollector } from "@/lib/collectors/fsc-reg";
import { ftcBodoCollector } from "@/lib/collectors/ftc-bodo";
import { klcaDocCollector } from "@/lib/collectors/klca-doc";
import { klcaLawCollector } from "@/lib/collectors/klca-law";
const COLLECTORS = [fscBodoCollector, fscRegCollector, ftcBodoCollector, klcaDocCollector, klcaLawCollector];
```
Run: `npm test` (전체 PASS)
Run: `npm run build` (성공)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(phase2): HTML collectors for FSC-reg, FTC, KLCA doc/law (fixture TDD)"
```

---

### Task 8: DART 수집기 2종 (searchBodo · searchGuide) — 요청 재현 + 픽스처 TDD

DART 목록은 `javascript:search(page)`로 로드되므로, 먼저 **실제 백엔드 요청**(URL/파라미터/메서드)을 조사해 직접 호출한다.

**Files:**
- Create: `lib/collectors/{fss-bodo,fss-guide}.ts`
- Create: `lib/collectors/__fixtures__/{fss-bodo,fss-guide}.html`
- Test: `lib/collectors/{fss-bodo,fss-guide}.test.ts`
- Modify: `app/api/collect/route.ts` (COLLECTORS에 2개 추가)
- Create: `docs/superpowers/research/2026-07-23-dart-search-request.md` (조사 결과)

- [ ] **Step 1: search() 요청 조사**

`https://dart.fss.or.kr/info/searchBodo.do` 페이지 소스에서 `function search(...)`와 폼(action/method/hidden params: 예 `currentPage`, `maxResults`, `searchWrd` 등)을 확인. 실제 요청 재현:
```bash
# 페이지 소스에서 form action과 파라미터명 확인 후, 예:
curl -sL "https://dart.fss.or.kr/info/searchBodo.do" | grep -iE "function search|<form|name=\"" | head -40
# 확정된 목록 응답을 픽스처로 저장(예: currentPage=1)
curl -sL "https://dart.fss.or.kr/info/searchBodo.do?currentPage=1" -o lib/collectors/__fixtures__/fss-bodo.html
```
조사 결과(실제 파라미터명, 메서드, 상세 링크가 `rcpNo`/게시물 seq인지 등)를 `docs/superpowers/research/2026-07-23-dart-search-request.md`에 기록. 상세 링크가 `#bodoName` 프래그먼트+JS면, 실제 상세 URL(예 `searchBodoView.do?...seq=`)을 함께 규명.

- [ ] **Step 2: fss-bodo 실패 테스트 작성 (픽스처)**

Create `lib/collectors/fss-bodo.test.ts` — 구조는 Task 7의 테스트와 동일(board=`fss-bodo`, source=`금융감독원`). 담당부서·첨부가 목록에 있으면 최소 1건에서 `department` 비어있지 않음을 함께 검증.

- [ ] **Step 3: 파서 구현 → 통과**

Create `lib/collectors/fss-bodo.ts`: cheerio로 표 파싱(번호/제목/담당부서/작성일자/첨부). sourceRef=게시물 seq(또는 정규화 상세 URL). collectedAt=작성일자(YYYY.MM.DD→ISO). 첨부 링크가 목록/상세에 있으면 `files[{name, externalUrl}]` 채움. `collect()`는 조사한 요청으로 fetch.
Run: `npm test -- lib/collectors/fss-bodo.test.ts` (PASS까지 보정)

- [ ] **Step 4: fss-guide 동일 절차**

`https://dart.fss.or.kr/info/searchGuide.do` — 동일 구조. board=`fss-guide`. 픽스처 저장 → 테스트 → 파서 → 통과.

- [ ] **Step 5: COLLECTORS 등록 + 전체 테스트/빌드 + Commit**

route의 COLLECTORS에 `fssBodoCollector`, `fssGuideCollector` 추가.
Run: `npm test` (전체 PASS)
Run: `npm run build` (성공)
```bash
git add -A
git commit -m "feat(phase2): DART fss-bodo/fss-guide collectors with request research (fixture TDD)"
```

---

### Task 9: GitHub Actions 스케줄 · 다운로드 서명 URL 연동 · 문서/배포 안내

**Files:**
- Create: `.github/workflows/collect.yml`
- Create: `app/api/download/route.ts` (첨부 서명 URL 발급)
- Modify: `components/DetailModal.tsx` (다운로드를 서명 URL로)
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: 매시간 `/api/collect` 호출 워크플로; `GET /api/download?path=...` → 서명 URL 리다이렉트; 모달 다운로드 링크.

- [ ] **Step 1: GitHub Actions 워크플로**

Create `.github/workflows/collect.yml`:
```yaml
name: collect
on:
  schedule:
    - cron: "0 * * * *"   # 매시간
  workflow_dispatch: {}
jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger collect endpoint
        run: |
          code=$(curl -s -o /tmp/out.json -w "%{http_code}" -X POST "$APP_COLLECT_URL" -H "x-cron-secret: $CRON_SECRET")
          echo "HTTP $code"; cat /tmp/out.json
          test "$code" = "200"
        env:
          APP_COLLECT_URL: ${{ secrets.APP_COLLECT_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

- [ ] **Step 2: 다운로드 서명 URL route**

Create `app/api/download/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from("clipping-files").createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
```

- [ ] **Step 3: DetailModal 다운로드 연결**

`components/DetailModal.tsx`에서 파일 행의 "다운로드"를, `storagePath`가 있으면 `<a href={`/api/download?path=${encodeURIComponent(f.storagePath)}`}>`로, 없고 `externalUrl`만 있으면 원문 링크로 연결. `DetailModal`이 받는 파일 타입에 `storagePath`, `externalUrl` 포함(이미 `ClippingFile`에 존재). 기존 RTL 테스트가 깨지지 않게 확인.

- [ ] **Step 4: 문서 갱신**

`README.md`에 Phase 2 운영 섹션 추가: 수집 주기, `/api/collect` 수동 트리거(`curl -X POST ... -H "x-cron-secret: ..."`), 환경변수(`CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`), Storage 버킷·마이그레이션·`alert_recipients` 등록, GitHub Actions Secrets(`APP_COLLECT_URL`, `CRON_SECRET`). `CLAUDE.md`에 수집기 구조(`lib/collectors/*`, `/api/collect`, 스케줄)와 명령 추가.

- [ ] **Step 5: 전체 테스트/빌드 + Commit**

Run: `npm test` (전체 PASS)
Run: `npm run build` (성공, `/api/collect`·`/api/download` 함수 라우트 확인)
```bash
git add -A
git commit -m "feat(phase2): hourly GitHub Actions, signed-url download, docs"
```

- [ ] **Step 6: 사람 수행 배포 단계(문서화, 실행은 사용자)**

report에 체크리스트로 명시(자격증명 필요):
1. Supabase: `0002_phase2.sql` 실행, Storage 버킷 `clipping-files`(비공개) 생성, `alert_recipients`에 담당자 이메일 insert.
2. Gmail: 발신 계정 2단계 인증 + 앱 비밀번호 발급.
3. Vercel 환경변수: `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`(+ 기존 `SUPABASE_SERVICE_ROLE_KEY` 서버 노출) 설정 후 재배포.
4. GitHub repo Secrets: `APP_COLLECT_URL`(=`https://.../api/collect`), `CRON_SECRET`.
5. 워크플로 수동 실행(`workflow_dispatch`)으로 1회 검증 → 신규 적재/메일 확인.

---

## Self-Review

**Spec coverage:**
- 7개 게시판 수집 → Task 6(FSC RSS), 7(HTML 4종), 8(DART 2종). ✓
- 중복키·정규화·row 매핑 → Task 3. ✓
- 첨부 Storage 복제 → Task 5(유틸) + Task 6 route(실 업로드) + Task 9(다운로드 서명 URL). ✓
- 신규 알림 이메일(공통 수신, 다이제스트, 재발송 방지) → Task 4 + Task 6 route(notified_at). ✓
- 매시간 스케줄 → Task 9(GitHub Actions). ✓
- DB 변경/타입/권한(service_role, RLS) → Task 1, 2. ✓
- 자격증명 필요한 실작업은 사람 단계로 분리 명시 → Task 1, 9. ✓

**Placeholder scan:** 순수 로직(정규화·다이제스트·첨부·오케스트레이션·FSC RSS 파서)은 완전한 코드 포함. HTML/DART 파서는 실제 selector가 사이트 마크업에 의존하므로 **픽스처 저장 → selector 확정 → TDD**를 명령으로 구체화(스크래퍼 특성상 selector를 사전 하드코딩 불가). 각 보드의 URL·파라미터·추출 필드·board/source 값은 명시.

**Type consistency:** `CollectedItem`(Task 3) → `itemToRow`/`dedupKey`(3) → `runCollectors`(6) → route → `Clipping`/`ClippingFile`(Task 1) 매핑(Task 2). `uploadAttachment`(5)의 반환이 route의 `clipping_files` insert에 사용. 일관.
