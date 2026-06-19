# Changelog

All notable UI/behavior changes, newest first.
Bump `APP_VERSION` in `src/App.jsx` when you cut a version.

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
