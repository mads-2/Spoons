# Changelog

All notable UI/behavior changes, newest first.
Bump `APP_VERSION` in `src/App.jsx` when you cut a version.

## 0.15.0
- Insights made more useful for quick self-knowledge: top drains ("where your energy goes") and top builders ("what gives it back") by spoons, with bars.
- Per-tracked-day averages added to the at-a-glance summary.
- "What stands out" — a few neutral observations, shown only once there are 3+ tracked days and a pattern is actually present.
- Summary index now stores per-category totals (index bumped to v2; rebuilds once).

## 0.14.1
- Button pixel-shadows lightened to grey.

## 0.14.0
- Overall day note (separate from the start note), shown in history.
- Pixel styling: hard offset shadows on buttons, square-pixel accents on section labels.
- Time control: current day defaults to now (editable); old days ask for a time; no time -> shown as '?'.
- Any entry's time is tappable to set or clear.

## 0.13.0
- Structural perf fix: insights now reads a single per-day summary index (1 request) instead of every day's full event log.
- A day's individual entries load lazily, only when you expand that day.
- The index is built once and kept in sync on every change.

## 0.12.2
- Insights loads fast now (storage reads batched in parallel instead of sequential).
- Track-tab Spent/Gained buttons made much paler (chart colors unchanged).

## 0.12.1
- Spent button light red, Gained button light green (matches the chart).

## 0.12.0
- Spoon redrawn at 20px, derived directly from the reference image (faithful bowl + thin curved-shadow handle).
- Fixed insights showing only today: recent days are now fetched directly by date key (plus the open day), not only via key listing.

## 0.11.1
- Spoon: narrower handle; bowl shadow given a slight curve.

## 0.11.0
- Spoon redrawn paler to match the reference; center is a light medium-slate, not a dark core.
- Day navigation: step to previous days (‹ / ›, tap the date to jump back to today) and edit any day.
- Day's entries now shown as an editable list with per-entry remove (replaces the single undo bar).
- Design pass via the frontend-design lens (palette/typography/restraint review).

## 0.10.0
- Untracked days: mark a day untracked (no expectations); excluded from all analytics, shown labeled in history.
- Insights history stays visible even when a range has no tracked days.

## 0.9.0
- Insights: separate DRAINS and GAINS breakdown bars (mental vs physical); physical now a darker saturated blue.
- Per-day chart relabeled 'spent vs gained · by day'.
- Adjusting the day's start now takes an optional note (e.g. 'woke up depleted'); shown in that day's history.

## 0.8.0
- Insights chart: spent = light red, gained = light green; legend matched.
- Builders: removed 'eating / drinking' from physical; moved 'resting' from mental to physical.
- Mental-first ordering carried into the insights drains bar.
- .gitignore now excludes spoon data exports so personal data can't be committed.

## 0.7.0
- Insights: pixelated spends & gains bar chart (one block per spoon, recent 14 days).
- Spoon reverted to original blue-gray sprite; bowl center only slightly lightened.
- Mental listed above physical in both spend and gain sheets.
- Consistency pass: single monospace font, zero rounded corners throughout.

## 0.6.0
- Insights: day/week/month/year/all-time ranges, spent/gained/net + physical-vs-mental bar, expandable per-day full history.
- Category chips colored by axis (physical light blue, mental light grey); bigger/darker MENTAL/PHYSICAL headers.
- Build 'other' relabeled to plain 'other' (axis still stored).
- Uppercase monospace title bar; all rounded corners removed; spoon centers lightened to grey.

## 0.5.0
- Replaced the spoon with your hand-drawn pixel sprite (pale blue-gray, diagonal bowl).

## 0.4.0
- Liminal blue-gray palette; blocky/monospace pixel theme.
- Original pixel-art spoon (drawn from a grid, recolors with theme).
- Spent spoons render as faded "ghost" pixel spoons.

## 0.3.0
- Buttons relabeled "Spent (−)" / "Gained (+)".
- Note prompt auto-opens after each task; outlined "enter" + "skip" buttons.
- Gain "other" split into "other (physical)" / "other (mental)".

## 0.2.0
- Show all of the day's spoons at once as discrete shapes.
- Logging flow: direction -> number of spoons -> category.

## 0.1.0
- First vertical slice: event-log data model, spoon visual, two-tap logging,
  adjustable daily start, undo, optional note, quiet insights area, export.
