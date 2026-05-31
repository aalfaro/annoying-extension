# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Annoying-extension — a Manifest V3 Chrome extension (WXT + React 19 + TypeScript + Tailwind v4) that is
half task manager, half "annoyance engine": a side-panel Kanban board, plus a background worker that
interrupts you with nag overlays on configured time-wasting sites until you finish your tasks.

## Commands

- `npm install` — install deps; `postinstall` runs `wxt prepare` to generate `.wxt/` types (required before typecheck/build).
- `npm run dev` — WXT dev server with HMR (launches a browser with the extension loaded).
- `npm run build` — production build to `output/chrome-mv3/` (load unpacked there at `chrome://extensions`).
- `npm run compile` — `tsc --noEmit` typecheck (the build does NOT typecheck).
- `npm run test` — Vitest unit tests. Single file: `npx vitest run lib/sites.test.ts`. By name: `npx vitest run -t "shouldSpawn"`.
- `npm run icons` — regenerate `public/icon/*.png` via `scripts/generate-icons.mjs`.

**Node ≥ 20.19 required.** On older Node, `npm install` silently skips rolldown's native binding and every
`wxt` command fails with `Cannot find module './rolldown-binding.*.node'`. Fix by upgrading Node, or as a
stopgap install the arch-specific binding, e.g. `npm i @rolldown/binding-darwin-arm64 --no-save --force`.

## Architecture

Three runtime contexts under `entrypoints/`, communicating only through a shared data layer and a typed
message contract:

- **Side panel** (`entrypoints/sidepanel/`) — the React UI; tabs: Board (Kanban via dnd-kit), Recurring, Settings, Backup.
- **Background worker** (`entrypoints/background.ts`) — decides *when* to nag: a self-re-arming `nag-tick`
  `chrome.alarms` loop, active-tab + dwell tracking, escalation, message dispatch to the overlay,
  recurring-task generation, and a `daily-rollover` alarm.
- **Content script** (`entrypoints/overlay.content/`) — runs on `<all_urls>`, inert until messaged; renders
  the nag UI into a **Shadow DOM** via WXT `createShadowRootUi`.

### Central patterns (read first)

- **Repository abstraction** — ALL persistence goes through `data/repository.ts` (interface) →
  `data/localRepository.ts` (chrome.storage.local). `data/index.ts` exports the singleton `repo`. Never
  touch `chrome.storage` directly from UI/background — call `repo`. A future backend = implement
  `Repository` as `ApiRepository` and change one line in `data/index.ts`.
- **Storage-reactive hooks** (`state/hooks.ts`) — `useTasks/useProjects/useRecurring/useSettings/useUser/useMeta`
  read via `repo` and subscribe to `chrome.storage.onChanged`, so a write in any context (panel, background,
  overlay) live-updates the others.
- **Typed messaging** (`lib/messaging.ts`) — background ↔ content via `SHOW_NAG`, `NAG_ACTION`, `TEST_NAG`.
- **Pure logic vs. side effects** — domain math is pure and unit-tested: `nag/engine.ts` (escalation
  level/style/interval, random task picker), `lib/sites.ts` (host matching), `lib/recurrence.ts`
  (day-of-week spawn), `lib/backup.ts` (export/import build & apply). These import no chrome/DOM APIs; the
  storage glue that calls them lives in `localRepository.ts`. Add new domain logic here and test it.
- **Data model** (`data/types.ts`) — user-scoped `User → Project → Task`; `RecurringTask` templates spawn
  `Task` instances tagged `templateId`/`recurrenceDate`; plus `Settings`, `SyncMeta`. Reads are validated by
  zod in `data/schema.ts` (invalid records dropped, never thrown). Bump `SCHEMA_VERSION` on shape changes.

### Conventions & gotchas (non-obvious)

- **Imports:** `@/` → **repo root**. Shared code lives at the project root (`data/`, `lib/`, `nag/`, `state/`,
  `components/`), NOT under `src/` — deliberate so `@/...` resolves identically for Vite, tsc, and Vitest
  (`vitest.config.ts` mirrors the alias).
- **Styling is split:** the side panel uses Tailwind v4 (`@import "tailwindcss"` via `@tailwindcss/vite`);
  the overlay uses **hand-written scoped CSS** (`entrypoints/overlay.content/style.css`, `.ae-*` classes)
  because Tailwind v4's `:root`-based theme vars don't resolve inside a Shadow DOM. Don't use Tailwind in
  overlay components.
- **MV3 worker is ephemeral:** keep background runtime state (e.g. dwell timers) in `chrome.storage.session`,
  never module globals; scheduling uses persistent `chrome.alarms`. `tick()` reschedules in a `finally` so a
  thrown error can't kill the nag loop.
- **Content-script reach:** content scripts only auto-inject into pages opened *after* load; the background
  uses `chrome.scripting.executeScript` to reach already-open tabs, and the overlay `main()` has an
  idempotency guard so re-injection won't double-mount.
- **Side-panel scrolling:** a tab panel's root needs `h-full` (it sits inside `<main className="overflow-hidden">`),
  or its content is clipped instead of scrolling.

## Git workflow (required)

Every feature or fix gets its **own new branch (from `main` by default) and its own pull request** — never
reuse or combine branches/PRs. Before branching, confirm prior PRs are merged into `main`.
