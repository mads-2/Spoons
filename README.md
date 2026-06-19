# spoons

A personal energy tracker built on spoon theory. Single-user, phone + desktop.
This repo is the source of truth — version it with git so every UI change is a
commit you can compare or roll back.


## Seamless iterate -> local -> git loop

Set it up once so the round trip is one command.

**One time only**
- Unzip into your project folder (e.g. `/Users/madelinesmac/Spoons`). Do this
  ONCE — re-unzipping later would clobber your git history.
- Connect to GitHub and push (see "Connect to GitHub" below).

**Every iteration**
1. Iterate in your Claude conversation. If that same conversation's artifact is
   the one you actually use day to day, your changes go live immediately and your
   data stays put.
2. Download the updated file Claude hands back (lands in `~/Downloads`).
3. In the repo, run:  `./sync.sh "what changed"`
   That copies the file into `src/App.jsx`, commits with your message, and pushes.

`APP_VERSION` rides inside `App.jsx`, so it stays in sync automatically. Treat
your commit messages as the running changelog; update `CHANGELOG.md` only at
milestones. Prefer clicks? GitHub Desktop does the same: drop the file in, review
the diff, type a message, commit + push.

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
store tied to your Claude account. Persistence only kicks in once the artifact is
**published** (Pro/Max/Team/Enterprise, on Claude web and desktop); before that,
and when run **locally** from this repo, `window.storage` is unavailable and the
app falls back to in-memory state that resets on reload — fine for UI work. Wiring local persistence (localStorage or a small DB) is a future
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
  `{ v, date, start, startNote, dayNote, untracked, events: [...] }`
- `start` = that day's starting spoons (default 12, adjustable); `untracked`
  days are excluded from analytics.
- Each event: `{ id, v, ts, timeUnknown, type: drain|build,
  axis: mental|physical|null, category, amount, note, levelBefore }`.
- Current level is computed (`start − drains + builds`), never stored.
- Settings live under `meta:v1`. A per-day summary cache lives under `index:v2`
  to keep insights fast. Export bundles `day:*` records to JSON (full, or a
  date range).

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

## Connect to GitHub (one time)

The repo is already git-initialized on branch `main` with full history. Pick one:

**Fastest — GitHub CLI** (if you have `gh`; install with `brew install gh`):

```bash
gh auth login                                            # once, if not already
gh repo create mads-2/spoon-tracker --private --source=. --push
```

That creates the private repo and pushes everything in one step.

**Manual** — create an empty private repo named `spoon-tracker` on github.com first (no README/license), then:

```bash
git remote add origin https://github.com/mads-2/spoon-tracker.git
git push -u origin main
```

**Prefer clicks?** Open the folder in GitHub Desktop → "Publish repository" → keep it private.

After this, `./sync.sh "what changed"` pushes every future iteration.
