# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is a **design handoff bundle**, not a runnable application. It specifies the UI for the *IR 클리핑 게시판 (IR Clipping Board)* — an internal board for a corporate IR team that auto-clips disclosure-regulation news and FnGuide research from external sites into one place. Posts are ingested into a DB by a separate collection process (not authored by users); this screen reads that DB and renders a list.

The deliverable is a **re-implementation** of the design in a target codebase's existing stack (React, Vue, server-side templates, etc.) using that project's own patterns and libraries. The files here are the reference, not code to copy into production.

## Files

- `README.md` — the authoritative, high-fidelity spec. Design tokens (colors, typography, radii, grid, shadows), component-by-component layout, interactions, and state shape all live here. **Read it fully before implementing.** It is written in Korean.
- `IR Clipping Board.dc.html` — the adopted design ("1a Ledger"): list + tabs + search + pagination + detail modal. Open in a browser to see the intended rendering.

`README.md` references two files that are **not present** in this bundle: `support.js` (the `.dc.html` runtime loaded via `<script src="./support.js">`) and `IR Clipping Concepts.dc.html` (rejected alternative concepts). Do not assume they exist.

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
