import * as THREE from "three";
import { languageColor } from "../../lib/languageColor";
import { monthName, type SkyDay, type SkyModel } from "./days";
import { BG_FRAG, BG_VERT, DOME_FRAG, DOME_VERT, LINE_FRAG, LINE_VERT, REFL_FRAG, STAR_FRAG, STAR_VERT, WATER } from "./shaders";

/* "Your sky": every day the learner spoke a language is a star, and each month
   of each language is one constellation on a real-feeling night over the
   harbour. The sky turns about the pole: this month stands high in the south,
   last month sinks into the west, older months set behind the hills. Dragging
   (or scrolling) turns back through time. One language is in focus at a time,
   coloured, joined and named; the others are faint background stars.

   Client only; SkyView loads this with import() so three.js stays off Home.
   React owns the chrome (top bar, readout, stats, chips, day card); this
   module owns the canvas plus the per-frame overlay inside `root`: month
   names, the hover tip, the words that orbit an open day, and one real
   button per visible star for keyboards and screen readers. */

export type SkyReadout = { title: string; sub: string; away: boolean };
export type SkyFonts = { latin: string; ja: string; ko: string; cyrillic: string }; // CSS font-family lists
export type SkyEvents = {
  onReadout: (r: SkyReadout) => void;
  onOpenDay: (day: SkyDay | null) => void;
};
export type SkyScene = {
  webgl: boolean;
  setModel: (m: SkyModel) => void;
  setFocus: (f: number | "all") => void;
  toTonight: () => void;
  closeDay: () => void;
  dispose: () => void;
};

// The sky's geometry: latitude, radians of turn per month, how much of a month a constellation spans.
const RAD = 150, LAT = 1.1, SPM = 0.61, WM = 0.72, FOCUS_DEC = 0.05;
const Q0 = new THREE.Vector3(0, Math.cos(LAT), -Math.sin(LAT)), PL = new THREE.Vector3(0, Math.sin(LAT), Math.cos(LAT));
// looking south-west: this month high on the left, the months before it sinking to the right
const VIEW = { wide: { az: 0.36, el: 0.36, fov: 52 }, tall: { az: 0.28, el: 0.34, fov: 80 } };
const CYRILLIC = new Set(["ru", "uk", "bg", "sr", "mk", "be", "kk", "ky", "mn", "tg", "tt", "ba", "cv", "ce", "os", "kv", "av"]);

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const daysIn = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const dirPt = (az: number, el: number, r: number, out = new THREE.Vector3()) => out.set(r * Math.sin(az) * Math.cos(el), r * Math.sin(el), -r * Math.cos(az) * Math.cos(el));
// a language's band: 0, then alternately south and north of it
const bandOf = (lang: number) => (lang % 2 ? -1 : 1) * Math.ceil(lang / 2) * 0.16;
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });

type Star = { day: SkyDay; i: number; ra: number; dec: number; r: number; pos: THREE.Vector3; ext: number; az: number; el: number; btn?: HTMLButtonElement; shown: boolean };
type Group = { lang: number; m: number; abs: number; n: number; ra: number; dec: number; el?: HTMLDivElement; o: number; x: number; y: number; a: number };
type Cam = Record<"tx" | "ty" | "tz" | "dist" | "yaw" | "pitch" | "fov" | "ox" | "oy", number>;
const KEYS = ["tx", "ty", "tz", "dist", "yaw", "pitch", "fov", "ox", "oy"] as const;

