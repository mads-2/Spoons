# spoons

A personal energy tracker built on spoon theory. Single-user, phone + desktop.
This repo is the source of truth — version it with git so every UI change is a
commit you can compare or roll back.

## Run it locally

Requires Node 18+.

```bash
npm install
npm run dev        # opens a local dev server
npm run build      # production build into dist/
```

The whole app is one component: `src/App.jsx`.

## Storage note

In Claude (as an artifact) the app persists to `window.storage`, the key-value
store tied to your Claude account. Running this repo **locally**, `window.storage`
doesn't exist, so it falls back to in-memory state that resets on reload — fine
for UI work. Wiring local persistence (localStorage or a small DB) is a future
step if you want the dev build to remember data.


## Keeping your spoon data private

Your logged spoons are **not** part of this repo and never get pushed to GitHub.
Git only versions the code in `src/`. Your data lives in the app's runtime
storage (Claude's `window.storage`, or in-memory when run locally) — a separate
place the source code doesn't read from disk or write into the project folder.

The one way data could leak is if you save an **export** (`spoons-export.json`)
into this folder and commit it. To prevent that, `.gitignore` already excludes
`spoons-export.json`, `*.spoons.json`, and a `/data/` and `backups/` folder — so
keep any exports under one of those names/locations and git will skip them.
Quick check before pushing: `git status` should never list a spoons file.

## Data model

- One record per day under key `day:YYYY-MM-DD` (local date):
  `{ v, date, start, events: [...] }`
- `start` = that day's starting spoons (default 12, adjustable).
- Each event: `{ id, v, ts, type: drain|build, axis: mental|physical|null,
  category, amount, note, levelBefore }`.
- Current level is computed (`start − drains + builds`), never stored.
- Settings live under `meta:v1`. Export bundles all `day:*` keys to JSON.

## Version control workflow

This folder ships with git already initialized and an initial commit. From here:

```bash
git log --oneline            # see history
git add -A
git commit -m "ui: <what changed>"   # after each change you like

# roll a single file back to an earlier version:
git checkout <commit-sha> -- src/App.jsx

# undo a bad commit without losing history:
git revert <commit-sha>
```

When you cut a version, bump `APP_VERSION` in `src/App.jsx` and add a note to
`CHANGELOG.md`. The version shows in the app header so you always know which
build you're looking at.

To back it up off your machine, create an empty repo on GitHub and:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```
