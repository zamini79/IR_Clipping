# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is now a **working Next.js application** (Phase 1 implementation complete), not just a design handoff bundle. It implements the *IR 클리핑 게시판 (IR Clipping Board)* — an internal board for a corporate IR team that auto-clips disclosure-regulation news and FnGuide research from external sites into one place. Posts are ingested into a DB by a separate collection process (not authored by users); this app reads that DB (Supabase Postgres) and renders the list/search/pagination/detail-modal UI.

**Stack**: Next.js 16 (App Router, TypeScript) + Supabase (Postgres + RLS, read-only public access) + Vercel (hosting/CD).

**Key commands**:
- `npm run dev` — dev server (`http://localhost:3000`)
- `npm run build` — production build
- `npm test` — unit/component tests (Vitest)
- `npm run seed` — (re-)load seed data into Supabase (idempotent)
- `npm run lint` — ESLint

See the "실행 (Phase 1 구현체)", "배포 (Vercel)", and "Phase 2 운영" sections at the bottom of this README for full setup/deploy steps.

**Core logic pointers**:
- `lib/board-view.ts` — pure view-transform logic (tab filter, search, pagination, NEW-badge, No numbering). Test-first; no I/O.
- `lib/data.ts` — data access layer (Supabase queries, row→`Clipping` mapping).
- `components/Board.tsx` — top-level client container wiring state (`activeTab`/`query`/`page`/`detailId`) to `lib/board-view.ts` and the presentational components (`BoardTable.tsx`, `SearchBar.tsx`, `Pagination.tsx`, `DetailModal.tsx`).

**Design origin**: the visual design still originates from the `.dc.html` mockup below plus the design-token spec in this README (colors/typography/radii/grid/shadows) — see "Design Tokens" further down. Components port those tokens as **inline styles** (not the mockup's custom runtime, and not yet a token/theme system) to reproduce the design pixel-for-pixel.

**Phase 2 (implemented)**: the collection pipeline that populates Supabase now lives in this repo, specified in `docs/superpowers/specs/2026-07-23-ir-clipping-board-design.md`.

- `lib/collectors/*` — one module per source board, each exporting a `Collector` (see `lib/collectors/types.ts` for `CollectedItem`/`Collector`): `fsc-bodo.ts`, `fsc-reg.ts`, `ftc-bodo.ts`, `klca-doc.ts`, `klca-law.ts`, `fss-bodo.ts`, `fss-guide.ts`. `lib/collectors/normalize.ts` maps a `CollectedItem` to a `clippings` row and derives its dedup key (`board::sourceRef`). `lib/collectors/attachments.ts` copies each item's attachment bytes into the private Supabase Storage bucket `clipping-files`.
- `lib/collect-run.ts` — `runCollectors` orchestrates all collectors, skips already-seen items via a dedup-key lookup, and reports `{ newItems, errors }`.
- `lib/notify/digest.ts` + `lib/notify/mailer.ts` — builds and sends a digest email (via Gmail/nodemailer) to `alert_recipients` when a collection run finds new items; `notified_at` is stamped on inserted rows to prevent re-notification.
- `app/api/collect/route.ts` — `POST`, guarded by `x-cron-secret` header matching `CRON_SECRET`. Runs all collectors, inserts new rows + attachments, sends the digest. `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 300`.
- `app/api/download/route.ts` — `GET ?path=<storagePath>`, issues a 60s Supabase signed URL for a Storage object and redirects to it. Used by `DetailModal`'s attachment download link.
- `.github/workflows/collect.yml` — hourly cron (`0 * * * *`) + `workflow_dispatch`, `POST`s `$APP_COLLECT_URL` with `x-cron-secret: $CRON_SECRET` (both from GitHub Actions Secrets), fails the job if the response is not HTTP 200.
- `supabase/migrations/0002_phase2.sql` — Phase 2 schema additions (`board`/`source_ref`/`source_url`/`notified_at` on `clippings`, `external_url` on `clipping_files`, the `alert_recipients` table). The private `clipping-files` Storage bucket is created manually (not via SQL migration — see README "Phase 2 운영").

## Files

- `README.md` — the authoritative, high-fidelity design spec (tokens, layout, interactions, state shape) **plus**, at the bottom, the run/deploy instructions for the implemented app. **Read the spec section fully before touching UI code.** It is written in Korean.
- `IR Clipping Board.dc.html` — the adopted design ("1a Ledger"): list + tabs + search + pagination + detail modal. Open in a browser to see the intended rendering. This is design reference only — the real UI lives under `app/` and `components/`.

`README.md`'s design-spec section references two files that are **not present** in this bundle: `support.js` (the `.dc.html` runtime loaded via `<script src="./support.js">`) and `IR Clipping Concepts.dc.html` (rejected alternative concepts). Do not assume they exist.

## The `.dc.html` format

`.dc.html` is a **custom prototype runtime**, not standard HTML. Treat its source as a *reference for structure and logic*, not literal code to port:

- Templating uses `{{ ... }}` bindings, `<sc-for list="..." as="x">` loops, and `<sc-if value="...">` conditionals inside an `<x-dc>` root.
- Logic lives in `<script type="text/x-dc">` as a `class Component extends DCLogic` with `state`, a `data()` method (hardcoded mock data), and a `renderVals()` method that maps state → view props. This mirrors a React-style `state` / `setState` / render model — replicate the *behavior*, adapt the *syntax* to the target framework.
- `hint-placeholder-count` / `hint-placeholder-val` attributes are runtime hints only; ignore them when reimplementing.

## Data model (from the spec)

Each clipping item: `{ id, category, title, source(출처), department(담당부서), collectedAt(수집일), body, files[] }`, where a file is `{ name, size, url }`. Two categories: `disclosure` (공시법규 규정) and `fnguide` (FnGuide).

Recommended real fetch shape: `GET /clippings?category=<disclosure|fnguide>&q=<query>&page=<n>&size=6`.

## Behavior contract to preserve

- **State**: `activeTab` (0=공시법규 규정, 1=FnGuide), `query`, `page` (0-indexed), `detailId` (open post id or null).
- **Tab switch** resets page to 0 and clears the query.
- **Search** filters live on input over title + department + source, case-insensitive, partial match; resets page to 0.
- **Pagination**: 6 items per page; `‹`/`›` step with range clamping.
- **NEW badge**: top 2 most-recent items (or a recent-N-days rule).
- **Detail modal**: opens on row click; closes on overlay click (and ESC when implemented); inner clicks stopPropagation.
- **No**: displayed as a zero-padded two-digit descending index (newest = highest number).
