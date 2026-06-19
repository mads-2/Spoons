# Changelog

All notable UI/behavior changes, newest first.
Bump `APP_VERSION` in `src/App.jsx` when you cut a version.

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