export function createSkyScene(root: HTMLElement, first: SkyModel, startFocus: number | "all", fonts: SkyFonts, ev: SkyEvents): SkyScene {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // a canvas of its own: a remount gets a fresh WebGL context instead of a lost one
  const canvas = document.createElement("canvas");
  canvas.className = "sky-gl";
  canvas.setAttribute("aria-hidden", "true");
  root.prepend(canvas);
  const lblBox = root.querySelector<HTMLDivElement>(".sky-lbls")!;
  const wordsBox = root.querySelector<HTMLDivElement>(".sky-words")!;
  const tip = root.querySelector<HTMLDivElement>(".sky-tip")!;
  const btnBox = root.querySelector<HTMLDivElement>(".sky-btns")!;
  const offs: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, o?: AddEventListenerOptions) => {
    t.addEventListener(type, fn as EventListener, o);
    offs.push(() => t.removeEventListener(type, fn as EventListener, o));
  };

  let W = root.clientWidth || innerWidth, H = root.clientHeight || innerHeight;
  let PHONE = W < 720;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) throw new Error("no context");
  } catch {
    renderer = null;
  }
  if (!renderer) {
    canvas.remove();
    return { webgl: false, setModel() {}, setFocus() {}, toTonight() {}, closeDay() {}, dispose() {} };
  }
  const gl = renderer;
  const LOW = PHONE || (navigator.hardwareConcurrency || 8) <= 4;

  const U = { uTime: { value: 0 }, uTw: { value: RM ? 0 : 1 }, uPR: { value: 1 }, uT: { value: 0 }, uS: { value: SPM }, uLat: { value: LAT }, uDec: { value: 0 }, uTint: { value: 0 } };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 3000);
  const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
      uniforms: { ...U, uZen: { value: hex("#020a0f") }, uMid: { value: hex("#0d2a30") }, uHor: { value: hex("#53505b") }, uSea: { value: hex("#03121a") }, uSunDir: { value: new THREE.Vector3(0.42, 0.06, -1).normalize() }, uOct: { value: LOW ? 2 : 4 } },
    })
  );
  dome.renderOrder = -10;
  scene.add(dome);

  // faint background stars over the whole sphere; they turn with the sky
  {
    const n = LOW ? 1800 : 3600, R = rng(5), P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 3), D = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      P.set([(R() * Math.PI * 2) / SPM, Math.asin(lerp(-0.6, 0.995, R())), 900], i * 3);
      S[i] = 0.9 + Math.pow(R(), 4) * 2.4; D[i] = R();
      const w = R(); C.set(w < 0.15 ? [1, 0.86, 0.7] : w < 0.5 ? [0.78, 0.9, 1] : [0.92, 0.95, 0.96], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("aS", new THREE.BufferAttribute(S, 1));
    g.setAttribute("aC", new THREE.BufferAttribute(C, 3)); g.setAttribute("aD", new THREE.BufferAttribute(D, 1));
    const bg = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, vertexShader: BG_VERT, fragmentShader: BG_FRAG }));
    bg.frustumCulled = false; bg.renderOrder = -5; scene.add(bg);
  }

  const SU = { ...U, uHover: { value: -1 }, uSel: { value: -1 } };
  const starMat = new THREE.ShaderMaterial({ uniforms: SU, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const reflMat = new THREE.ShaderMaterial({ uniforms: SU, defines: { MIR: 1 }, vertexShader: STAR_VERT, fragmentShader: REFL_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const starPts = new THREE.Points(new THREE.BufferGeometry(), starMat);
  const reflPts = new THREE.Points(starPts.geometry, reflMat);
  starPts.frustumCulled = reflPts.frustumCulled = false;
  scene.add(starPts, reflPts);
  const LU = { ...U, uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: 1.1 }, uGap: { value: 9 } };
  const lines = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: LU, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG }));
  lines.frustumCulled = false; lines.renderOrder = 1; scene.add(lines);

  /* ---------- model -> stars, constellations and month names ---------- */
  let model = first, stars: Star[] = [], groups: Group[] = [], M0 = 0, M = 0, tNow = 0, T_MIN = 0;
  let focus: number | "all" = startFocus, LF: number[] = [], tint = startFocus === "all" ? 1 : 0, decOff = 0;
  let segs: [Star, Star][] = [], aDim: THREE.BufferAttribute | null = null, aSize: THREE.BufferAttribute | null = null, lDim: THREE.BufferAttribute | null = null;
  const starSize = (s: Star) => Math.max(s.day.key === model.today ? (PHONE ? 20 : 24) : 0, (PHONE ? 7 : 9) + Math.min(s.day.minutes, 30) * (PHONE ? 0.55 : 0.7));
  const hand = (lang: number) => {
    const code = model.langs[lang]?.code ?? "en";
    if (code === "ja" || code === "zh") return `600 0.82em ${fonts.ja}`;
    if (code === "ko") return `1.08em ${fonts.ko}`;
    if (CYRILLIC.has(code)) return `500 1.1em ${fonts.cyrillic}`;
    return `1em ${fonts.latin}`;
  };
  const decGoal = () => {
    if (focus !== "all") return FOCUS_DEC - bandOf(focus);
    const n = Math.max(1, model.langs.length);
    let s = 0; for (let i = 0; i < n; i++) s += bandOf(i);
    return FOCUS_DEC - s / n;
  };

  function build() {
    M0 = model.days.length ? Math.min(...model.days.map((d) => d.month)) : model.thisMonth;
    M = model.thisMonth - M0;
    stars = model.days.map((day, i) => ({ day, i, ra: 0, dec: 0, r: RAD, pos: new THREE.Vector3(), ext: 0, az: 0, el: 0, shown: false }));
    // each month of each language is one constellation: a gentle winding run of its days
    const by = new Map<string, Star[]>();
    for (const s of stars) { const k = `${s.day.lang}:${s.day.month}`; if (!by.has(k)) by.set(k, []); by.get(k)!.push(s); }
    groups = [];
    for (const list of by.values()) {
      const { lang, month: abs } = list[0].day, m = abs - M0, R = rng(lang * 7919 + abs * 31 + 17);
      const cyc = 0.75 + R() * 0.9, ph = R() * 6.283, amp = 0.045 + R() * 0.035, tilt = (R() - 0.5) * 0.1;
      const base = bandOf(lang) + 0.025 * Math.sin(abs * 1.7 + lang * 2);
      for (const s of list) {
        const J = rng(lang * 104729 + s.day.key), f = (s.day.date.getDate() - 0.5) / daysIn(s.day.date);
        s.ra = m + (f - 0.5) * WM + (J() - 0.5) * 0.035;
        s.dec = base + amp * Math.sin(f * Math.PI * 2 * cyc + ph) + tilt * (f - 0.5) + (J() - 0.5) * 0.045;
        s.r = RAD + (J() - 0.5) * 26;
      }
      groups.push({ lang, m, abs, n: list.filter((s) => !s.day.pending).length, ra: list.reduce((a, s) => a + s.ra, 0) / list.length, dec: Math.max(...list.map((s) => s.dec)) + 0.055, o: -1, x: 0, y: 0, a: 0 });
    }
    const tonight = stars.find((s) => s.day === model.tonight);
    tNow = tonight ? tonight.ra + 0.1 : M;
    T_MIN = Math.min(tNow, -0.3);
    LF = model.langs.map((_, i) => (focus === i ? 1 : 0));

    // geometry: position = (ra, dec, radius); the shaders turn it with the sky
    const n = stars.length, g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), seed = new Float32Array(n), idx = new Float32Array(n), tod = new Float32Array(n);
    const sz = new Float32Array(n), dim = new Float32Array(n);
    stars.forEach((s, i) => {
      P.set([s.ra, s.dec, s.r], i * 3); C.set(languageColor(s.day.lang), i * 3);
      sz[i] = starSize(s); dim[i] = LF[s.day.lang]; seed[i] = (i * 0.6180339) % 1; idx[i] = i;
      tod[i] = s.day.pending ? 2 : s.day === model.tonight ? 1 : 0;
    });
    const at = (geo: THREE.BufferGeometry, name: string, arr: Float32Array, k: number) => { const a = new THREE.BufferAttribute(arr, k); geo.setAttribute(name, a); return a; };
    at(g, "position", P, 3); aSize = at(g, "aSize", sz, 1); at(g, "aCol", C, 3); aDim = at(g, "aDim", dim, 1);
    at(g, "aSeed", seed, 1); at(g, "aIdx", idx, 1); at(g, "aToday", tod, 1);
    starPts.geometry.dispose(); starPts.geometry = g; reflPts.geometry = g;

    // the streak in the sky: days in a row are joined firmly, a missed day only faintly
    segs = [];
    const weights: number[] = [];
    model.langs.forEach((_, L) => {
      const list = stars.filter((s) => s.day.lang === L);
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i], gap = b.day.key - a.day.key;
        if (a.day.month === b.day.month && gap <= 4) { segs.push([a, b]); weights.push(gap === 1 && !b.day.pending ? 1 : 0.24); }
      }
    });
    const NV = segs.length * 4, lg = new THREE.BufferGeometry();
    const lPos = new Float32Array(NV * 3), lOth = new Float32Array(NV * 3), lSide = new Float32Array(NV), lEnd = new Float32Array(NV), lCol = new Float32Array(NV * 3), lD = new Float32Array(NV), ix: number[] = [];
    segs.forEach(([a, b], k) => {
      const col = languageColor(a.day.lang).map((c) => (c + (1 - c) * 0.08) * weights[k]);
      for (let v = 0; v < 4; v++) {
        const j = k * 4 + v, me = v < 2 ? a : b, ot = v < 2 ? b : a;
        lPos.set([me.ra, me.dec, me.r], j * 3); lOth.set([ot.ra, ot.dec, ot.r], j * 3);
        lSide[j] = v & 1 ? 1 : -1; lEnd[j] = v < 2 ? 0 : 1; lCol.set(col, j * 3); lD[j] = LF[a.day.lang];
      }
      ix.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 2, k * 4 + 1, k * 4 + 3);
    });
    lg.setIndex(ix);
    at(lg, "position", lPos, 3); at(lg, "aOther", lOth, 3); at(lg, "aSide", lSide, 1); at(lg, "aEnd", lEnd, 1); at(lg, "aCol", lCol, 3);
    lDim = at(lg, "aDim", lD, 1);
    lines.geometry.dispose(); lines.geometry = lg;

    buildButtons();
    buildLabels();
    decOff = U.uDec.value = decGoal();
  }

  // one real button per star, in date order; only stars up in the sky are reachable
  function buildButtons() {
    btnBox.replaceChildren();
    for (const s of stars) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "sky-sb"; b.hidden = true;
      const l = model.langs[s.day.lang];
      b.setAttribute("aria-label", `${fmtDay(s.day.date)}, ${l.native}, ${s.day.pending ? "tonight, not spoken yet" : `${s.day.minutes} minutes`}`);
      b.addEventListener("click", () => openStar(s.i));
      b.addEventListener("focus", () => setHover(s.i));
      b.addEventListener("blur", () => { if (hover === s.i) setHover(-1); });
      btnBox.appendChild(b); s.btn = b; s.shown = false;
    }
  }

  // each month is named in its own language and its own hand; names appear once their fonts are in
  function buildLabels() {
    lblBox.replaceChildren();
    const year = new Date().getFullYear();
    for (const g of groups) {
      const l = model.langs[g.lang], el = document.createElement("div"), yr = Math.floor(g.abs / 12);
      el.className = "sky-lbl";
      el.style.color = `rgb(${languageColor(g.lang).map((v) => Math.round(v * 255)).join(" ")})`;
      const name = document.createElement("span");
      name.lang = l.code; name.textContent = monthName(l.code, g.abs); name.style.font = hand(g.lang);
      const sub = document.createElement("small");
      sub.textContent = `${g.n ? `${g.n} ${g.n === 1 ? "day" : "days"}` : "tonight"}${yr !== year ? `, ${yr}` : ""}`;
      el.append(name, sub);
      lblBox.appendChild(el); g.el = el; g.o = -1;
    }
    lblBox.style.opacity = "0";
    const loads = model.langs.map((_, i) => document.fonts?.load(hand(i).replace(/[\d.]+em/, "27px"), monthName(model.langs[i].code, 8)) ?? Promise.resolve());
    Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]).finally(() => { lblBox.style.opacity = "1"; });
  }

  const tmpD = new THREE.Vector3();
  function skyDir(ra: number, dec: number, t: number, out: THREE.Vector3) {
    dec += decOff;
    const h = (t - ra) * SPM, cd = Math.cos(dec);
    return out.set(cd * Math.sin(h), 0, 0).addScaledVector(Q0, cd * Math.cos(h)).addScaledVector(PL, Math.sin(dec));
  }
  const hillAt = (d: THREE.Vector3) => { const a = Math.atan2(d.x, -d.z); return 0.012 + 0.009 * Math.sin(a * 4 + 1.3) + 0.006 * Math.sin(a * 11 + 2) + 0.003 * Math.sin(a * 29); };
  function extinct(d: THREE.Vector3, h: number) { if (Math.abs(h) > 2.1) return 0; const hl = hillAt(d); return smooth(hl + 0.004, hl + 0.05, d.y) * lerp(0.38, 1, smooth(0, 0.35, d.y)); }
  function updateWorld(t: number) {
    for (const s of stars) {
      skyDir(s.ra, s.dec, t, tmpD);
      s.ext = extinct(tmpD, (t - s.ra) * SPM);
      s.az = Math.atan2(tmpD.x, -tmpD.z); s.el = Math.asin(clamp(tmpD.y, -1, 1));
      s.pos.copy(tmpD).multiplyScalar(s.r);
    }
  }

  /* ---------- camera: a target, an orbit around it, springs toward a goal ---------- */
  const cur = {} as Cam, vel = {} as Cam, goal = {} as Cam;
  KEYS.forEach((k) => { vel[k] = 0; });
  let omega = 6, clampBase = { yaw: 0, pitch: 0 };
  const G = () => VIEW[PHONE ? "tall" : "wide"];
  function viewAt(az: number, el: number, dist: number, fov: number, ox = 0, oy = 0): Cam {
    const T = dirPt(az, el, RAD);
    return { tx: T.x, ty: T.y, tz: T.z, dist, yaw: -az, pitch: el, fov, ox, oy };
  }
  function overview(): Cam {
    const v = G();
    if (!PHONE || !stars.length) return viewAt(v.az, v.el, RAD, v.fov);
    // a phone sees about one month across: aim between the newest star of the language in
    // focus and the middle of the month before it, so this month and part of last show
    const L = focus === "all" ? model.focus : focus, mine = stars.filter((s) => s.day.lang === L);
    const last = mine[mine.length - 1];
    if (!last) return viewAt(v.az, v.el, RAD, v.fov);
    const prev = mine.filter((s) => s.day.month === last.day.month - 1);
    const azAt = (s: Star) => { skyDir(s.ra, s.dec, tNow, tmpD); return Math.atan2(tmpD.x, -tmpD.z); };
    const a0 = azAt(last), a1 = prev.length ? prev.reduce((a, s) => a + azAt(s), 0) / prev.length : a0 + 0.2;
    return viewAt(lerp(a0, a1, 0.45), v.el, RAD, v.fov);
  }
  const setGoal = (v: Cam, w?: number) => { Object.assign(goal, v); if (w) omega = w; clampBase = { yaw: goal.yaw, pitch: goal.pitch }; };
  const snapTo = (v: Cam) => { setGoal(v); Object.assign(cur, v); KEYS.forEach((k) => { vel[k] = 0; }); };
  function stepSprings(dt: number) {
    if (RM) { Object.assign(cur, goal); return; }
    const n = Math.ceil(dt / 0.016);
    for (let s = 0; s < n; s++) { const h = dt / n; for (const k of KEYS) { const a = omega * omega * (goal[k] - cur[k]) - 2 * omega * vel[k]; vel[k] += a * h; cur[k] += vel[k] * h; } }
  }
  function applyCam() {
    camera.fov = cur.fov; camera.aspect = W / Math.max(1, H);
    const cp = Math.cos(cur.pitch);
    camera.position.set(cur.tx + cur.dist * Math.sin(cur.yaw) * cp, cur.ty - cur.dist * Math.sin(cur.pitch), cur.tz + cur.dist * Math.cos(cur.yaw) * cp);
    camera.lookAt(cur.tx, cur.ty, cur.tz);
    camera.setViewOffset(W, H, cur.ox, cur.oy, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    dome.position.copy(camera.position);
  }

  function resize() {
    W = root.clientWidth || innerWidth; H = root.clientHeight || innerHeight;
    const ph = W < 720;
    if (ph !== PHONE) {
      PHONE = ph;
      if (aSize) { stars.forEach((s, i) => { aSize!.array[i] = starSize(s); }); aSize.needsUpdate = true; }
      if (opened >= 0) openStar(opened, true); else snapTo(overview());
    }
    const pr = Math.min(devicePixelRatio || 1, LOW ? 1.5 : 1.75);
    gl.setPixelRatio(pr); gl.setSize(W, H, false);
    U.uPR.value = pr;
    LU.uRes.value.set(W * pr, H * pr);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(root);

  /* ---------- turning ---------- */
  let tTarget = 0, tVel = 0, turnDrag = false, enter = RM ? -1 : 0;
  const turnTo = (t: number) => { tTarget = clamp(t, T_MIN, tNow); tVel = 0; };
  let readKey = "";
  function readout(t: number) {
    // an empty sky has no months to turn back to
    const away = model.days.length > 0 && Math.abs(t - tNow) > 0.3;
    let title = "Tonight", sub = model.days.length ? (PHONE ? "Swipe the sky to go back in time" : "Drag the sky to turn back through your months") : "";
    if (away) {
      const mi = clamp(Math.round(t), 0, M), gs = groups.filter((g) => g.m === mi);
      title = new Date(Math.floor((mi + M0) / 12), (mi + M0) % 12, 15).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      if (focus === "all") {
        const n = gs.reduce((a, g) => a + g.n, 0);
        sub = n ? `${n} days spoken across ${gs.length} ${gs.length === 1 ? "language" : "languages"}` : "A quiet month";
      } else {
        const g = gs.find((g) => g.lang === focus), name = model.langs[focus].native;
        sub = g && g.n ? `${g.n} ${g.n === 1 ? "day" : "days"} in ${name}` : `No ${name} this month`;
      }
    }
    const key = `${title}|${sub}|${away}`;
    if (key !== readKey) { readKey = key; ev.onReadout({ title, sub, away }); }
  }

  /* ---------- open a day ---------- */
  let opened = -1, hover = -1, savedView: Cam | null = null;
  let wordNodes: { el: HTMLDivElement; th: number; rr: number; delay: number }[] = [];
  let wordBasis: { c: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; fwd: THREE.Vector3; R: number } | null = null, wordT0 = 0;
  function openStar(i: number, instant = false) {
    const s = stars[i];
    if (opened < 0 && !instant) savedView = { ...goal };
    opened = i; SU.uSel.value = i; hideTip();
    tTarget = U.uT.value; tVel = 0; // the sky holds still while a day is open
    const pw = PHONE ? 0 : 418, sheet = PHONE ? Math.min(H * 0.5, 440) : 0, dist = PHONE ? 36 : 26;
    const v = viewAt(s.az, s.el, dist, G().fov, pw / 2, sheet / 2);
    v.tx = s.pos.x; v.ty = s.pos.y; v.tz = s.pos.z;
    if (instant) snapTo(v); else setGoal(v, 2.5);
    if (!instant) ev.onOpenDay(s.day);
    // the day's words drift around its star on a slow tilted ellipse that faces the camera
    wordsBox.replaceChildren();
    const fwd = s.pos.clone().normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const ppu = H / (2 * dist * Math.tan((G().fov * Math.PI) / 360));
    const Rpx = PHONE ? Math.min(W * 0.34, (H - sheet) * 0.3) : Math.min(235, (W - pw) * 0.27);
    wordBasis = { c: s.pos.clone(), right, up, fwd, R: Rpx / ppu };
    wordT0 = performance.now() / 1000;
    const l = model.langs[s.day.lang], words = s.day.words.slice(0, 5), glow = languageColor(s.day.lang).map((c) => Math.round(c * 230)).join(",");
    wordNodes = words.map((w, k) => {
      const el = document.createElement("div");
      el.className = "sky-word"; el.lang = l.code; el.textContent = w;
      el.style.textShadow = `0 0 14px rgba(${glow},.55),0 0 34px rgba(${glow},.25)`;
      wordsBox.appendChild(el);
      return { el, th: -Math.PI / 2 + (k * Math.PI * 2) / words.length + 0.35, rr: 1 + (k % 2 ? 0.12 : -0.06), delay: 0.55 + k * 0.14 };
    });
  }
  function closeStar(quiet = false) {
    if (opened < 0) return;
    const i = opened;
    opened = -1; SU.uSel.value = -1;
    const gone = wordNodes; wordNodes = [];
    gone.forEach((n) => { n.el.style.transition = "opacity .35s"; n.el.style.opacity = "0"; });
    setTimeout(() => gone.forEach((n) => n.el.remove()), 400);
    if (!quiet) { setGoal(savedView || overview(), 2.4); stars[i]?.btn?.focus({ preventScroll: true }); }
    ev.onOpenDay(null);
  }

  /* ---------- pointer: drag turns the sky, with a heavy, real-feeling inertia ---------- */
  const ptrs = new Map<number, { x: number; y: number }>();
  let dragged = false, downAt = { x: 0, y: 0 }, vYaw = 0, vPitch = 0, pinch0 = 0, lastMove = 0;
  const tmp = new THREE.Vector3(), sp = { x: 0, y: 0, z: 0 };
  function toScreen(p: THREE.Vector3) { tmp.copy(p).project(camera); sp.x = ((tmp.x + 1) / 2) * W; sp.y = ((1 - tmp.y) / 2) * H; sp.z = tmp.z; return sp; }
  const pickable = (s: Star) => focus === "all" || s.day.lang === focus;
  function pick(x: number, y: number, touch: boolean) {
    const r0 = root.getBoundingClientRect();
    x -= r0.left; y -= r0.top;
    let best = -1, bd = 1e9;
    for (const s of stars) {
      if (!pickable(s) || s.ext < 0.15) continue;
      toScreen(s.pos); if (sp.z > 1) continue;
      const d = Math.hypot(sp.x - x, sp.y - y);
      if (d < (touch ? 26 : 18) && d < bd) { bd = d; best = s.i; }
    }
    return best;
  }
  function setHover(h: number) {
    if (h === hover) return;
    hover = h; SU.uHover.value = h; canvas.classList.toggle("hot", h >= 0);
    if (h >= 0 && h !== opened) {
      const s = stars[h];
      tip.firstChild!.textContent = fmtDay(s.day.date);
      tip.lastChild!.textContent = `${model.langs[s.day.lang].native}, ${s.day.pending ? "waiting for tonight" : `${s.day.minutes} minutes`}`;
      tip.classList.add("on");
    } else hideTip();
  }
  const hideTip = () => tip.classList.remove("on");
  const zoomBy = (f: number) => { goal.dist = clamp(goal.dist * f, opened >= 0 ? 12 : 60, opened >= 0 ? 60 : RAD + 20); omega = Math.max(omega, 6); };
  function clampGoal() {
    const yr = opened >= 0 ? 0.9 : 0.05;
    goal.yaw = clamp(goal.yaw, clampBase.yaw - yr, clampBase.yaw + yr);
    goal.pitch = clamp(goal.pitch, Math.max(-0.05, clampBase.pitch - (opened >= 0 ? 0.6 : 0.14)), clampBase.pitch + (opened >= 0 ? 0.6 : 0.2));
  }
  on(canvas, "pointerdown", (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { dragged = false; downAt = { x: e.clientX, y: e.clientY }; vYaw = vPitch = tVel = 0; omega = 7; enter = -1; }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dragged = true; }
  });
  on(canvas, "pointermove", (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === "mouse") setHover(pick(e.clientX, e.clientY, false)); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) zoomBy(pinch0 / d); pinch0 = d; return; }
    if (!dragged && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { dragged = true; canvas.classList.add("drag"); setHover(-1); }
    if (!dragged) return;
    const now = performance.now(), dtm = Math.max(8, now - lastMove);
    lastMove = now;
    if (opened >= 0) {
      const k = (goal.fov / 46) * 0.006;
      goal.yaw -= dx * k; goal.pitch += dy * k; vYaw = (-dx * k / dtm) * 1000; vPitch = (dy * k / dtm) * 1000; clampGoal();
      return;
    }
    // the stars follow the finger; past tonight or the first month the sky resists
    turnDrag = true;
    let dm = (dx * (camera.fov * Math.PI) / 180 / H) / SPM;
    if ((tTarget > tNow && dm > 0) || (tTarget < T_MIN && dm < 0)) dm *= 0.3;
    tTarget += dm; tVel = (dm / dtm) * 1000;
    goal.pitch += dy * (goal.fov / 46) * 0.0024; clampGoal();
  });
  const endPtr = (e: PointerEvent) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); canvas.classList.remove("drag");
    if (ptrs.size) return;
    turnDrag = false;
    if (performance.now() - lastMove > 90) vYaw = vPitch = tVel = 0;
    if (!dragged) {
      const h = pick(e.clientX, e.clientY, e.pointerType !== "mouse");
      if (h >= 0) openStar(h); else if (opened >= 0) closeStar();
    }
  };
  on(canvas, "pointerup", endPtr);
  on(canvas, "pointercancel", endPtr);
  on(canvas, "pointerleave", (e: PointerEvent) => { if (e.pointerType === "mouse" && !ptrs.size) setHover(-1); });
  on(canvas, "wheel", (e: WheelEvent) => {
    e.preventDefault(); enter = -1;
    if (e.ctrlKey || opened >= 0) { zoomBy(Math.exp(e.deltaY * 0.0012)); return; }
    // scroll down or swipe left goes back in time
    tTarget = clamp(tTarget - (e.deltaY + e.deltaX) * 0.0016, T_MIN - 0.25, tNow + 0.25); tVel = 0;
  }, { passive: false });
  on(window, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && opened >= 0) { closeStar(); return; }
    const t = e.target as HTMLElement | null;
    if (opened >= 0 || t?.closest?.("input,textarea,[role=group].sky-chips")) return;
    if (e.key === "ArrowLeft") { enter = -1; turnTo(Math.round(tTarget) - 1); e.preventDefault(); }
    if (e.key === "ArrowRight") { enter = -1; const n = Math.round(tTarget) + 1; turnTo(n >= Math.round(tNow) ? tNow : n); e.preventDefault(); }
  });

  /* ---------- overlay: month names, tooltip, orbiting words, focus targets ---------- */
  const lp = new THREE.Vector3(), wp = new THREE.Vector3();
  const place = (el: HTMLElement, x: number, y: number) => { el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`; };
  function overlay(time: number, t: number) {
    const zoomed = cur.dist < 90 || opened >= 0;
    // where each name would sit, and how much the sky lets it show
    let near: Group | null = null, nearD = 1e9;
    for (const g of groups) {
      skyDir(g.ra, g.dec, t, lp);
      const ext = extinct(lp, (t - g.ra) * SPM);
      toScreen(lp.multiplyScalar(RAD));
      g.x = sp.x; g.y = sp.y;
      g.a = zoomed || sp.z > 1 || sp.x < -200 || sp.x > W + 200 ? 0 : smooth(0.12, 0.55, ext) * (LF[g.lang] ?? 0) * 0.92;
      const d = Math.abs(sp.x - W / 2);
      if (g.a > 0.3 && g.lang === focus && d < nearD) { nearD = d; near = g; }
    }
    for (const g of groups) {
      let o = g.a;
      // on a phone only the constellation nearest the middle is named; the next names itself as it turns in
      if (PHONE && g !== near) o *= 1 - smooth(W * 0.12, W * 0.3, Math.abs(g.x - W / 2));
      const top = Math.abs(g.x - W / 2) < (PHONE ? W : 230) ? (PHONE ? 190 : 165) : 115; // the readout and its button
      o *= smooth(top - 30, top, g.y) * (1 - smooth(H - (PHONE ? 230 : 190), H - (PHONE ? 180 : 140), g.y)); // never under the controls
      if (o > 0.005 && g.el) place(g.el, g.x, g.y);
      const q = Math.round(o * 100);
      if (q !== g.o && g.el) { g.o = q; g.el.style.opacity = o.toFixed(2); }
    }
    if (hover >= 0 && tip.classList.contains("on")) { toScreen(stars[hover].pos); tip.style.transform = `translate3d(${(sp.x + 16).toFixed(1)}px,${(sp.y - 46).toFixed(1)}px,0)`; }
    for (const s of stars) {
      const show = s.ext > 0.15 && pickable(s);
      if (show !== s.shown && s.btn) { s.shown = show; s.btn.hidden = !show; }
      if (show && s.btn) { toScreen(s.pos); s.btn.style.transform = `translate3d(${sp.x.toFixed(1)}px,${sp.y.toFixed(1)}px,0)`; }
    }
    if (wordNodes.length && wordBasis) {
      const B = wordBasis, el0 = time - wordT0;
      for (const n of wordNodes) {
        const th = n.th + (RM ? 0 : el0 * 0.045), R = B.R * n.rr;
        wp.copy(B.c).addScaledVector(B.right, Math.cos(th) * R).addScaledVector(B.up, Math.sin(th) * R * 0.62).addScaledVector(B.fwd, Math.sin(th) * R * 0.5);
        toScreen(wp);
        const depth = 0.5 + 0.5 * Math.sin(th), a = RM ? 1 : smooth(n.delay, n.delay + 0.8, el0);
        n.el.style.opacity = (a * lerp(1, 0.55, depth)).toFixed(3);
        n.el.style.transform = `translate3d(${sp.x.toFixed(1)}px,${sp.y.toFixed(1)}px,0) translate(-50%,-50%) scale(${lerp(1.04, 0.86, depth).toFixed(3)})`;
      }
    }
    readout(t);
  }

  /* ---------- loop ---------- */
  let raf = 0, last = performance.now(), T = 7.3;
  const ENTER_S = 2.2, enterFrom = () => tNow - 1.1;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); // the first frame's timestamp can predate setup
    last = now;
    if (!RM) T += dt;
    U.uTime.value = T;

    if (enter >= 0) {
      // opening the sky turns it up from the east into tonight's place
      enter = Math.min(1, enter + dt / ENTER_S);
      U.uT.value = tTarget = lerp(enterFrom(), tNow, ease(enter));
      if (enter >= 1) enter = -1;
    } else {
      if (opened < 0 && !turnDrag && !RM) {
        if (tVel) { tTarget += tVel * dt; tVel *= Math.exp(-dt * 2.2); if (Math.abs(tVel) < 0.004) tVel = 0; }
        if (tTarget > tNow) { tTarget = lerp(tTarget, tNow, 1 - Math.exp(-dt * 5)); if (tVel > 0) tVel *= Math.exp(-dt * 12); }
        if (tTarget < T_MIN) { tTarget = lerp(tTarget, T_MIN, 1 - Math.exp(-dt * 5)); if (tVel < 0) tVel *= Math.exp(-dt * 12); }
      }
      if (RM) tTarget = clamp(tTarget, T_MIN, tNow);
      U.uT.value = RM ? tTarget : lerp(U.uT.value, tTarget, 1 - Math.exp(-dt * 10));
    }

    // focus cross-fade (about 700 ms) and the sky's tilt toward the band in focus
    let dd = false;
    LF.forEach((v, L) => {
      const g = focus === L ? 1 : 0;
      if (v !== g) { LF[L] = RM || Math.abs(v - g) < 0.003 ? g : lerp(v, g, 1 - Math.exp(-dt * 5.5)); dd = true; }
    });
    if (dd && aDim && lDim) {
      stars.forEach((s, i) => { aDim!.array[i] = LF[s.day.lang]; });
      segs.forEach(([a], q) => (lDim!.array as Float32Array).fill(LF[a.day.lang], q * 4, q * 4 + 4));
      aDim.needsUpdate = lDim.needsUpdate = true;
    }
    const tg = focus === "all" ? 1 : 0;
    tint = RM ? tg : lerp(tint, tg, 1 - Math.exp(-dt * 5));
    U.uTint.value = tint;
    const dg = decGoal();
    if (decOff !== dg) { decOff = RM || Math.abs(decOff - dg) < 1e-4 ? dg : lerp(decOff, dg, 1 - Math.exp(-dt * 4)); U.uDec.value = decOff; }
    updateWorld(U.uT.value);

    if (opened >= 0 && !ptrs.size && (vYaw || vPitch) && !RM) {
      goal.yaw += vYaw * dt; goal.pitch += vPitch * dt; clampGoal();
      const f = Math.exp(-dt * 3.2); vYaw *= f; vPitch *= f;
      if (Math.abs(vYaw) + Math.abs(vPitch) < 1e-3) vYaw = vPitch = 0;
    }
    stepSprings(dt);
    applyCam();
    gl.render(scene, camera);
    overlay(now / 1000, U.uT.value);
  }

  build();
  resize();
  tTarget = U.uT.value = enter >= 0 ? enterFrom() : tNow;
  updateWorld(U.uT.value);
  snapTo(overview());
  raf = requestAnimationFrame(frame);

  return {
    webgl: true,
    setModel(m) {
      const wasOpen = opened >= 0;
      if (wasOpen) closeStar(true);
      const atTonight = Math.abs(tTarget - tNow) < 0.3;
      model = m;
      if (focus !== "all" && focus >= m.langs.length) focus = m.focus;
      build();
      if (atTonight) { if (enter < 0) tTarget = U.uT.value = tNow; } else tTarget = clamp(tTarget, T_MIN, tNow);
      updateWorld(U.uT.value);
      setGoal(overview(), 3);
    },
    setFocus(f) {
      if (opened >= 0) closeStar(true);
      focus = f; setHover(-1); readKey = "";
      if (PHONE && Math.abs(tTarget - tNow) < 0.3) setGoal(overview(), 2.6);
    },
    toTonight() { if (opened >= 0) closeStar(true); enter = -1; turnTo(tNow); setGoal(overview(), 3); },
    closeDay() { closeStar(); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      offs.forEach((f) => f());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      gl.dispose();
      gl.forceContextLoss();
      canvas.remove();
      lblBox.replaceChildren(); wordsBox.replaceChildren(); btnBox.replaceChildren();
    },
  };
}
