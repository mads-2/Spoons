import React, { useState, useEffect, useCallback } from "react";

export const APP_VERSION = "0.5.0";

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
};

/* pixel spoon tones — matched to the user's hand-drawn sprite */
const SPOON_FILL = { hi: "#EAEEF3", li: "#CAD3DF", mid: "#9FAEC0", dk: "#7C8CA4" };
const SPOON_SPENT = { hi: "#D7DCE2", li: "#C7CED6", mid: "#B6BFC9", dk: "#A4AEBA" };

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
  physical: ["movement", "eating / drinking", "fun activities", "other (physical)"],
  mental: [
    "personal relationships",
    "resting",
    "play",
    "having a win",
    "being inspired",
    "other (mental)",
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
  "          HMMH  ",
  "         HMDDMH ",
  "        HMDDDMM ",
  "        MDDDMLL ",
  "       HMDDMLLM ",
  "       HMMMLLM  ",
  "      HHMLLLM   ",
  "     DHMLLMM    ",
  "    DLHMLM      ",
  "   DLHMM        ",
  "  DLHM          ",
  "  DLM           ",
  " DLM            ",
  " DM             ",
  "                ",
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
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ version: 1, defaultStart: DEFAULT_START });
  const [day, setDay] = useState(null);
  const [view, setView] = useState("track");
  const [sheet, setSheet] = useState(null);
  const [last, setLast] = useState(null);
  const [editNote, setEditNote] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    (async () => {
      const m = (await sget("meta:v1")) || { version: 1, defaultStart: DEFAULT_START };
      let d = await sget(dayKey());
      if (!d) {
        d = { v: 1, date: dayKey().slice(4), start: m.defaultStart, events: [] };
        await sset(dayKey(), d);
      }
      setMeta(m);
      setDay(d);
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setDay(next);
    await sset(dayKey(), next);
  }, []);

  const level = levelOf(day);
  const max = day ? day.start : meta.defaultStart;

  async function log(type, axis, category, amount = 1) {
    const ev = {
      id: uid(),
      v: 1,
      ts: new Date().toISOString(),
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
            <SpoonCluster level={level} max={max} />

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <div style={S.count}>
                {level}
                <span style={S.countOf}> / {max}</span>
              </div>
              <button style={S.ofLine} onClick={() => setAdjusting((v) => !v)}>
                adjust today’s start
              </button>
            </div>

            {adjusting && (
              <div style={S.adjust}>
                <span style={{ color: C.inkSoft, fontSize: 13 }}>today’s start</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button style={S.step} onClick={() => setStart(max - 1)}>−</button>
                  <span style={{ fontSize: 22, minWidth: 28, textAlign: "center" }}>{max}</span>
                  <button style={S.step} onClick={() => setStart(max + 1)}>+</button>
                </div>
                <button style={S.linkBtn} onClick={() => setAdjusting(false)}>done</button>
              </div>
            )}

            {level <= 0 && (
              <p style={S.zero}>Empty. A real limit, not a failure — resting still counts.</p>
            )}

            <div style={S.actions}>
              <button style={S.action} onClick={() => setSheet("drain")}>Spent (−)</button>
              <button style={S.action} onClick={() => setSheet("build")}>Gained (+)</button>
            </div>

            {last && (
              <div style={S.undobar}>
                <span style={{ color: C.inkSoft, fontSize: 13 }}>
                  {last.type === "build" ? "Gained" : "Spent"} {last.amount} · {last.category}
                </span>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <button
                    style={S.mini}
                    onClick={() => {
                      setNoteDraft((last && last.note) || "");
                      setEditNote(true);
                    }}
                  >
                    note
                  </button>
                  <button style={S.miniUndo} onClick={() => undo(last.id)}>undo</button>
                </div>
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
          </main>
        ) : (
          <Insights day={day} />
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
  const order = mode === "build" ? ["physical", "mental"] : ["mental", "physical"];
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
                    <button key={cat} style={styles.chip} onClick={() => onPick(axis, cat, amount)}>
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

function Insights({ day }) {
  const evs = (day && day.events) || [];
  const sum = (t) => evs.filter((e) => e.type === t).reduce((n, e) => n + e.amount, 0);
  const mental = evs.filter((e) => e.type === "drain" && e.axis === "mental").length;
  const physical = evs.filter((e) => e.type === "drain" && e.axis === "physical").length;
  return (
    <main style={{ ...styles.main, alignItems: "stretch", textAlign: "left" }}>
      <p style={{ color: C.inkSoft, lineHeight: 1.6, fontSize: 14 }}>
        Not enough here yet to say anything you couldn’t already feel. A few days of use and
        patterns will start to show — stated plainly, only when they’re true.
      </p>
      {evs.length > 0 && (
        <div style={styles.mirror}>
          <div style={styles.mirrorRow}>
            <span>today</span>
            <span>
              spent {sum("drain")} · back {sum("build")}
            </span>
          </div>
          {(mental > 0 || physical > 0) && (
            <div style={{ ...styles.mirrorRow, borderBottom: "none" }}>
              <span>drains</span>
              <span>
                {mental} mental · {physical} physical
              </span>
            </div>
          )}
        </div>
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
    padding: "18px 22px",
  },
  wordmark: { fontSize: 14, letterSpacing: 1, color: C.inkSoft },
  ver: { fontSize: 11, color: C.inkFaint },
  navlink: (on) => ({
    fontSize: 13,
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
  adjust: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 4,
    padding: "12px 18px",
    marginTop: 6,
  },
  step: {
    width: 44,
    height: 44,
    borderRadius: 4,
    border: `1px solid ${C.line}`,
    background: C.surfaceDim,
    fontSize: 22,
    color: C.inkSoft,
  },
  linkBtn: { fontSize: 13, color: C.inkSoft },
  zero: {
    maxWidth: 300,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 1.5,
    color: C.ink,
    marginTop: 8,
  },
  actions: { display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: 18 },
  action: {
    width: "100%",
    minHeight: 58,
    background: C.surface,
    border: `1px solid ${C.ink}`,
    borderRadius: 4,
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
    borderRadius: 4,
    border: `1px solid ${C.line}`,
    background: C.surface,
    fontSize: 14,
    color: C.ink,
    fontFamily: MONO,
  },
  enter: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 4,
    border: `1px solid ${C.ink}`,
    background: C.surfaceDim,
    color: C.ink,
    fontSize: 13,
  },
  skipBtn: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 4,
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
    borderRadius: "4px 4px 0 0",
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
    borderRadius: 4,
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
    borderRadius: 4,
    fontSize: 15,
    color: C.ink,
  },
  back: { fontSize: 13, color: C.inkSoft, marginBottom: 16, minHeight: 36 },
  axisLabel: { fontSize: 12, letterSpacing: 1, color: C.inkFaint, marginBottom: 10, textTransform: "uppercase" },
  chips: { display: "flex", flexWrap: "wrap", gap: 10 },
  chip: {
    minHeight: 48,
    padding: "0 16px",
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 4,
    fontSize: 14,
    color: C.ink,
  },
  mirror: { width: "100%", marginTop: 22, border: `1px solid ${C.line}`, borderRadius: 4, background: C.surface },
  mirrorRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "14px 18px",
    fontSize: 14,
    color: C.ink,
    borderBottom: `1px solid ${C.line}`,
  },
};
