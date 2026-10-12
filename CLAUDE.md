# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

«Шайба-трекер» is a kids' habit tracker in Russian, styled as a cartoon hockey game. It is built for a young SKA hockey player and his parents. The repository is public: keep the child's real name and other personal data out of the code, docs and commits (the family's data lives only in the browser). The whole UI, all code comments and README.md are in Russian; keep it that way. README.md is the user-facing feature documentation. Update it whenever a feature changes. `help.html` is a standalone, plain-language guide for other families (Russian, addresses the parent as «ты», own inline styles): update it too when a feature it describes changes. Other families use the public site with their own data in their own browser or their own private sync repo; never add anything that sends their data to us.

Workflow preference of the owner: before implementing a feature, ask clarifying questions (with recommended options) and write code only after the answers.

## Running

There is no build, no package manager and no tests in the repo. Files: `index.html`, `help.html`, `css/*.css` (3), `js/*.js` (7).

- Published with GitHub Pages from `main` (repo `shaiba-tracker/shaiba_tracker`, public): https://shaiba-tracker.github.io/shaiba_tracker/. A `git push` to `main` deploys in about a minute, so commit and push only when asked. `.nojekyll` turns off Jekyll. The old private history is in the `archive` remote/branch (a private repo); never push it to `origin`.
- For local checks open `index.html` directly, or serve the folder (also for phones/TV on the LAN):
  `ruby -run -e httpd . -p 8000 -b 0.0.0.0` → `http://<mac-ip>:8000`. Each address has its own localStorage.
- `gh` is installed at `/opt/homebrew/bin/gh` (not on PATH) and logged in.
- This machine has Ruby and Google Chrome, but **no node and no python**.

### Verifying changes (headless Chrome)

Do the testing in a scratch copy, never in the project:
1. Copy `index.html`, `js/` and `css/` to a scratch dir.
2. Make a test page from the current `index.html` (rebuild it every time, because stale copies give null-element errors) with these additions:
   - a `window.onerror` that writes the error into `document.title`;
   - a pre-script before the first stylesheet that seeds `localStorage['puck-family-v1']` (or the legacy `puck-habits-v2`, which migrates into the first profile). It can also fake `Date` to test weekday-dependent logic.
   - a post-script after `js/app.js` that clicks through the UI and writes the results into `document.title`.
3. Serve the scratch dir over HTTP, not file://. Over file:// errors show only as "Script error".
4. Run:
   `perl -e 'alarm 40; exec @ARGV' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --user-data-dir=<fresh dir> --virtual-time-budget=3000 --dump-dom http://localhost:<port>/test.html | grep -o '<title>.*</title>'`

Tips:
- Use `--screenshot=… --window-size=…` for visual checks.
- For phone width, put the page in a 375px `<iframe>`. A narrow headless window clips the page.
- Stub `window.confirm = () => true` in post-scripts.
- For multi-line edits from the shell, write Ruby scripts with `%q~…~` literals. Shell quoting and `%q{}` with unbalanced braces break JS, and backslashes (e.g. `\\d` in regexes) get eaten. Use the Edit tool for those lines.

## Architecture

**Files.** No modules and no framework: plain classic `<script>`s loaded in order, so top-level `const`/`let`/`function` of one file are visible in the next (one shared global scope, `'use strict'` per file). Order matters only for code that runs at load time; calls made from event handlers or `render*()` can reach any file. Sections are marked with `// ---------- … ----------` headers.
- `js/data.js` — reference data (emoji, units, levels, skips, colors, groups), dates, `esc`/`plural`/`noteList`, family storage, `migrate`, `save`, `activate`.
- `js/logic.js` — sets and records, streaks, `strength()`, month report, weekly-challenge math, wallet bonus.
- `js/ui.js` — `<dialog>` fallback for old TV browsers, sound, `celebrate()`, the horse and the header, parent PIN, the global `[data-close]` handler.
- `js/month.js` — Month tab, challenge card, «Подходы», «День» and habit dialogs.
- `js/tabs.js` — Path, Shop (+prize dialog), Stats, Hall of fame.
- `js/sync.js` — sync with a private GitHub repo (see **Sync** below). Loaded before `app.js`.
- `js/app.js` — Settings and backup, players, tabs, `renderAll()`, start. Must stay last. Settings is a full-screen tab (`#tab-settings`, static markup in `index.html`, updated by `renderSettings()`); it has no tab button, the ⚙️ on the scoreboard calls `showTab('settings')` and gets the `.on` class.
- CSS: `css/base.css` → `css/tabs.css` → `css/screens.css` (TV, phone, old browsers). **Keep this order**: many rules override each other by order with equal specificity, so moving a section between files can silently change the layout.
- Every `<link>`/`<script>` in `index.html` has `?v=N`. Bump N in **all** of them on every change, otherwise a phone or the TV may mix cached old and new files.

**State.** Storage is a *family* (`family = {active, order[], profiles{id: profile}, shared}`) under localStorage key `puck-family-v1`. `state` is a const object that always holds the **active child's** profile: `activate(id)` swaps its contents and `save()` writes `state` back into `family` via `syncFamily()`. Per-profile data lives in `state`; `pin`, `sound` and `lastBackup` are `SHARED` (kept in `family.shared`, but also present on `state`). The legacy single-child key `puck-habits-v2` is read once by `load()` and becomes the first profile. Backup files are format 2 (the whole family); format 1 (one child) is still accepted by `familyFromFile()`. `migrate(s)` fills in every missing field of a profile. When adding a field, add a default in `migrate()`, because backups restored from file also go through `migrate()`. `migrate()` first calls `cleanProfile()`, which silently repairs damaged data (bad dates, unknown skips, non-numeric goals and prices) and validates everything that is inserted into HTML unescaped: emoji (`isEmoji`), colors (`isColor`), ids (`isId`). A new field that ends up in markup must be validated there too. `cleanShared()` does the same for `family.shared`; `familyFromFile()` replaces invalid profile ids. Main fields:
- `habits[]`: `{id, name, emoji, color, createdAt, group, unit?, goal?}`. Array order *is* the display order everywhere; `sortHabits()` keeps it sorted by `GROUPS` order.
- `log{dateKey: [habitId]}`: the pucks scored per day. `vals{dateKey: {habitId: [sets]}}`: sets for count habits; a puck is scored when the sum reaches `goal`.
- `skips{dateKey: reason}`: «Скамейка запасных» (`SKIPS`). Skip days break no streaks, don't count in percentages, and lower weekly-challenge targets.
- `notes{dateKey: text}`: game-day notes. They are shown only when the skip is `game`.
- `shop{spent, owned, worn, number, jname}`, `prizes[]`, `orders[]`: the shop.
- `challenges{mondayKey: {...}}`: the weekly challenge.
- `player{club, number, fhId}`: the player profile (team, game number, fhspb.ru link), edited in the «Игрок» block of Settings and shown as a card on the Path tab (with `state.team` as the name). `fhId` is the fhspb.ru PlayerID GUID only; `fhLink`/`fhPhoto` build the page and photo URLs, the photo is hot-linked and never stored.
- `pcolor` (the child's color), `reportSeen`; the shared `pin{hash, word}` and `lastBackup`.

**Sync** (`js/sync.js`). The family is mirrored to `family.json` in a private GitHub repo through the REST contents API (CORS works from the browser). The connection `conf = {repo, token, sha, base}` lives only in localStorage key `puck-sync-v1`, never in `family`, the cloud or backup files. `cloudData()` is the family without the device-local `active` and `shared.sound`. `save()` runs the `afterSave` hooks; sync debounces a push (about 2.5 s) and also pulls on start, on `visibilitychange`, on `online` and every 60 s. Each run: GET the file; if its sha differs from `conf.sha`, `merge3(base, local, remote)` and `applyCloud()` (goes through `familyFromFile()`/`migrate()`, keeps `active` and sound); then PUT with the remote sha, retrying on 409. Merge rules: a one-sided change wins; objects merge by key; string arrays (log ids, owned, order) and arrays of `{id}` objects (habits, prizes, orders) merge as sets (one-sided deletions stay deleted); `shop.spent` adds both deltas; otherwise this device wins. Sync waits while any `<dialog>` is open (resumes on the dialog `close` event and also rechecks every 2 s). A public repo is refused on connect. `backupDue()` is off while sync is on. A new data field needs nothing extra for sync unless it is device-local (then strip it in `cloudData()` and keep it in `applyCloud()`). Tests mock `fetch` for `api.github.com`.

**Derived values are always recomputed, never stored.**
- Rank: `totalGoals()` = all entries in `log`.
- Wallet: `wallet()` = `totalGoals() + bonusGoals() - shop.spent`. Spending never lowers the rank.
- Streaks, `strength()` and records are computed from `log` and `vals`.
- Date keys are `YYYY-MM-DD` strings (`dkey`/`parseKey`). Use `today()` for the current date.

When switching or deleting a player call `resetView()` to drop per-child UI state (month, chart, order mode, pending confirms). Any new UI state tied to a child's data should be reset there.

**Rendering:** every tab has a `render*()` that rebuilds its `innerHTML` from template strings. After any mutation, call `save()` and then `renderAll()`. `renderAll()` first runs `checkChallenge()` (weekly-challenge completion and its celebration), then re-renders the header, the Month tab and the visible tab. Interaction uses delegated click handlers on the tab containers with `data-*` attributes.

**First run.** `firstRun` (data.js) is true when localStorage has neither `puck-family-v1` nor the legacy key. Then the start code opens `#welcomeDialog` (name, sample or empty habits, optional PIN creation via `openPin('set')`, «У меня уже есть данные» → Settings) instead of the month report. Esc is blocked there. Test pages close it unless `window.__keepWelcome` is set.

**Dialogs:**
- Native `<dialog>` + `showModal()`.
- Any `[data-close]` button closes its dialog (global handler).
- The goal overlay (`celebrate()`) is a `popover="manual"` so that it shows above open modals.
- `[hidden]` is often overridden by component `display` rules, so add an explicit `…[hidden]{display:none}` when needed.

**Parent PIN:**
- Wrap parent-only actions in `requirePin(reason, fn, must)`. `must=true` means "always protected": when no PIN exists yet, it asks to create one first.
- After the PIN is entered, the parent mode stays open for 5 minutes (`unlocked()`), with a banner under the tabs.
- The mode closes only by the timer or «🔒 Закрыть» on the banner; leaving Settings does not lock it. Creating a PIN does not unlock it.
- The PIN is hashed with FNV-1a (`hashStr`), because `crypto.subtle` is unavailable over plain http on the LAN.

Protected actions:
- marks and skips for past days (today is free);
- names, numbers, team and fhspb.ru link in Settings;
- restore from backup;
- issuing, editing and cancelling prizes;
- adding, editing and deleting habits (when a PIN exists), habit order and groups;
- replacing the weekly challenge;
- adding and deleting a player (always, even without PIN). Switching between players is free.

**Mascot:** «Конь-огонь» is an SVG. `horseInner()` draws the body plus the worn SKA gear layers into `<symbol id="horse">`, reused with `<use href="#horse">`.

**UI conventions:**
- Notes and hints use `noteList([...], mod?)` («Примечание:» + bullet list; `mod` adds a CSS class to the note).
- Russian plurals: `plural(n, [one, few, many])`; the common ones are `puckWord(n)` and `dayWord(n)`.
- No inline `style="…"` in templates for static spacing; use classes (e.g. `.gap-top`). Inline styles are only for computed values (`--c`, sizes from data).
- Purchases and choices that cost something use a two-click confirm («Точно? Да!»).
- Layout breakpoints: a phone block `max-width: 640px`, and a compact one-row header for TV and big screens at `min-width: 1180px`.
