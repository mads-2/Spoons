import React, { useState, useEffect, useCallback } from "react";

export const APP_VERSION = "0.11.0";

/* ── liminal blue-gray palette ──────────────────────────────── */
const C = {
  paper: "#AEB9C4",
  surface: "#C4CCD4",
  surfaceDim: "#B6C0CA",
  line: "#8A97A3",
  ink: "#2C3640",
  inkSoft: "#4F5B66",
  inkFaint: "#74818D",
  accent: "#7C93A6",
  chipPhys: "#BFD0E0",
  chipMent: "#C9CDD2",
  spentBar: "#D9ABAB",
  gainBar: "#A9C7A5",
  physBar: "#5E8CB5",
};

/* pixel spoon tones — paler, matched to reference; medium slate shadow, light centers */
const SPOON_FILL = { hi: "#EDF1F5", li: "#D4DBE4", mid: "#AEB9C9", dk: "#848FA6" };
const SPOON_SPENT = { hi: "#E2E5E9", li: "#D2D6DC", mid: "#C0C6CE", dk: "#A7AEBB" };

/* ── categories (states, broad — specifics live in the note) ── */
const DRAINS = {
  mental: [
    "overwhelm / stress",
    "ambiguity / change",
    "making mistakes",
    "embarrassment / anxiety / self-doubt",
    "feeling stuck",
    "undesirable task",
    "other",
  ],
  physical: [
    "overstimulation",
    "food / drink",
    "sleep / tiredness",
    "health issues",
    "not moving enough",
    "other",
  ],
};
const BUILDS = {
  physical: ["movement", "fun activities", "resting", "other"],
  mental: [
    "personal relationships",
    "play",
    "having a win",
    "being inspired",
    "other",
  ],
};

/* ── storage: window.storage when present, in-memory otherwise ─ */
const mem = new Map();
const hasStore =
  typeof window !== "undefined" && window.storage && window.storage.get;
async function sget(key) {
  if (hasStore) {
    try {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch {
      return null;
    }
  }
  return mem.has(key) ? JSON.parse(mem.get(key)) : null;
}
async function sset(key, val) {
  const v = JSON.stringify(val);
  if (hasStore) {
    try {
      await window.storage.set(key, v);
    } catch {
      /* swallow; UI already holds state */
    }
  } else {
    mem.set(key, v);
  }
}
async function slist(prefix) {
  if (hasStore) {
    try {
      const r = await window.storage.list(prefix);
      const keys = (r && r.keys) || [];
      return keys.map((k) => (typeof k === "string" ? k : k.key));
    } catch {
      return [];
    }
  }
  return [...mem.keys()].filter((k) => k.startsWith(prefix));
}

/* ── helpers ─────────────────────────────────────────────────── */
const DEFAULT_START = 12;
const dayKey = (d = new Date()) => "day:" + d.toLocaleDateString("en-CA");
const uid = () => Math.random().toString(36).slice(2, 9);
function levelOf(day) {
  if (!day) return 0;
  return day.events.reduce(
    (n, e) => n + (e.type === "build" ? e.amount : -e.amount),
    day.start
  );
}

/* ── pixel spoon (the signature element) ─────────────────────── */
const SP = 16;
const SPRITE = [
  "                ",
  "          LHHL  ",
  "         LMDDML ",
  "        LMMDDMH ",
  "        MLMMDML ",
  "       LLLMMMM  ",
  "      LLLLMMD   ",
  "      HLLLMD    ",
  "     HLLLM      ",
  "    HLLMD       ",
  "   HLLM         ",
  "   HLMD         ",
  "  HLM           ",
  " HLMD           ",
  " HLD            ",
  "  D             ",
];
const TONE = { H: "hi", L: "li", M: "mid", D: "dk" };
const SPOON_CELLS = [];
SPRITE.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) {
    const t = TONE[row[x]];
    if (t) SPOON_CELLS.push({ x, y, tone: t });
  }
});

