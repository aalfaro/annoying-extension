# Annoying-extension 🔔

Your tasks, weaponized. A friendly-but-relentless to-do nagger that interrupts your
doomscrolling until you actually get things done.

- **Task board** — a Kanban side panel (projects → To Do / Doing / Done, drag-and-drop) that
  slides in from the right of Chrome.
- **Annoyance engine** — while you waste time on sites like Facebook / TikTok / Instagram
  (configurable, or *every* site), it randomly pops up reminders for your unfinished tasks.
- **Escalating & playful** — starts as a gentle slide-in card, then gets more frequent and
  eventually takes over the screen the longer you linger. Optional sassy copy + sound.
- **Future-proof data model** — everything is scoped to a `user` (`user → projects → tasks`)
  behind a `Repository` abstraction, so this can grow into a hosted, multi-device app later.

## Tech

[WXT](https://wxt.dev) · React 19 · TypeScript · Tailwind CSS v4 · dnd-kit · zod · Manifest V3
(Side Panel API + Shadow-DOM content script).

## Develop

> **Requires Node ≥ 20.19** (WXT 0.20 / Vite 8 / rolldown). On older Node, npm silently skips
> rolldown's native binding and `wxt` commands fail with `Cannot find module
> './rolldown-binding.*.node'`. Fix by upgrading Node (`nvm use` reads `.nvmrc`). As a stopgap
> on Node 20.14–20.18 you can force-install the matching binding, e.g.
> `npm i @rolldown/binding-darwin-arm64 --no-save --force`.

```bash
npm install        # also generates .wxt types via "wxt prepare"
npm run icons      # (re)generate the PNG icons in public/icon
npm run dev        # launches Chrome with the extension loaded + HMR
npm run test       # vitest (pure logic: site matching + nag engine)
npm run compile    # tsc --noEmit type check
npm run build      # production build into .output/
```

### Load it manually

After `npm run build`, open `chrome://extensions`, enable **Developer mode**, click
**Load unpacked**, and select `.output/chrome-mv3/`. Click the toolbar icon to open the
task board; visit a target site (e.g. youtube.com) and wait for a nag.

> Tip for testing: in **Settings → How annoying?** choose *Relentless* and drag "Soonest nag"
> down so reminders fire quickly (Chrome enforces a ~30s minimum on alarms).

## How it fits together

| Piece | File | Role |
| --- | --- | --- |
| Side panel | `entrypoints/sidepanel/` | Kanban board + settings UI |
| Background | `entrypoints/background.ts` | Decides *when* to nag (alarms, tab/dwell tracking, escalation) |
| Overlay | `entrypoints/overlay.content/` | Renders nags in a Shadow DOM on the page |
| Data | `src/data/` | Types, zod schema, `Repository` + `LocalRepository`, seed |
| Nag logic | `src/nag/` | Escalation/style/interval math + message copy (pure, tested) |

To move to a backend later, implement `Repository` as an `ApiRepository` and swap the one
line in `src/data/index.ts`.
