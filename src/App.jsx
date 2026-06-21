import React, { useState, useEffect, useCallback, useRef } from "react";

export const APP_VERSION = "0.17.1";

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
  spentBtn: "#EFDFDF",
  gainBtn: "#E1ECDD",
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
    "physical exertion",
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
const SP = 20;
const SPRITE = [
  "              HLLLH ",
  "            HHLDMMLH",
  "           HMMMDDMML",
  "          HLDDDDDMML",
  "         HMDDDMMMMLH",
  "         HMDDMMMMLLL",
  "         HMDMMMMMLLL",
  "         HMDMMMMHML ",
  "        HLLLHHHHMH  ",
  "       HHHLDDMMMH   ",
  "      HHLLMMMMLL    ",
  "     HHHLML         ",
  "    HHLLDH          ",
  "   HHLLMH           ",
  "  HHLLML            ",
  " HHHLMM             ",
  "HHHLDH              ",
  "LLLDH               ",
  "MMMM                ",
  "MDM                 ",
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
        <SpoonIcon key={i} filled={i < filled} px={2} />
      ))}
    </div>
  );
}

/* ── pixel check / X icons (decorative, matched to reference) ── */
// 18×18 grid; each cell = 1 unit. Outer border = dark ink, inner = colored face.
function PixelCheckIcon({ size = 36 }) {
  // green palette matched to gainBtn / gainBar feel
  const face  = "#A8D4A0";
  const hi    = "#C8E8C4";
  const lo    = "#7AAF74";
  const dk    = "#9DAAB5";  // light grey border
  const mark  = "#4A7A44";
  // 18×18 pixel map (0=empty, 1=dark border, 2=hi, 3=face, 4=lo, 5=checkmark)
  const G = [
    "000011111111110000",
    "000110000000011000",
    "001023333333320100",
    "010233333333332010",
    "010233333333332010",
    "110233335333332011",
    "102333353533332101",
    "102333335333332101",
    "102333353533332101",// wait, let me do this more carefully
    "102333335333332101",
    "102535333353332101",
    "102353333533332101",
    "102333333333332101",
    "010234333333432010",
    "010233443344332010",
    "001023333333320100",
    "000110000000011000",
    "000011111111110000",
  ];
  // Simpler approach — direct rect list
  const S = size / 18;
  const rects = [];
  // border ring
  const border = [
    // top edge
    ...[3,4,5,6,7,8,9,10,11,12,13,14].map(x=>({x,y:0,c:dk})),
    ...[2,3,14,15].map(x=>({x,y:1,c:dk})),
    ...[1,2,15,16].map(x=>({x,y:2,c:dk})),
    ...[1,16].map(x=>({x,y:3,c:dk})),
    ...[1,16].map(x=>({x,y:4,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:5,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:6,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:7,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:8,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:9,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:10,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:11,c:dk})),
    ...[1,16].map(x=>({x,y:12,c:dk})),
    ...[1,16].map(x=>({x,y:13,c:dk})),
    ...[1,2,15,16].map(x=>({x,y:14,c:dk})),
    ...[2,3,14,15].map(x=>({x,y:15,c:dk})),
    ...[3,4,5,6,7,8,9,10,11,12,13,14].map(x=>({x,y:16,c:dk})),
  ];
  // face fill rows
  const faceRows = [
    {y:2, xs:[3,4,5,6,7,8,9,10,11,12,13,14]},
    {y:3, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:4, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:5, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:6, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:7, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:8, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:9, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:10,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:11,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:12,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:13,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:14,xs:[3,4,5,6,7,8,9,10,11,12,13,14]},
  ];
  faceRows.forEach(({y,xs})=>xs.forEach(x=>rects.push({x,y,c:face})));
  // highlight stripe top
  [{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2},
   {x:2,y:3},{x:3,y:3},{x:4,y:3},{x:5,y:3},{x:2,y:4},{x:3,y:4}].forEach(r=>rects.push({...r,c:hi}));
  // shadow stripe bottom
  [{x:12,y:13},{x:13,y:13},{x:14,y:13},
   {x:11,y:14},{x:12,y:14},{x:13,y:14},{x:14,y:14},
   {x:14,y:12},{x:15,y:11},{x:15,y:12},{x:15,y:13}].forEach(r=>rects.push({...r,c:lo}));
  // plus sign pixels — vertical + horizontal bars centred on 18×18 face
  const check = [
    {x:8,y:4},{x:9,y:4},{x:8,y:5},{x:9,y:5},{x:8,y:6},{x:9,y:6},
    {x:8,y:7},{x:9,y:7},{x:8,y:8},{x:9,y:8},{x:8,y:9},{x:9,y:9},
    {x:8,y:10},{x:9,y:10},{x:8,y:11},{x:9,y:11},{x:8,y:12},{x:9,y:12},{x:8,y:13},{x:9,y:13},
    {x:3,y:8},{x:4,y:8},{x:5,y:8},{x:6,y:8},{x:7,y:8},
    {x:10,y:8},{x:11,y:8},{x:12,y:8},{x:13,y:8},{x:14,y:8},
    {x:3,y:9},{x:4,y:9},{x:5,y:9},{x:6,y:9},{x:7,y:9},
    {x:10,y:9},{x:11,y:9},{x:12,y:9},{x:13,y:9},{x:14,y:9},
  ];
  check.forEach(r=>rects.push({...r,c:mark}));
  border.forEach(r=>rects.push(r));
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" shapeRendering="crispEdges" aria-hidden="true" style={{display:"block",flexShrink:0}}>
      {rects.map((r,i)=><rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.c}/>)}
    </svg>
  );
}