function SpoonIcon({ filled, px = 3 }) {
  const map = filled ? SPOON_FILL : SPOON_SPENT;
  const dim = SP * px;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${SP} ${SP}`}
      shapeRendering="crispEdges"
      style={{ opacity: filled ? 1 : 0.55, display: "block" }}
    >
      {SPOON_CELLS.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={1} height={1} fill={map[c.tone]} />
      ))}
    </svg>
  );
}
function SpoonCluster({ level, max }) {
  const filled = Math.max(0, Math.min(max, level));
  return (
    <div
      style={styles.cluster}
      role="img"
      aria-label={`${level} of ${max} spoons remaining`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <SpoonIcon key={i} filled={i < filled} />
      ))}
    </div>
  );
}

export default function App() {
  const todayStr = new Date().toLocaleDateString("en-CA");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ version: 1, defaultStart: DEFAULT_START });
  const [activeDate, setActiveDate] = useState(todayStr);
  const [day, setDay] = useState(null);
  const [view, setView] = useState("track");
  const [sheet, setSheet] = useState(null);
  const [last, setLast] = useState(null);
  const [editNote, setEditNote] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [startNoteDraft, setStartNoteDraft] = useState("");

  const isToday = activeDate === todayStr;

  // settings, once
  useEffect(() => {
    (async () => {
      const m = (await sget("meta:v1")) || { version: 1, defaultStart: DEFAULT_START };
      setMeta(m);
    })();
  }, []);

  // load whichever day is active
  useEffect(() => {
    (async () => {
      setLoading(true);
      let d = await sget("day:" + activeDate);
      if (!d) {
        d = { v: 1, date: activeDate, start: meta.defaultStart, startNote: "", untracked: false, events: [] };
      }
      setDay(d);
      setLast(null);
      setEditNote(false);
      setAdjusting(false);
      setLoading(false);
    })();
  }, [activeDate, meta.defaultStart]);

  const persist = useCallback(async (next) => {
    setDay(next);
    await sset("day:" + next.date, next);
  }, []);

  const level = levelOf(day);
  const max = day ? day.start : meta.defaultStart;

  function shiftDate(delta) {
    const d = new Date(activeDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const s = d.toLocaleDateString("en-CA");
    if (s > todayStr) return; // no future
    setActiveDate(s);
  }

  async function log(type, axis, category, amount = 1) {
    const now = new Date();
    let ts;
    if (isToday) ts = now.toISOString();
    else {
      const d = new Date(activeDate + "T00:00:00");
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      ts = d.toISOString();
    }
    const ev = {
      id: uid(),
      v: 1,
      ts,
      type,
      axis,
      category,
      amount: Math.max(1, amount),
      note: "",
      levelBefore: level,
    };
    await persist({ ...day, events: [...day.events, ev] });
    setLast(ev);
    setSheet(null);
    setNoteDraft("");
    setEditNote(true);
  }
  async function setNote(id, note) {
    await persist({
      ...day,
      events: day.events.map((e) => (e.id === id ? { ...e, note } : e)),
    });
  }
  async function removeEvent(id) {
    await persist({ ...day, events: day.events.filter((e) => e.id !== id) });
    if (last && last.id === id) {
      setLast(null);
      setEditNote(false);
    }
  }
  async function undo(id) {
    await persist({ ...day, events: day.events.filter((e) => e.id !== id) });
    setLast(null);
    setEditNote(false);
  }
  function saveNote() {
    if (last) setNote(last.id, noteDraft);
    setEditNote(false);
  }
  async function setStart(n) {
    await persist({ ...day, start: Math.max(0, n) });
  }
  async function saveStartNote() {
    await persist({ ...day, startNote: startNoteDraft });
  }
  async function setUntracked(val) {
    await persist({ ...day, untracked: val });
  }
  async function exportData() {
    const keys = await slist("day:");
    const out = { exportedAt: new Date().toISOString(), version: 1, days: {} };
    for (const k of keys) out.days[k] = await sget(k);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "spoons-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const S = styles;
  if (loading)
    return (
      <div style={S.root}>
        <Style />
        <div style={{ color: C.inkSoft, padding: 40 }}>…</div>
      </div>
    );

  return (
    <div style={S.root}>
      <Style />
      <div style={S.col}>
        <header style={S.bar}>
          <span style={S.wordmark}>
            spoons <span style={S.ver}>v{APP_VERSION}</span>
          </span>
          <nav style={{ display: "flex", gap: 16 }}>
            <button style={S.navlink(view === "track")} onClick={() => setView("track")}>
              track
            </button>
            <button style={S.navlink(view === "insights")} onClick={() => setView("insights")}>
              insights
            </button>
            <button style={S.navlink(false)} onClick={exportData}>
              export
            </button>
          </nav>
        </header>

        {view === "track" ? (
          <main style={S.main}>
            <div style={S.dateNav}>
              <button style={S.navArrow} onClick={() => shiftDate(-1)} aria-label="previous day">‹</button>
              <button style={S.dateLabel} onClick={() => setActiveDate(todayStr)}>
                {isToday ? "today" : fmtDay(activeDate)}
              </button>
              <button
                style={{ ...S.navArrow, opacity: isToday ? 0.3 : 1 }}
                disabled={isToday}
                onClick={() => shiftDate(1)}
                aria-label="next day"
              >›</button>
            </div>
            {day && day.untracked ? (
              <div style={S.untrackedPanel}>
                <p style={S.untrackedMsg}>
                  Untracked day. No expectations here — forgetting a day costs nothing.
                </p>
                <button style={S.action} onClick={() => setUntracked(false)}>
                  track today
                </button>
              </div>
            ) : (
              <>
            <SpoonCluster level={level} max={max} />

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <div style={S.count}>
                {level}
                <span style={S.countOf}> / {max}</span>
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                <button
                  style={S.ofLine}
                  onClick={() => {
                    if (!adjusting) setStartNoteDraft((day && day.startNote) || "");
                    setAdjusting((v) => !v);
                  }}
                >
                  adjust start
                </button>
                <button style={S.ofLine} onClick={() => setUntracked(true)}>
                  mark untracked
                </button>
              </div>
            </div>

            {adjusting && (
              <div style={S.adjustCol}>
                <span style={{ color: C.inkSoft, fontSize: 13 }}>today’s start</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button style={S.step} onClick={() => setStart(max - 1)}>−</button>
                  <span style={{ fontSize: 22, minWidth: 28, textAlign: "center" }}>{max}</span>
                  <button style={S.step} onClick={() => setStart(max + 1)}>+</button>
                </div>
                <input
                  value={startNoteDraft}
                  placeholder="note? (e.g. woke up depleted)"
                  onChange={(e) => setStartNoteDraft(e.target.value)}
                  onBlur={saveStartNote}
                  style={{ ...S.note, flex: "none", width: "100%", minWidth: 0 }}
                />
                <button
                  style={S.linkBtn}
                  onClick={() => {
                    saveStartNote();
                    setAdjusting(false);
                  }}
                >
                  done
                </button>
              </div>
            )}

            {level <= 0 && (
              <p style={S.zero}>Empty. A real limit, not a failure — resting still counts.</p>
            )}

            <div style={S.actions}>
              <button style={S.action} onClick={() => setSheet("drain")}>Spent (−)</button>
              <button style={S.action} onClick={() => setSheet("build")}>Gained (+)</button>
            </div>

            {day && day.events.length > 0 && (
              <div style={S.entries}>
                {[...day.events]
                  .sort((x, y) => (x.ts < y.ts ? 1 : -1))
                  .map((e) => (
                    <div key={e.id} style={S.entryRow}>
                      <span style={{ color: C.inkFaint, minWidth: 48 }}>{fmtTime(e.ts)}</span>
                      <span style={{ minWidth: 26 }}>
                        {e.type === "build" ? "+" : "−"}
                        {e.amount}
                      </span>
                      <span style={{ flex: 1 }}>
                        {e.category}
                        {e.note ? <span style={{ color: C.inkFaint }}> — {e.note}</span> : null}
                      </span>
                      <button
                        style={S.remove}
                        onClick={() => removeEvent(e.id)}
                        aria-label="remove entry"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            )}
            {last && editNote && (
              <div style={S.noteRow}>
                <input
                  key={last.id}
                  autoFocus
                  value={noteDraft}
                  placeholder="add a note? (optional)"
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNote();
                  }}
                  style={S.note}
                />
                <button style={S.enter} onClick={saveNote}>enter</button>
                <button style={S.skipBtn} onClick={() => setEditNote(false)}>skip</button>
              </div>
            )}
              </>
            )}
          </main>
        ) : (
          <Insights today={isToday ? day : null} />
        )}
      </div>

      {sheet && (
        <Sheet
          mode={sheet}
          onClose={() => setSheet(null)}
          onPick={(axis, cat, amount) =>
            log(sheet === "build" ? "build" : "drain", axis, cat, amount)
          }
        />
      )}
    </div>
  );
}

function Sheet({ mode, onPick, onClose }) {
  const [amount, setAmount] = useState(1);
  const [step, setStep] = useState("count");
  const groups = mode === "build" ? BUILDS : DRAINS;
  const order = ["mental", "physical"];
  const heading = mode === "build" ? "Gained" : "Spent";
  return (
    <div style={styles.scrim} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={styles.handle} />
        {step === "count" ? (
          <div style={styles.countStep}>
            <div style={styles.sheetTitle}>{heading} — how many spoons?</div>
            <div style={styles.quickRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  style={styles.quick(amount === n)}
                  onClick={() => {
                    setAmount(n);
                    setStep("category");
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button style={styles.step} onClick={() => setAmount((a) => Math.max(1, a - 1))}>−</button>
              <span style={{ fontSize: 24, minWidth: 30, textAlign: "center" }}>{amount}</span>
              <button style={styles.step} onClick={() => setAmount((a) => a + 1)}>+</button>
            </div>
            <button style={styles.next} onClick={() => setStep("category")}>
              next — pick a category
            </button>
          </div>
        ) : (
          <div>
            <button style={styles.back} onClick={() => setStep("count")}>
              ‹ {amount} spoon{amount > 1 ? "s" : ""}
            </button>
            {order.map((axis) => (
              <div key={axis} style={{ marginBottom: 18 }}>
                <div style={styles.axisLabel}>{axis}</div>
                <div style={styles.chips}>
                  {groups[axis].map((cat) => (
                    <button
                      key={cat}
                      style={{
                        ...styles.chip,
                        background: axis === "physical" ? C.chipPhys : C.chipMent,
                      }}
                      onClick={() => onPick(axis, cat, amount)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}
function rangeCutoff(r) {
  if (r === "day") return new Date().toLocaleDateString("en-CA");
  if (r === "week") return daysAgo(6);
  if (r === "month") return daysAgo(29);
  if (r === "year") return daysAgo(364);
  return null;
}
function aggregate(days) {
  let spent = 0, gained = 0, mDr = 0, pDr = 0, mGn = 0, pGn = 0, zero = 0;
  days.forEach((d) => {
    d.events.forEach((e) => {
      if (e.type === "drain") {
        spent += e.amount;
        if (e.axis === "mental") mDr += e.amount;
        else if (e.axis === "physical") pDr += e.amount;
      } else {
        gained += e.amount;
        if (e.axis === "mental") mGn += e.amount;
        else if (e.axis === "physical") pGn += e.amount;
      }
    });
    if (d.events.length && levelOf(d) <= 0) zero++;
  });
  return { spent, gained, net: gained - spent, mDr, pDr, mGn, pGn, zero, nDays: days.length };
}
function AxisBar({ label, mental, physical }) {
  const total = mental + physical;
  if (!total) return null;
  const mPct = Math.round((mental / total) * 100);
  return (
    <div>
      <div style={styles.smallLabel}>{label} — mental vs physical</div>
      <div style={styles.bar2}>
        <div style={{ ...styles.seg, width: mPct + "%", background: C.chipMent }} />
        <div style={{ ...styles.seg, width: 100 - mPct + "%", background: C.physBar }} />
      </div>
      <div style={styles.barLabel}>
        <span>{mental} mental</span>
        <span>{physical} physical</span>
      </div>
    </div>
  );
}
const RANGES = [
  ["day", "day"],
  ["week", "week"],
  ["month", "month"],
  ["year", "year"],
  ["all", "all time"],
];
const fmtDay = (s) =>
  new Date(s + "T00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function SpendGainChart({ days }) {
  const data = days.map((d) => ({
    d: d.date,
    s: d.events.filter((e) => e.type === "drain").reduce((n, e) => n + e.amount, 0),
    g: d.events.filter((e) => e.type === "build").reduce((n, e) => n + e.amount, 0),
  }));
  if (!data.length) return null;
  const maxVal = Math.max(1, ...data.flatMap((x) => [x.s, x.g]));
  const maxCells = 12;
  const scale = Math.max(1, Math.ceil(maxVal / maxCells));
  const cell = 8,
    gap = 2,
    pairGap = 2,
    groupGap = 10;
  const gw = cell * 2 + pairGap;
  const stepX = gw + groupGap;
  const rows = Math.ceil(maxVal / scale);
  const chartH = rows * (cell + gap);
  const labelH = 16;
  const width = data.length * stepX;
  const cellsFor = (v) => (v <= 0 ? 0 : Math.max(1, Math.round(v / scale)));
  const col = (x, v, color, key) => {
    const n = cellsFor(v);
    const out = [];
    for (let c = 0; c < n; c++) {
      const y = chartH - (c + 1) * (cell + gap) + gap;
      out.push(<rect key={key + c} x={x} y={y} width={cell} height={cell} fill={color} />);
    }
    return out;
  };
  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        width={Math.max(width, 1)}
        height={chartH + labelH}
        shapeRendering="crispEdges"
        style={{ display: "block" }}
      >
        {data.map((x, i) => {
          const gx = i * stepX;
          return (
            <g key={x.d}>
              {col(gx, x.s, C.spentBar, "s" + i)}
              {col(gx + cell + pairGap, x.g, C.gainBar, "g" + i)}
              <text
                x={gx + gw / 2}
                y={chartH + 12}
                textAnchor="middle"
                fontSize="9"
                fill={C.inkFaint}
                fontFamily={MONO}
              >
                {x.d.slice(8)}
              </text>
            </g>
          );
        })}
      </svg>
      {scale > 1 && (
        <div style={{ fontSize: 11, color: C.inkFaint, marginTop: 4 }}>
          each block = {scale} spoons
        </div>
      )}
    </div>
  );
}

function Insights({ today }) {
  const [days, setDays] = useState(null);
  const [range, setRange] = useState("week");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => {
      const keys = await slist("day:");
      const recs = [];
      for (const k of keys) {
        const d = await sget(k);
        if (d) recs.push({ key: k, date: k.slice(4), start: d.start, startNote: d.startNote || "", untracked: d.untracked || false, events: d.events || [] });
      }
      if (today) {
        const tk = "day:" + new Date().toLocaleDateString("en-CA");
        const tRec = { key: tk, date: tk.slice(4), start: today.start, startNote: today.startNote || "", untracked: today.untracked || false, events: today.events || [] };
        const i = recs.findIndex((r) => r.key === tk);
        if (i >= 0) recs[i] = tRec;
        else recs.push(tRec);
      }
      recs.sort((a, b) => (a.date < b.date ? 1 : -1));
      setDays(recs);
    })();
  }, [today]);

  if (!days)
    return (
      <main style={{ ...styles.main, alignItems: "stretch" }}>
        <span style={{ color: C.inkSoft }}>…</span>
      </main>
    );

  const cut = rangeCutoff(range);
  const inRange = days.filter((d) => !cut || d.date >= cut);
  const tracked = inRange.filter((d) => !d.untracked);
  const a = aggregate(tracked);

  return (
    <main style={{ ...styles.main, alignItems: "stretch", textAlign: "left", gap: 18 }}>
      <div style={styles.rangeRow}>
        {RANGES.map(([r, label]) => (
          <button key={r} style={styles.rangeBtn(range === r)} onClick={() => setRange(r)}>
            {label}
          </button>
        ))}
      </div>

      {inRange.length === 0 ? (
        <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>
          Nothing in this window yet.
        </p>
      ) : (
        <>
          {a.nDays > 0 && (
          <>
          <div style={styles.mirror}>
            <div style={styles.mirrorRow}>
              <span>spent</span>
              <span>{a.spent}</span>
            </div>
            <div style={styles.mirrorRow}>
              <span>gained</span>
              <span>{a.gained}</span>
            </div>
            <div style={{ ...styles.mirrorRow, borderBottom: "none" }}>
              <span>net</span>
              <span>{a.net > 0 ? "+" : ""}{a.net}</span>
            </div>
          </div>

          <div>
            <div style={styles.smallLabel}>spent vs gained · by day</div>
            <SpendGainChart days={[...tracked].reverse().slice(-14)} />
            <div style={styles.legend}>
              <span>
                <i style={{ ...styles.swatch, background: C.spentBar }} /> spent
              </span>
              <span>
                <i style={{ ...styles.swatch, background: C.gainBar }} /> gained
              </span>
            </div>
          </div>

          <AxisBar label="drains" mental={a.mDr} physical={a.pDr} />
          <AxisBar label="gains" mental={a.mGn} physical={a.pGn} />

          <div style={styles.mirror}>
            <div style={styles.mirrorRow}>
              <span>days tracked</span>
              <span>{a.nDays}</span>
            </div>
            <div style={{ ...styles.mirrorRow, borderBottom: "none" }}>
              <span>reached empty</span>
              <span>{a.zero}</span>
            </div>
          </div>
          </>
          )}

          <div>
            <div style={styles.smallLabel}>history</div>
            {inRange.map((d) => {
              const sp = d.events.filter((e) => e.type === "drain").reduce((n, e) => n + e.amount, 0);
              const bk = d.events.filter((e) => e.type === "build").reduce((n, e) => n + e.amount, 0);
              const isOpen = open === d.date;
              return (
                <div key={d.date} style={styles.dayWrap}>
                  <button style={styles.dayRow} onClick={() => setOpen(isOpen ? null : d.date)}>
                    <span>
                      {isOpen ? "▾" : "▸"} {fmtDay(d.date)}
                    </span>
                    <span style={{ color: C.inkSoft }}>
                      {d.untracked ? "untracked" : `spent ${sp} · back ${bk}`}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={styles.evList}>
                      <div style={{ ...styles.evRow, color: C.inkSoft }}>
                        <span style={{ minWidth: 50 }}>start</span>
                        <span style={{ minWidth: 26 }}>{d.start}</span>
                        <span style={{ flex: 1, color: C.inkFaint }}>{d.startNote || ""}</span>
                      </div>
                      {d.events.length === 0 && (
                        <div style={{ ...styles.evRow, color: C.inkFaint }}>no entries</div>
                      )}
                      {[...d.events]
                        .sort((x, y) => (x.ts < y.ts ? -1 : 1))
                        .map((e) => (
                          <div key={e.id} style={styles.evRow}>
                            <span style={{ color: C.inkFaint, minWidth: 50 }}>{fmtTime(e.ts)}</span>
                            <span style={{ minWidth: 26 }}>
                              {e.type === "build" ? "+" : "−"}
                              {e.amount}
                            </span>
                            <span style={{ flex: 1 }}>
                              {e.category}
                              {e.axis ? <span style={{ color: C.inkFaint }}> · {e.axis}</span> : null}
                              {e.note ? <span style={{ color: C.inkFaint }}> — {e.note}</span> : null}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
      button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
      input:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 1px; }
    `}</style>
  );
}

const MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const styles = {
  root: {
    minHeight: "100vh",
    background: C.paper,
    color: C.ink,
    fontFamily: MONO,
    display: "flex",
    justifyContent: "center",
  },
  col: { width: "100%", maxWidth: 480, display: "flex", flexDirection: "column" },
  bar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 22px",
    borderBottom: `1px solid ${C.line}`,
  },
  wordmark: { fontSize: 14, letterSpacing: 2, color: C.ink, textTransform: "uppercase" },
  ver: { fontSize: 11, color: C.inkFaint },
  navlink: (on) => ({
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: on ? C.ink : C.inkFaint,
    paddingBottom: 2,
    borderBottom: on ? `2px solid ${C.ink}` : "2px solid transparent",
  }),
  main: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 22px 40px",
    gap: 8,
  },
  cluster: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px 8px",
    maxWidth: 380,
    padding: "12px 0 4px",
  },
  count: { fontSize: 40, fontWeight: 500, lineHeight: 1, letterSpacing: -0.5 },
  countOf: { fontSize: 20, fontWeight: 400, color: C.inkFaint },
  ofLine: { fontSize: 13, color: C.inkSoft, marginTop: 6, textDecoration: "underline" },
  dateNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    width: "100%",
    paddingBottom: 8,
  },
  navArrow: { fontSize: 22, color: C.inkSoft, minWidth: 36, minHeight: 36 },
  dateLabel: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: C.ink,
    minHeight: 36,
    minWidth: 120,
  },
  entries: {
    width: "100%",
    marginTop: 16,
    borderTop: `1px solid ${C.line}`,
  },
  entryRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "9px 0",
    fontSize: 13,
    color: C.ink,
    borderBottom: `1px solid ${C.line}`,
  },
  remove: { fontSize: 18, color: C.inkFaint, minWidth: 30, minHeight: 30 },
  adjust: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 0,
    padding: "12px 18px",
    marginTop: 6,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: 0,
    border: `1px solid ${C.line}`,
    background: C.surfaceDim,
    fontSize: 22,
    color: C.inkSoft,
  },
  linkBtn: { fontSize: 13, color: C.inkSoft },
  adjustCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 0,
    padding: "14px 18px",
    marginTop: 6,
    width: "100%",
    maxWidth: 320,
  },
  zero: {
    maxWidth: 300,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 1.5,
    color: C.ink,
    marginTop: 8,
  },
  untrackedPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 18,
    width: "100%",
    padding: "44px 0",
  },
  untrackedMsg: {
    maxWidth: 300,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 1.5,
    color: C.inkSoft,
  },
  actions: { display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 18 },
  action: {
    width: "100%",
    minHeight: 58,
    background: C.surface,
    border: `1px solid ${C.ink}`,
    borderRadius: 0,
    fontSize: 17,
    color: C.ink,
  },
  undobar: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTop: `1px solid ${C.line}`,
  },
  mini: { fontSize: 13, color: C.inkSoft, minHeight: 36, minWidth: 30 },
  miniUndo: { fontSize: 13, color: C.ink, minHeight: 36, textDecoration: "underline" },
  noteRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    width: "100%",
    marginTop: 10,
  },
  note: {
    flex: 1,
    minWidth: 140,
    padding: "12px 14px",
    borderRadius: 0,
    border: `1px solid ${C.line}`,
    background: C.surface,
    fontSize: 14,
    color: C.ink,
    fontFamily: MONO,
  },
  enter: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 0,
    border: `1px solid ${C.ink}`,
    background: C.surfaceDim,
    color: C.ink,
    fontSize: 13,
  },
  skipBtn: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 0,
    border: `1px solid ${C.line}`,
    background: C.surface,
    color: C.inkSoft,
    fontSize: 13,
  },
  scrim: {
    position: "fixed",
    inset: 0,
    background: "rgba(28,36,44,0.34)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    background: C.paper,
    borderTop: `2px solid ${C.ink}`,
    borderRadius: 0,
    padding: "10px 20px 28px",
    maxHeight: "78vh",
    overflowY: "auto",
  },
  handle: { width: 40, height: 4, background: C.line, margin: "8px auto 18px" },
  countStep: { display: "flex", flexDirection: "column", alignItems: "center", gap: 22, paddingBottom: 10 },
  sheetTitle: { fontSize: 16, color: C.ink, marginTop: 4 },
  quickRow: { display: "flex", gap: 10 },
  quick: (on) => ({
    width: 50,
    height: 50,
    borderRadius: 0,
    border: `1px solid ${on ? C.ink : C.line}`,
    background: on ? C.surfaceDim : C.surface,
    fontSize: 18,
    color: C.ink,
  }),
  next: {
    minHeight: 50,
    padding: "0 24px",
    background: C.surface,
    border: `1px solid ${C.ink}`,
    borderRadius: 0,
    fontSize: 15,
    color: C.ink,
  },
  back: { fontSize: 13, color: C.inkSoft, marginBottom: 16, minHeight: 36 },
  axisLabel: {
    fontSize: 14,
    letterSpacing: 1,
    color: C.ink,
    fontWeight: 600,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 10 },
  chip: {
    minHeight: 48,
    padding: "0 16px",
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 0,
    fontSize: 14,
    color: C.ink,
  },
  mirror: { width: "100%", border: `1px solid ${C.line}`, borderRadius: 0, background: C.surface },
  mirrorRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 18px",
    fontSize: 14,
    color: C.ink,
    borderBottom: `1px solid ${C.line}`,
  },
  rangeRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  rangeBtn: (on) => ({
    flex: 1,
    minWidth: 56,
    minHeight: 38,
    padding: "0 6px",
    border: `1px solid ${on ? C.ink : C.line}`,
    background: on ? C.surfaceDim : C.surface,
    color: on ? C.ink : C.inkSoft,
    fontSize: 12,
    borderRadius: 0,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  }),
  smallLabel: {
    fontSize: 12,
    color: C.ink,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  bar2: {
    display: "flex",
    width: "100%",
    height: 14,
    border: `1px solid ${C.line}`,
    overflow: "hidden",
  },
  seg: { height: "100%" },
  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 6,
    fontSize: 12,
    color: C.inkSoft,
  },
  dayWrap: { borderTop: `1px solid ${C.line}` },
  dayRow: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "12px 2px",
    fontSize: 13,
    color: C.ink,
    textAlign: "left",
  },
  evList: { padding: "0 2px 12px" },
  evRow: {
    display: "flex",
    gap: 10,
    alignItems: "baseline",
    padding: "5px 0",
    fontSize: 13,
    color: C.ink,
  },
  legend: {
    display: "flex",
    gap: 18,
    marginTop: 10,
    fontSize: 12,
    color: C.inkSoft,
    alignItems: "center",
  },
  swatch: {
    display: "inline-block",
    width: 10,
    height: 10,
    marginRight: 6,
    border: `1px solid ${C.line}`,
    verticalAlign: "middle",
  },
};