function PixelXIcon({ size = 36 }) {
  const face = "#C9898C";
  const hi   = "#DDB0B2";
  const lo   = "#A06264";
  const dk   = "#9DAAB5";  // light grey border
  const mark = "#B85A5E";
  const rects = [];
  const border = [
    ...[3,4,5,6,7,8,9,10,11,12,13,14].map(x=>({x,y:0,c:dk})),
    ...[2,3,14,15].map(x=>({x,y:1,c:dk})),
    ...[1,2,15,16].map(x=>({x,y:2,c:dk})),
    ...[1,16].map(x=>({x,y:3,c:dk})),
    ...[1,16].map(x=>({x,y:4,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:5,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:6,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:7,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:8,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:9,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:10,c:dk})),
    ...[0,1,16,17].map(x=>({x,y:11,c:dk})),
    ...[1,16].map(x=>({x,y:12,c:dk})),
    ...[1,16].map(x=>({x,y:13,c:dk})),
    ...[1,2,15,16].map(x=>({x,y:14,c:dk})),
    ...[2,3,14,15].map(x=>({x,y:15,c:dk})),
    ...[3,4,5,6,7,8,9,10,11,12,13,14].map(x=>({x,y:16,c:dk})),
  ];
  const faceRows = [
    {y:2, xs:[3,4,5,6,7,8,9,10,11,12,13,14]},
    {y:3, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:4, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:5, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:6, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:7, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:8, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:9, xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:10,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:11,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:12,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:13,xs:[2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
    {y:14,xs:[3,4,5,6,7,8,9,10,11,12,13,14]},
  ];
  faceRows.forEach(({y,xs})=>xs.forEach(x=>rects.push({x,y,c:face})));
  [{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2},{x:7,y:2},{x:8,y:2},
   {x:2,y:3},{x:3,y:3},{x:4,y:3},{x:5,y:3},{x:2,y:4},{x:3,y:4}].forEach(r=>rects.push({...r,c:hi}));
  [{x:12,y:13},{x:13,y:13},{x:14,y:13},
   {x:11,y:14},{x:12,y:14},{x:13,y:14},{x:14,y:14},
   {x:14,y:12},{x:15,y:11},{x:15,y:12},{x:15,y:13}].forEach(r=>rects.push({...r,c:lo}));
  // minus sign pixels — centered in 18×18 grid (x:3..14)
  const xmark = [
    {x:3,y:7},{x:4,y:7},{x:5,y:7},{x:6,y:7},{x:7,y:7},{x:8,y:7},{x:9,y:7},{x:10,y:7},{x:11,y:7},{x:12,y:7},{x:13,y:7},{x:14,y:7},
    {x:3,y:8},{x:4,y:8},{x:5,y:8},{x:6,y:8},{x:7,y:8},{x:8,y:8},{x:9,y:8},{x:10,y:8},{x:11,y:8},{x:12,y:8},{x:13,y:8},{x:14,y:8},
    {x:3,y:9},{x:4,y:9},{x:5,y:9},{x:6,y:9},{x:7,y:9},{x:8,y:9},{x:9,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9},{x:13,y:9},{x:14,y:9},
  ];
  xmark.forEach(r=>rects.push({...r,c:mark}));
  border.forEach(r=>rects.push(r));
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" shapeRendering="crispEdges" aria-hidden="true" style={{display:"block",flexShrink:0}}>
      {rects.map((r,i)=><rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.c}/>)}
    </svg>
  );
}

/* ── pixel-art button frame (LOAD/SAVE style) ────────────────── */
function PixelButton({ onClick, color, children, style: extraStyle }) {
  const isRed = color === "red";
  const face = isRed ? "#EDD8D8" : "#D4E8E9";
  const hi   = isRed ? "#F5EAEA" : "#E6F3F4";
  const lo   = isRed ? "#CDBABA" : "#AECBCC";
  const ring = isRed ? "#CBBFBF" : "#AABFC0";  // single outer ring
  const sh   = "#C8D2D8";                        // 1px shadow

  const W = 80, H = 24;
  const rects = [];
  const p = (x, y, c) => rects.push({ x, y, c });

  // single-pixel outer ring with notched corners
  for (let x = 1; x <= W - 2; x++) { p(x, 0, ring); p(x, H - 2, ring); }
  for (let y = 1; y <= H - 3; y++) { p(0, y, ring); p(W - 1, y, ring); }

  // 1px drop shadow only
  for (let x = 1; x <= W - 1; x++) p(x, H - 1, sh);
  for (let y = 1; y <= H - 1; y++) p(W, y, sh);

  // face fill — full interior
  for (let y = 1; y <= H - 3; y++)
    for (let x = 1; x <= W - 2; x++)
      p(x, y, face);

  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 58,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...extraStyle,
      }}
    >
      <svg
        viewBox={`0 0 ${W + 1} ${H}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.c} />
        ))}
      </svg>
      <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, color: isRed ? "#8A5A5A" : "#4A7A7C", fontSize: 17 }}>
        {children}
      </span>
    </button>
  );
}

/* ── small outline pixel button ── */
/* ── shared pixel frame SVG builder ── */
function PixelFrame({ W, H, color = "#B0BCC6", shadow = "#C8D2D8", face = C.surface, children, onClick, style: extra, textStyle }) {
  const rects = [];
  const p = (x, y, c) => rects.push({ x, y, c });

  // single outer ring (notched corners)
  for (let x = 1; x <= W-2; x++) { p(x, 0, color); p(x, H-2, color); }
  for (let y = 1; y <= H-3; y++) { p(0, y, color); p(W-1, y, color); }

  // face fill
  for (let y = 1; y <= H-3; y++)
    for (let x = 1; x <= W-2; x++)
      p(x, y, face);

  // 1px drop shadow
  for (let x = 2; x <= W; x++) p(x, H-1, shadow);
  for (let y = 1; y <= H-1; y++) p(W, y, shadow);

  return (
    <button onClick={onClick} style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", ...extra }}>
      <svg viewBox={`0 0 ${W+1} ${H}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.c} />)}
      </svg>
      <span style={{ position: "relative", ...textStyle }}>{children}</span>
    </button>
  );
}

function SmallPixelBtn({ onClick, children }) {
  return (
    <PixelFrame
      W={32} H={12}
      color="#BBBBC6"
      shadow="#C8D2D8"
      face={C.surface}
      onClick={onClick}
      style={{ padding: "7px 13px", fontSize: 12, color: C.inkSoft, letterSpacing: 0.3 }}
      textStyle={{ transform: "translateY(-3px)" }}
    >
      {children}
    </PixelFrame>
  );
}

function CategoryBtn({ onClick, children, face }) {
  return (
    <PixelFrame
      W={32} H={14}
      color="#BBBBC6"
      shadow="#C8D2D8"
      face={face || C.surface}
      onClick={onClick}
      style={{ padding: "10px 16px", fontSize: 14, color: C.ink, minHeight: 48 }}
      textStyle={{ transform: "translateY(-2px)" }}
    >
      {children}
    </PixelFrame>
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
  const [dayNoteOpen, setDayNoteOpen] = useState(false);
  const [dayNoteDraft, setDayNoteDraft] = useState("");
  const [editTimeId, setEditTimeId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const isToday = activeDate === todayStr;

  // settings, once
  const indexRef = useRef(null);

  useEffect(() => {
    (async () => {
      const m = (await sget("meta:v1")) || { version: 1, defaultStart: DEFAULT_START };
      setMeta(m);
    })();
  }, []);

  // load (or one-time build) the per-day summary index that powers insights fast
  useEffect(() => {
    (async () => {
      let idx = await sget("index:v2");
      if (!idx) {
        idx = { v: 1, days: {} };
        const keys = new Set();
        try {
          (await slist("day:")).forEach((k) => keys.add(k));
        } catch {}
        for (let i = 0; i < 60; i++) keys.add("day:" + daysAgo(i));
        const res = await Promise.all(
          [...keys].map(async (k) => {
            try {
              const d = await sget(k);
              return d ? [k.slice(4), d] : null;
            } catch {
              return null;
            }
          })
        );
        for (const r of res) if (r) idx.days[r[0]] = summarize(r[1]);
        await sset("index:v2", idx);
      }
      indexRef.current = idx;
    })();
  }, []);

  // load whichever day is active
  useEffect(() => {
    (async () => {
      setLoading(true);
      let d = await sget("day:" + activeDate);
      if (!d) {
        d = { v: 1, date: activeDate, start: meta.defaultStart, startNote: "", dayNote: "", untracked: false, events: [] };
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
    let idx = indexRef.current;
    if (!idx) idx = (await sget("index:v2")) || { v: 1, days: {} };
    idx.days[next.date] = summarize(next);
    indexRef.current = idx;
    await sset("index:v2", idx);
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

  async function log(type, axis, category, amount = 1, opts) {
    const now = new Date();
    let ts;
    let timeUnknown = false;
    if (opts && opts.timeUnknown) {
      ts = new Date(activeDate + "T00:00:00").toISOString();
      timeUnknown = true;
    } else if (opts && opts.timeStr) {
      ts = new Date(activeDate + "T" + opts.timeStr + ":00").toISOString();
    } else if (isToday) {
      ts = now.toISOString();
    } else {
      const d = new Date(activeDate + "T00:00:00");
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      ts = d.toISOString();
    }
    const ev = {
      id: uid(),
      v: 1,
      ts,
      timeUnknown,
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
  async function setEventTime(id, timeStr) {
    const ts = new Date(activeDate + "T" + timeStr + ":00").toISOString();
    await persist({
      ...day,
      events: day.events.map((e) => (e.id === id ? { ...e, ts, timeUnknown: false } : e)),
    });
    setEditTimeId(null);
  }
  async function setEventUnknown(id) {
    await persist({
      ...day,
      events: day.events.map((e) => (e.id === id ? { ...e, timeUnknown: true } : e)),
    });
    setEditTimeId(null);
  }
  async function saveDayNote() {
    await persist({ ...day, dayNote: dayNoteDraft });
    setDayNoteOpen(false);
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
  async function runExport(from, to) {
    const out = {
      exportedAt: new Date().toISOString(),
      version: 1,
      from: from || null,
      to: to || null,
      days: {},
    };
    if (from && to) {
      const cur = new Date(from + "T00:00:00");
      const end = new Date(to + "T00:00:00");
      while (cur <= end) {
        const ds = cur.toLocaleDateString("en-CA");
        try {
          const rec = await sget("day:" + ds);
          if (rec) out.days["day:" + ds] = rec;
        } catch {}
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      try {
        const keys = await slist("day:");
        for (const k of keys) {
          const d = await sget(k);
          if (d) out.days[k] = d;
        }
      } catch {}
    }
    const name =
      from && to ? `spoons-${from}_to_${to}.json` : "spoons-export-full.json";
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportOpen(false);
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
            <button style={S.navlink(false)} onClick={() => setExportOpen(true)}>
              export
            </button>
          </nav>
        </header>

        {view === "track" ? (
          <main style={S.main}>
            <div style={S.dateNav}>
              <button style={S.navArrow} onClick={() => shiftDate(-1)} aria-label="previous day">‹</button>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button style={S.dateLabel} onClick={() => setDatePickerOpen(v => !v)}>
                  {isToday ? "today" : fmtDay(activeDate)}
                </button>
                {datePickerOpen && (
                  <input
                    type="date"
                    max={todayStr}
                    value={activeDate}
                    onChange={(e) => { if (e.target.value) { setActiveDate(e.target.value); setDatePickerOpen(false); } }}
                    onBlur={() => setDatePickerOpen(false)}
                    autoFocus
                    style={{
                      position: "absolute",
                      top: "110%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 10,
                      padding: "8px 10px",
                      background: C.surface,
                      border: `1px solid #BBBBC6`,
                      borderRadius: 0,
                      fontSize: 14,
                      color: C.ink,
                      fontFamily: MONO,
                    }}
                  />
                )}
              </div>
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
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                <SmallPixelBtn
                  onClick={() => {
                    if (!adjusting) setStartNoteDraft((day && day.startNote) || "");
                    setAdjusting((v) => !v);
                  }}
                >
                  adjust start
                </SmallPixelBtn>
                <SmallPixelBtn onClick={() => setUntracked(true)}>
                  mark untracked
                </SmallPixelBtn>
              </div>
            </div>

            {!dayNoteOpen ? (
              day && day.dayNote ? (
                <button
                  style={S.dayNoteShow}
                  onClick={() => {
                    setDayNoteDraft(day.dayNote || "");
                    setDayNoteOpen(true);
                  }}
                >
                  “{day.dayNote}”
                </button>
              ) : (
                <SmallPixelBtn
                  onClick={() => {
                    setDayNoteDraft((day && day.dayNote) || "");
                    setDayNoteOpen(true);
                  }}
                >
                  + note for the day
                </SmallPixelBtn>
              )
            ) : (
              <div style={{
                width: "100%",
                maxWidth: 320,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                alignSelf: "center",
              }}>
                <span style={{ color: C.inkSoft, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>note for the day</span>
                <div style={{
                  position: "relative",
                  background: "#F5F0E8",
                  border: `1px solid ${C.line}`,
                  boxShadow: `2px 2px 0 ${C.line}`,
                }}>
                  {/* left margin rule */}
                  <div style={{
                    position: "absolute",
                    left: 28,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "#D9A8A8",
                    opacity: 0.6,
                  }} />
                  <textarea
                    autoFocus
                    value={dayNoteDraft}
                    placeholder="how the day felt overall…"
                    onChange={(e) => setDayNoteDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) saveDayNote(); }}
                    rows={5}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontSize: 13,
                      lineHeight: "24px",
                      color: C.ink,
                      fontFamily: MONO,
                      // ruled lines at 24px intervals matching lineHeight
                      backgroundImage: "repeating-linear-gradient(transparent, transparent 22px, #C8C0B0 22px, #C8C0B0 23px)",
                      backgroundPositionY: "10px",
                      backgroundAttachment: "local",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button style={S.skipBtn} onClick={() => setDayNoteOpen(false)}>cancel</button>
                  <button className="pxbtn" style={S.next} onClick={saveDayNote}>done</button>
                </div>
              </div>
            )}

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
              <PixelButton color="red" onClick={() => setSheet("drain")}>
                <div style={{marginLeft: -10}}><PixelXIcon size={36} /></div>
                Spent
              </PixelButton>
              <PixelButton color="green" onClick={() => setSheet("build")}>
                <PixelCheckIcon size={36} />
                Gained
              </PixelButton>
            </div>

            {day && day.events.length > 0 && (
              <div style={S.entries}>
                {[...day.events]
                  .sort((x, y) => (x.ts < y.ts ? 1 : -1))
                  .map((e) => (
                    <div key={e.id}>
                      <div style={S.entryRow}>
                        <button
                          style={S.entryTime}
                          onClick={() => setEditTimeId(editTimeId === e.id ? null : e.id)}
                        >
                          {e.timeUnknown ? "?" : fmtTime(e.ts)}
                        </button>
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
                      {editTimeId === e.id && (
                        <div style={S.timeEditRow}>
                          <input
                            type="time"
                            defaultValue={e.timeUnknown ? "" : new Date(e.ts).toTimeString().slice(0, 5)}
                            onChange={(ev) => ev.target.value && setEventTime(e.id, ev.target.value)}
                            style={S.timeInput}
                          />
                          <button style={S.skipBtn} onClick={() => setEventUnknown(e.id)}>
                            set ?
                          </button>
                        </div>
                      )}
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
          <Insights active={day} />
        )}
      </div>

      {sheet && (
        <Sheet
          mode={sheet}
          askTime={!isToday}
          onClose={() => setSheet(null)}
          onLog={(axis, cat, amount, opts) =>
            log(sheet === "build" ? "build" : "drain", axis, cat, amount, opts)
          }
        />
      )}

      {exportOpen && (
        <div style={styles.scrim} onClick={() => setExportOpen(false)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.handle} />
            <div style={styles.sheetTitle}>export data</div>
            <p style={styles.exportHint}>
              A JSON file of your days. Pick a range, or take everything.
            </p>

            <div style={styles.exportQuick}>
              <button className="pxbtn" style={styles.exportBtn} onClick={() => runExport(daysAgo(6), todayStr)}>
                last 7 days
              </button>
              <button className="pxbtn" style={styles.exportBtn} onClick={() => runExport(daysAgo(29), todayStr)}>
                last 30 days
              </button>
              <button className="pxbtn" style={styles.exportBtn} onClick={() => runExport(daysAgo(89), todayStr)}>
                last 90 days
              </button>
              <button className="pxbtn" style={styles.exportBtn} onClick={() => runExport(daysAgo(364), todayStr)}>
                last year
              </button>
            </div>

            <div style={styles.exportCustom}>
              <div className="seclabel" style={styles.smallLabel}>custom range</div>
              <div style={styles.exportDates}>
                <label style={styles.exportDateLabel}>
                  from
                  <input
                    type="date"
                    value={expFrom}
                    max={expTo || todayStr}
                    onChange={(e) => setExpFrom(e.target.value)}
                    style={styles.dateInput}
                  />
                </label>
                <label style={styles.exportDateLabel}>
                  to
                  <input
                    type="date"
                    value={expTo}
                    min={expFrom || undefined}
                    max={todayStr}
                    onChange={(e) => setExpTo(e.target.value)}
                    style={styles.dateInput}
                  />
                </label>
              </div>
              <button
                className="pxbtn"
                style={{ ...styles.exportBtn, opacity: expFrom && expTo ? 1 : 0.4 }}
                disabled={!expFrom || !expTo}
                onClick={() => runExport(expFrom, expTo)}
              >
                export range
              </button>
            </div>

            <button className="pxbtn" style={styles.exportFull} onClick={() => runExport()}>
              export everything
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sheet({ mode, onLog, onClose, askTime }) {
  const [amount, setAmount] = useState(1);
  const [step, setStep] = useState("count"); // count | category | time
  const [picked, setPicked] = useState(null);
  const [timeStr, setTimeStr] = useState("");
  const groups = mode === "build" ? BUILDS : DRAINS;
  const order = ["mental", "physical"];
  const heading = mode === "build" ? "Gained" : "Spent";

  function choose(axis, cat) {
    if (askTime) {
      setPicked({ axis, cat });
      setStep("time");
    } else {
      onLog(axis, cat, amount);
    }
  }

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
                  className="pxbtn"
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
              <button className="pxbtn" style={styles.step} onClick={() => setAmount((a) => Math.max(1, a - 1))}>−</button>
              <span style={{ fontSize: 24, minWidth: 30, textAlign: "center" }}>{amount}</span>
              <button className="pxbtn" style={styles.step} onClick={() => setAmount((a) => a + 1)}>+</button>
            </div>
            <button className="pxbtn" style={styles.next} onClick={() => setStep("category")}>
              next — pick a category
            </button>
          </div>
        ) : step === "category" ? (
          <div>
            <button style={styles.back} onClick={() => setStep("count")}>
              ‹ {amount} spoon{amount > 1 ? "s" : ""}
            </button>
            {order.map((axis) => (
              <div key={axis} style={{ marginBottom: 18 }}>
                <div style={styles.axisLabel}>{axis}</div>
                <div style={styles.chips}>
                  {groups[axis].map((cat) => (
                    <CategoryBtn
                      key={cat}
                      face={axis === "physical" ? C.chipPhys : C.chipMent}
                      onClick={() => choose(axis, cat)}
                    >
                      {cat}
                    </CategoryBtn>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.countStep}>
            <button style={styles.back} onClick={() => setStep("category")}>‹ back</button>
            <div style={styles.sheetTitle}>what time?</div>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              style={styles.timeInput}
            />
            <button
              className="pxbtn"
              style={{ ...styles.next, opacity: timeStr ? 1 : 0.4 }}
              disabled={!timeStr}
              onClick={() => timeStr && onLog(picked.axis, picked.cat, amount, { timeStr })}
            >
              log at this time
            </button>
            <button style={styles.linkBtn} onClick={() => onLog(picked.axis, picked.cat, amount, { timeUnknown: true })}>
              no time (?)
            </button>
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
function summarize(d) {
  let spent = 0, gained = 0, mDr = 0, pDr = 0, mGn = 0, pGn = 0;
  const dCats = {}, bCats = {};
  for (const e of d.events || []) {
    if (e.type === "drain") {
      spent += e.amount;
      dCats[e.category] = (dCats[e.category] || 0) + e.amount;
      if (e.axis === "mental") mDr += e.amount;
      else if (e.axis === "physical") pDr += e.amount;
    } else {
      gained += e.amount;
      bCats[e.category] = (bCats[e.category] || 0) + e.amount;
      if (e.axis === "mental") mGn += e.amount;
      else if (e.axis === "physical") pGn += e.amount;
    }
  }
  const n = (d.events || []).length;
  const level = (d.start || 0) - spent + gained;
  return {
    start: d.start,
    startNote: d.startNote || "",
    dayNote: d.dayNote || "",
    untracked: !!d.untracked,
    n,
    spent,
    gained,
    mDr,
    pDr,
    mGn,
    pGn,
    dCats,
    bCats,
    empty: n > 0 && level <= 0,
  };
}
function topN(map, n) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
function aggregateSummaries(days) {
  let spent = 0, gained = 0, mDr = 0, pDr = 0, mGn = 0, pGn = 0, zero = 0, startSum = 0;
  const dCats = {}, bCats = {};
  for (const d of days) {
    spent += d.spent; gained += d.gained;
    mDr += d.mDr; pDr += d.pDr; mGn += d.mGn; pGn += d.pGn;
    startSum += d.start || 0;
    if (d.empty) zero++;
    for (const k in d.dCats || {}) dCats[k] = (dCats[k] || 0) + d.dCats[k];
    for (const k in d.bCats || {}) bCats[k] = (bCats[k] || 0) + d.bCats[k];
  }
  const nDays = days.length;
  return {
    spent, gained, net: gained - spent, mDr, pDr, mGn, pGn, zero, nDays,
    dCats, bCats, startSum,
    avgSpent: nDays ? spent / nDays : 0,
    avgGained: nDays ? gained / nDays : 0,
  };
}
function observations(a) {
  const obs = [];
  if (a.nDays < 3) return obs;
  const td = topN(a.dCats, 1)[0];
  if (td && a.spent > 0 && td[1] / a.spent >= 0.3)
    obs.push(`Most drains came from ${td[0]} (${td[1]} spoons).`);
  const dr = a.mDr + a.pDr;
  if (dr > 0 && Math.abs(a.mDr - a.pDr) / dr >= 0.25)
    obs.push(`Drains leaned ${a.mDr > a.pDr ? "mental" : "physical"} (${a.mDr} mental · ${a.pDr} physical).`);
  const tb = topN(a.bCats, 1)[0];
  if (tb && a.gained > 0 && tb[1] / a.gained >= 0.3)
    obs.push(`Most spoons came back from ${tb[0]} (${tb[1]}).`);
  if (a.zero > 0)
    obs.push(`Reached empty on ${a.zero} of ${a.nDays} days.`);
  return obs.slice(0, 3);
}
function CatList({ items, color }) {
  if (!items.length)
    return <div style={{ fontSize: 13, color: C.inkFaint }}>nothing logged</div>;
  const max = items[0][1] || 1;
  return (
    <div>
      {items.map(([cat, sp]) => (
        <div key={cat} style={styles.catRow}>
          <span style={styles.catName}>{cat}</span>
          <div style={styles.catBarWrap}>
            <div style={{ ...styles.catBar, width: (sp / max) * 100 + "%", background: color }} />
          </div>
          <span style={styles.catVal}>{sp}</span>
        </div>
      ))}
    </div>
  );
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
      <div className="seclabel" style={styles.smallLabel}>{label} — mental vs physical</div>
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
  ["week", "week"],
  ["month", "month"],
  ["year", "year"],
  ["all", "all time"],
  ["custom", "custom"],
];
const fmtDay = (s) =>
  new Date(s + "T00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function SpendGainChart({ data }) {
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

function Insights({ active }) {
  const [idx, setIdx] = useState(null);
  const [range, setRange] = useState("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(new Date().toLocaleDateString("en-CA"));
  const [open, setOpen] = useState(null);
  const [eventsCache, setEventsCache] = useState({});

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Load index and merge any custom-range days that might predate the 60-day seed
  useEffect(() => {
    (async () => {
      const i = (await sget("index:v2")) || { v: 1, days: {} };
      let days = { ...i.days };
      if (active) days = { ...days, [active.date]: summarize(active) };
      setIdx(days);
    })();
  }, [active]);

  // When custom range changes, load any days not already in idx
  useEffect(() => {
    if (range !== "custom" || !customFrom || !customTo || !idx) return;
    (async () => {
      const cur = new Date(customFrom + "T00:00:00");
      const end = new Date(customTo + "T00:00:00");
      const missing = [];
      while (cur <= end) {
        const ds = cur.toLocaleDateString("en-CA");
        if (!(ds in idx)) missing.push(ds);
        cur.setDate(cur.getDate() + 1);
      }
      if (!missing.length) return;
      const loaded = await Promise.all(missing.map(async (ds) => {
        try { const d = await sget("day:" + ds); return d ? [ds, summarize(d)] : null; } catch { return null; }
      }));
      const patch = {};
      loaded.forEach(r => { if (r) patch[r[0]] = r[1]; });
      if (Object.keys(patch).length) setIdx(prev => ({ ...prev, ...patch }));
    })();
  }, [range, customFrom, customTo, idx]);

  async function toggleDay(date) {
    if (open === date) { setOpen(null); return; }
    setOpen(date);
    if (eventsCache[date] === undefined) {
      try {
        const rec = await sget("day:" + date);
        setEventsCache((c) => ({ ...c, [date]: (rec && rec.events) || [] }));
      } catch {
        setEventsCache((c) => ({ ...c, [date]: [] }));
      }
    }
  }

  if (!idx)
    return (
      <main style={{ ...styles.main, alignItems: "stretch" }}>
        <span style={{ color: C.inkSoft }}>…</span>
      </main>
    );

  // Compute cutoff
  let cut = null;
  let cutEnd = null;
  if (range === "custom") {
    cut = customFrom || null;
    cutEnd = customTo || todayStr;
  } else {
    cut = rangeCutoff(range);
  }

  const inRange = Object.keys(idx)
    .filter((d) => {
      if (cut && d < cut) return false;
      if (cutEnd && d > cutEnd) return false;
      return true;
    })
    .sort((a, b) => (a < b ? 1 : -1))
    .map((d) => ({ date: d, ...idx[d] }));

  const tracked = inRange.filter((d) => !d.untracked);
  const a = aggregateSummaries(tracked);
  const chartData = [...tracked].reverse().slice(-14).map((d) => ({ d: d.date, s: d.spent, g: d.gained }));
  const obs = observations(a);
  const topDrains = topN(a.dCats, 5);
  const topBuilders = topN(a.bCats, 5);

  return (
    <main style={{ ...styles.main, alignItems: "stretch", textAlign: "left", gap: 18 }}>
      <div style={styles.rangeRow}>
        {RANGES.map(([r, label]) => (
          <button key={r} className="pxbtn" style={styles.rangeBtn(range === r)} onClick={() => setRange(r)}>
            {label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: C.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
            from
            <input
              type="date"
              value={customFrom}
              max={customTo || todayStr}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={{ fontSize: 12, color: C.inkSoft, display: "flex", flexDirection: "column", gap: 3 }}>
            to
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              max={todayStr}
              onChange={(e) => setCustomTo(e.target.value)}
              style={styles.dateInput}
            />
          </label>
        </div>
      )}

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
                <div style={styles.mirrorRow}>
                  <span>net</span>
                  <span>{a.net > 0 ? "+" : ""}{a.net}</span>
                </div>
                <div style={{ ...styles.mirrorRow, borderBottom: "none" }}>
                  <span>per tracked day</span>
                  <span>~{a.avgSpent.toFixed(1)} spent · ~{a.avgGained.toFixed(1)} back</span>
                </div>
              </div>

              {obs.length > 0 && (
                <div>
                  <div className="seclabel" style={styles.smallLabel}>what stands out</div>
                  {obs.map((o, i) => (<p key={i} style={styles.obs}>{o}</p>))}
                </div>
              )}

              <div>
                <div className="seclabel" style={styles.smallLabel}>where your energy goes</div>
                <CatList items={topDrains} color={C.spentBar} />
              </div>

              <div>
                <div className="seclabel" style={styles.smallLabel}>what gives it back</div>
                <CatList items={topBuilders} color={C.gainBar} />
              </div>

              <AxisBar label="drains" mental={a.mDr} physical={a.pDr} />
              <AxisBar label="gains" mental={a.mGn} physical={a.pGn} />

              <div>
                <div className="seclabel" style={styles.smallLabel}>spent vs gained · by day</div>
                <SpendGainChart data={chartData} />
                <div style={styles.legend}>
                  <span><i style={{ ...styles.swatch, background: C.spentBar }} /> spent</span>
                  <span><i style={{ ...styles.swatch, background: C.gainBar }} /> gained</span>
                </div>
              </div>

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
            <div className="seclabel" style={styles.smallLabel}>history</div>
            {inRange.map((d) => {
              const isOpen = open === d.date;
              const evs = eventsCache[d.date];
              return (
                <div key={d.date} style={styles.dayWrap}>
                  <button style={styles.dayRow} onClick={() => toggleDay(d.date)}>
                    <span>{isOpen ? "▾" : "▸"} {fmtDay(d.date)}</span>
                    <span style={{ color: C.inkSoft }}>{d.untracked ? "untracked" : `spent ${d.spent} · back ${d.gained}`}</span>
                  </button>
                  {isOpen && (
                    <div style={styles.evList}>
                      <div style={{ ...styles.evRow, color: C.inkSoft }}>
                        <span style={{ minWidth: 50 }}>start</span>
                        <span style={{ minWidth: 26 }}>{d.start}</span>
                        <span style={{ flex: 1, color: C.inkFaint }}>{d.startNote || ""}</span>
                      </div>
                      {d.dayNote ? (
                        <div style={{ ...styles.evRow, color: C.inkFaint }}>
                          <span style={{ minWidth: 50 }}>note</span>
                          <span style={{ flex: 1 }}>{d.dayNote}</span>
                        </div>
                      ) : null}
                      {evs === undefined && (<div style={{ ...styles.evRow, color: C.inkFaint }}>…</div>)}
                      {evs && evs.length === 0 && (<div style={{ ...styles.evRow, color: C.inkFaint }}>no entries</div>)}
                      {evs && [...evs].sort((x, y) => (x.ts < y.ts ? -1 : 1)).map((e) => (
                        <div key={e.id} style={styles.evRow}>
                          <span style={{ color: C.inkFaint, minWidth: 50 }}>{e.timeUnknown ? "?" : fmtTime(e.ts)}</span>
                          <span style={{ minWidth: 26 }}>{e.type === "build" ? "+" : "−"}{e.amount}</span>
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
      @import url('https://fonts.googleapis.com/css2?family=Silkscreen&display=swap');
      * { box-sizing: border-box; }
      button { font: inherit; cursor: pointer; border: none; background: none; color: inherit; }
      button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
      input:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 1px; }
      .pxbtn { box-shadow: 3px 3px 0 ${C.line}; }
      .pxbtn:active { transform: translate(3px, 3px); box-shadow: 0 0 0 ${C.line}; }
      .seclabel::before {
        content: "";
        display: inline-block;
        width: 7px; height: 7px;
        margin-right: 8px;
        background: ${C.ink};
        vertical-align: middle;
      }
      @media (prefers-reduced-motion: reduce) {
        .pxbtn:active { transform: none; }
      }
    `}</style>
  );
}

const MONO = '"Silkscreen", ui-monospace, monospace';

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
  entryTime: {
    color: C.inkSoft,
    minWidth: 48,
    textAlign: "left",
    textDecoration: "underline",
    minHeight: 28,
  },
  timeEditRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0 12px",
  },
  timeInput: {
    padding: "10px 12px",
    borderRadius: 0,
    border: `1px solid ${C.line}`,
    background: C.surface,
    fontSize: 14,
    color: C.ink,
    fontFamily: MONO,
  },
  dayNoteShow: {
    maxWidth: 320,
    marginTop: 8,
    fontSize: 13,
    color: C.inkSoft,
    fontStyle: "italic",
    textAlign: "center",
  },
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
    border: `1px solid #BBBBC6`,
    background: C.surfaceDim,
    fontSize: 22,
    color: C.inkSoft,
    boxShadow: `2px 2px 0 #C8D2D8`,
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
    border: `1px solid #BBBBC6`,
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
    border: `1px solid #BBBBC6`,
    background: C.surfaceDim,
    color: C.ink,
    fontSize: 13,
    boxShadow: `2px 2px 0 #C8D2D8`,
  },
  skipBtn: {
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 0,
    border: `1px solid ${C.line}`,
    background: C.surface,
    color: C.inkSoft,
    fontSize: 13,
    boxShadow: `2px 2px 0 #C8D2D8`,
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
  exportHint: { fontSize: 13, color: C.inkSoft, lineHeight: 1.5, margin: "6px 0 18px" },
  exportQuick: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  exportBtn: {
    flex: "1 1 40%",
    minHeight: 46,
    padding: "0 14px",
    background: C.surface,
    border: `1px solid #BBBBC6`,
    borderRadius: 0,
    fontSize: 14,
    color: C.ink,
    cursor: "pointer",
    boxShadow: `2px 2px 0 #C8D2D8`,
  },
  exportCustom: { marginBottom: 22 },
  exportDates: { display: "flex", gap: 12, margin: "10px 0 12px" },
  exportDateLabel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12,
    color: C.inkSoft,
  },
  dateInput: {
    fontFamily: MONO,
    fontSize: 14,
    padding: "8px 6px",
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 0,
    color: C.ink,
  },
  exportFull: {
    width: "100%",
    minHeight: 46,
    background: C.surfaceDim,
    border: `1px solid #BBBBC6`,
    borderRadius: 0,
    fontSize: 14,
    color: C.ink,
    cursor: "pointer",
    boxShadow: `2px 2px 0 #C8D2D8`,
  },
  countStep: { display: "flex", flexDirection: "column", alignItems: "center", gap: 22, paddingBottom: 10 },
  sheetTitle: { fontSize: 16, color: C.ink, marginTop: 4 },
  quickRow: { display: "flex", gap: 10 },
  quick: (on) => ({
    width: 50,
    height: 50,
    borderRadius: 0,
    border: `1px solid #BBBBC6`,
    background: on ? C.surfaceDim : C.surface,
    fontSize: 18,
    color: C.ink,
    boxShadow: `2px 2px 0 #C8D2D8`,
  }),
  next: {
    minHeight: 50,
    padding: "0 24px",
    background: C.surface,
    border: `1px solid #BBBBC6`,
    borderRadius: 0,
    fontSize: 15,
    color: C.ink,
    boxShadow: `2px 2px 0 #C8D2D8`,
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
    border: `1px solid #BBBBC6`,
    borderRadius: 0,
    fontSize: 14,
    color: C.ink,
    boxShadow: `2px 2px 0 #C8D2D8`,
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
    border: `1px solid #BBBBC6`,
    background: on ? C.surfaceDim : C.surface,
    color: on ? C.ink : C.inkSoft,
    fontSize: 12,
    borderRadius: 0,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    boxShadow: `2px 2px 0 #C8D2D8`,
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
  obs: { fontSize: 14, color: C.ink, lineHeight: 1.5, margin: "0 0 8px" },
  catRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
    fontSize: 13,
  },
  catName: { width: 120, flexShrink: 0, color: C.ink },
  catBarWrap: {
    flex: 1,
    height: 12,
    border: `1px solid ${C.line}`,
    background: C.surface,
  },
  catBar: { height: "100%" },
  catVal: { width: 28, textAlign: "right", color: C.inkSoft },
};
