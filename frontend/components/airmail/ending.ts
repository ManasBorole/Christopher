import * as THREE from "three";
import { lin, type Card, type Uniforms } from "./flock";
import { clamp, lerp, rng, sm, smr } from "./math";
import { FONT, cv } from "./paper";
import { LINE_FRAG, LINE_VERT, REFLECT_FRAG, STAR_FRAG, STAR_VERT } from "./shaders";

/* The ending, one path: murmuration, harbour lights, the world was a postcard.
   Ending progress e (0..1):
     .00-.66 the flock folds into paper planes, chases the plane, then departs over a long window
             (some cross the view; a few stay aloft through the night)
     .38-.86 harbour lights: night falls, 183 lights come on, rise into a Gochi Hand constellation, strokes draw in */

type Key = [number, THREE.Vector3, THREE.Vector3];
export type EndingEnv = {
  scene: THREE.Scene;
  shared: Uniforms;
  camera: THREE.PerspectiveCamera;
  camR: THREE.Vector3; // camera right/up, refreshed by the flock each frame
  camU: THREE.Vector3;
  keys: () => Key[];
  MOB: boolean;
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tanH = Math.tan(THREE.MathUtils.degToRad(35 / 2));
const SW = [V(0, 3, -10), V(7, 6, -36), V(-6, 6, -30), V(0, 5, -20)];
function swarmC(u: number, out: THREE.Vector3) {
  const v = 1 - u;
  return out
    .set(0, 0, 0)
    .addScaledVector(SW[0], v * v * v)
    .addScaledVector(SW[1], 3 * v * v * u)
    .addScaledVector(SW[2], 3 * v * u * u)
    .addScaledVector(SW[3], u * u * u);
}

export function createEnding(env: EndingEnv) {
  const { camera, camR, camU, MOB } = env;
  const eA = V(), eB = V(), eO = V(), eD = V(), eY = V(), eZ = V(), eQ = new THREE.Quaternion(), dQ = new THREE.Quaternion();
  const camF = V(), XAX = V(1, 0, 0), UP = V(0, 1, 0), lookM = new THREE.Matrix4();
  const STRAG = MOB ? 30 : 28;

  // one flock card during the ending: fold into a paper plane, chase, then break away off a screen edge.
  // Moves pos/rot toward the plane's pose and returns its scale.
  function endCard(i: number, c: Card, s: number, t: number, e: number, pos: THREE.Vector3, rot: THREE.Quaternion) {
    const ph = c.ph, a1 = smr(0.02 + ph * 0.04, 0.08 + ph * 0.04, e);
    if (a1 <= 0) return s;
    const u = smr(0.03, 0.3, e);
    swarmC(u, eA);
    swarmC(Math.min(1, u + 0.02), eB);
    eD.subVectors(eB, eA);
    if (eD.lengthSq() < 1e-6) eD.set(0.2, 0.1, -1);
    const f1 = 0.6 + c.sp * 0.5, p6 = ph * 6.283, R = 3.2 + 1.8 * Math.sin(t * 0.37 + u * 7);
    eO.set(Math.sin(t * 0.53 * f1 + p6 + u * 9) * R, Math.sin(t * 0.71 * f1 + p6 * 1.7) * R * 0.5, Math.cos(t * 0.47 * f1 + p6 * 2.3 + u * 6) * R);
    eO.x += Math.sin(t * 0.9 + eO.z * 0.4) * 0.8;
    eA.add(eO);
    // breakup: each plane peels off radially (around the view axis), past the camera and off an edge;
    // departures staggered over a long window, some cross the view sideways first
    const sj = i % STRAG === 3 ? (i / STRAG) | 0 : -1; // a few planes stay aloft through the night
    const k = sj >= 0 ? 0 : clamp((e - (0.16 + ph * 0.3)) / (0.18 + c.sp * 0.1));
    let roll = Math.sin(t * 1.3 + p6) * 0.25;
    if (k > 0) {
      const cross = i % 5 < 2, kk = Math.pow(k, 1.6) * (1.1 + 0.3 * c.sp);
      const ang = cross ? (i % 2 ? 0.15 : Math.PI - 0.15) + Math.sin(i) * 0.25 : (i * 2.39996) % 6.2832;
      camF.subVectors(camera.position, eA);
      const dist = camF.length();
      camF.normalize();
      eY.copy(camR).multiplyScalar(Math.cos(ang)).addScaledVector(camU, Math.sin(ang) * 0.8);
      if (cross) eB.copy(eA).addScaledVector(camF, dist * 0.55 * kk).addScaledVector(eY, dist * (1.5 * kk - 0.45 * Math.sin(k * Math.PI)));
      else eB.copy(eA).addScaledVector(camF, dist * 1.05 * kk).addScaledVector(eY, dist * (0.5 + 0.35 * ph) * kk);
      eD.subVectors(eB, eA).normalize();
      eA.copy(eB);
      roll += Math.sin(ang) * 0.9 * Math.min(1, k * 3);
    }
    if (sj >= 0) {
      // slow lateral crossing low in the sky (below the constellation), varied depth, gentle banking; out by the pull-back
      const keys = env.keys(), B = keys[keys.length - 1][1];
      const w = smr(0.28, 0.42, e), side = sj % 2 ? 1 : -1, d = 10 + ((sj * 5.3) % 20);
      const half = d * tanH * camera.aspect, uu = Math.pow(clamp((e - 0.3) / 0.6), 1.7), x0 = -0.85 + ((sj * 0.37) % 1.2);
      eB.set(B.x + side * lerp(x0, 1.15, uu) * half, B.y + d * (0.045 + 0.04 * ((sj * 0.61) % 1)) + Math.sin(t * 0.4 + sj) * 0.25, B.z - d);
      eA.lerp(eB, w);
      eD.lerp(eY.set(side, Math.sin(t * 0.3 + sj) * 0.08, -0.15), w);
      roll = lerp(roll, Math.sin(t * 0.5 + sj * 1.7) * 0.35, w);
    }
    pos.lerp(eA, a1);
    eD.normalize();
    eD.y += Math.sin(t * 1.3 + p6) * 0.12;
    eD.normalize();
    eY.crossVectors(UP, eD).normalize();
    eZ.crossVectors(eD, eY);
    lookM.makeBasis(eD, eY, eZ);
    eQ.setFromRotationMatrix(lookM);
    eQ.multiply(dQ.setFromAxisAngle(XAX, roll));
    rot.slerp(eQ, a1);
    return lerp(s, sj >= 0 ? 0.8 : 0.62, a1) * (k >= 1 ? 0 : 1);
  }

  /* ---------- harbour lights: night falls, 183 lights come on, rise into a constellation ---------- */
  type Geo = THREE.BufferGeometry;
  const n = 183;
  const EC = {
    base: [] as THREE.Vector3[],
    tgt: [] as THREE.Vector3[],
    ordOn: [] as number[],
    ordX: [] as number[],
    big: [] as boolean[],
    size: [] as number[],
    hue: [] as number[],
    seaY: 0,
    camT: V(),
    W: V(),
    Ww: 30,
    word: null as Word | null,
  };
  const pointsGeo = (m: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    g.setAttribute("aOn", new THREE.BufferAttribute(new Float32Array(m), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(m), 1));
    g.setAttribute("aHue", new THREE.BufferAttribute(new Float32Array(m), 1));
    return g;
  };
  const glowMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms, vertexShader: STAR_VERT, fragmentShader: frag });
  const LP = new THREE.Points(pointsGeo(n), glowMat(STAR_FRAG, { uPR: { value: 1 }, uK: { value: 1 } }));
  const RP = new THREE.Points(pointsGeo(n), glowMat(REFLECT_FRAG, { uPR: { value: 1 }, uK: { value: 3.6 }, uT: { value: 0 } })); // reflections
  const BGS = new THREE.Points(pointsGeo(140), glowMat(STAR_FRAG, { uPR: { value: 1 }, uK: { value: 1 } })); // faint stars around the word
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  lg.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(1), 1));
  const LS = new THREE.LineSegments(
    lg,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uDraw: { value: 0 }, uO: { value: 0 } },
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
    })
  );
  for (const o of [LP, RP, LS, BGS]) {
    o.frustumCulled = false;
    o.visible = false;
    env.scene.add(o);
  }
  const uni = (o: THREE.Points | THREE.LineSegments) => (o.material as THREE.ShaderMaterial).uniforms;
  const attr = (g: Geo, k: string) => g.attributes[k] as THREE.BufferAttribute;

  function buildC() {
    const keys = env.keys(), B = keys[keys.length - 1][1], asp = innerWidth / innerHeight, mob = asp < 0.95, R = rng(183);
    EC.seaY = B.y - 2;
    const az: number[] = [];
    for (let k = 0; k < n; k++) {
      let p: THREE.Vector3;
      if (k < 128) {
        const a = -1.25 + 2.5 * R(), d = 170 + R() * 70;
        p = V(B.x + Math.sin(a) * d, B.y + d * hillAt(a) * (0.12 + 0.7 * R()), B.z - Math.cos(a) * d);
      } else p = V(B.x + (R() - 0.5) * 80, EC.seaY + 0.12 + R() * 0.25, B.z - (22 + R() * 120));
      EC.base[k] = p;
      az[k] = Math.atan2(p.x - B.x, -(p.z - B.z));
      EC.size[k] = k < 128 ? 4 + R() * 3.5 : 6 + R() * 3;
      EC.hue[k] = R() < 0.22 ? 0.85 : R() * 0.25;
    }
    const byOn = [...Array(n).keys()].sort((a, b) => az[a] + R() * 0.25 - (az[b] + R() * 0.25));
    byOn.forEach((k, r) => {
      EC.ordOn[k] = r / (n - 1);
    });
    if (!EC.word) EC.word = skeletonWord("Christopher", n);
    const word = EC.word;
    const dist = 62, visH = 2 * dist * tanH, visW = visH * asp;
    EC.Ww = Math.min(44, visW * (mob ? 0.92 : 0.8));
    EC.W.set(B.x, B.y + 13, B.z - dist);
    EC.camT.set(B.x, EC.W.y - visH * (mob ? 0.06 : 0.04), EC.W.z);
    const wp = ([a, b]: Pt) => V(EC.W.x + a * EC.Ww, EC.W.y + b * EC.Ww, EC.W.z);
    const byAz = [...Array(n).keys()].sort((a, b) => az[a] - az[b]);
    const byPx = [...Array(n).keys()].sort((a, b) => word.stars[a][0] - word.stars[b][0]);
    byAz.forEach((k, r) => {
      const s = word.stars[byPx[r]];
      EC.tgt[k] = wp(s);
      EC.ordX[k] = s[0] + 0.5;
      EC.big[k] = word.big[byPx[r]];
    });
    // strokes: consecutive points along each centreline only; aT sweeps left to right like a pen
    const P: number[] = [], T: number[] = [];
    for (const st of word.strokes)
      for (let k = 1; k < st.length; k++) {
        const a = wp(st[k - 1]), b = wp(st[k]);
        P.push(a.x, a.y, a.z, b.x, b.y, b.z);
        T.push(st[k - 1][0] + 0.5, st[k][0] + 0.5);
      }
    LS.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
    LS.geometry.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(T), 1));
    // background stars in a band around the word
    const G = BGS.geometry;
    for (let k = 0; k < 140; k++) {
      const x = (R() - 0.5) * visW * 1.2, y = (R() - 0.35) * visH * 0.75;
      attr(G, "position").setXYZ(k, EC.W.x + x, EC.W.y + y, EC.W.z - 5 - R() * 20);
      attr(G, "aSize").setX(k, 2 + R() * 2.5);
      attr(G, "aHue").setX(k, 0.6 + R() * 0.4);
      attr(G, "aOn").setX(k, 0);
    }
    attr(G, "position").needsUpdate = attr(G, "aSize").needsUpdate = attr(G, "aHue").needsUpdate = true;
  }

  // .38-.86: lights come on along the shore, rise into the word, and the strokes draw in
  function poseC(e: number, t: number, pr: number) {
    const vis = e > 0.45;
    LP.visible = RP.visible = LS.visible = BGS.visible = vis;
    if (!vis || !EC.base.length) return;
    const A = LP.geometry, RA = RP.geometry;
    for (let k = 0; k < n; k++) {
      const b = EC.base[k], g = EC.tgt[k], t0 = 0.46 + EC.ordOn[k] * 0.17;
      const on = smr(t0, t0 + 0.025, e) * (0.86 + 0.14 * Math.sin(t * 2.1 + k * 1.7));
      const r = smr(0.68 + EC.ordX[k] * 0.08, 0.76 + EC.ordX[k] * 0.08, e), v = 1 - r;
      const cy = Math.max(b.y, g.y) + 6, cz = lerp(b.z, g.z, 0.4);
      const x = v * v * b.x + 2 * v * r * b.x + r * r * g.x, y = v * v * b.y + 2 * v * r * cy + r * r * g.y, z = v * v * b.z + 2 * v * r * cz + r * r * g.z;
      attr(A, "position").setXYZ(k, x, y, z);
      attr(A, "aOn").setX(k, on * (r > 0.98 ? 0.88 + 0.12 * Math.sin(t * 2.7 + k * 2.3) : 1));
      attr(A, "aSize").setX(k, lerp(EC.size[k], EC.big[k] ? 22 : 9.5, r));
      attr(A, "aHue").setX(k, EC.hue[k]);
      attr(RA, "position").setXYZ(k, x, 2 * EC.seaY - y - 0.05, z);
      attr(RA, "aOn").setX(k, on * v * v);
      attr(RA, "aSize").setX(k, EC.size[k]);
      attr(RA, "aHue").setX(k, EC.hue[k]);
    }
    for (const g of [A, RA]) for (const k of ["position", "aOn", "aSize", "aHue"]) attr(g, k).needsUpdate = true;
    uni(LP).uPR.value = uni(RP).uPR.value = uni(BGS).uPR.value = pr;
    uni(RP).uT.value = t;
    const bg = attr(BGS.geometry, "aOn"), bk = smr(0.6, 0.76, e) * 0.5;
    for (let k = 0; k < 140; k++) bg.setX(k, bk * (0.6 + 0.4 * Math.sin(t * 1.3 + k * 3.1)));
    bg.needsUpdate = true;
    uni(LS).uDraw.value = lerp(-0.05, 1.05, smr(0.79, 0.85, e));
    uni(LS).uO.value = 0.75 * sm(0.79, 0.81, e);
  }

  // dusk to night: the sky, sea and key light dim together
  const S = env.shared;
  const DAY = {
    zen: S.uZen.value.clone(),
    mid: S.uMid.value.clone(),
    hor: S.uHor.value.clone(),
    sea: S.uSea.value.clone(),
    key: S.uKeyCol.value.clone(),
    amb: S.uAmb.value.clone(),
  };
  const NIGHT = { zen: lin("#020a0f"), mid: lin("#0a2229"), hor: lin("#4d4c56"), sea: lin("#03121a") };
  function applyNight(k: number) {
    S.uZen.value.copy(DAY.zen).lerp(NIGHT.zen, k);
    S.uMid.value.copy(DAY.mid).lerp(NIGHT.mid, k);
    S.uHor.value.copy(DAY.hor).lerp(NIGHT.hor, k);
    S.uSea.value.copy(DAY.sea).lerp(NIGHT.sea, k);
    S.uKeyCol.value.copy(DAY.key).multiplyScalar(1 - 0.55 * k);
    S.uAmb.value.copy(DAY.amb).multiplyScalar(1 - 0.5 * k);
    S.uNight.value = k;
  }
  function light(e: number) {
    applyNight(smr(0.38, 0.62, e));
    S.uGlint.value = Math.max(sm(0.34, 0.42, e) * (1 - sm(0.47, 0.56, e)), 0.4 * sm(0.5, 0.6, e) * (1 - sm(0.84, 0.88, e)));
  }

  // the camera follows the swarm, then lifts to the constellation
  function endCam(e: number, wantT: THREE.Vector3) {
    swarmC(smr(0.03, 0.3, e), eA);
    wantT.lerp(eA, 0.55 * sm(0.02, 0.12, e) * (1 - smr(0.3, 0.52, e)));
    wantT.lerp(EC.camT, smr(0.55, 0.8, e));
  }

  return { endCard, endCam, light, buildC, poseC };
}

const hillAt = (a: number) => 0.012 + 0.009 * Math.sin(a * 4 + 1.3) + 0.006 * Math.sin(a * 11 + 2) + 0.003 * Math.sin(a * 29);

/* ---------- constellation: the word in Gochi Hand, thinned to stroke centrelines, stars spaced by arc length ---------- */
type Pt = [number, number];
type Word = { stars: Pt[]; strokes: Pt[][]; big: boolean[] };

function zhangSuen(B: Uint8Array, w: number, h: number) {
  const del: number[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!B[i]) continue;
          const p2 = B[i - w], p3 = B[i - w + 1], p4 = B[i + 1], p5 = B[i + w + 1], p6 = B[i + w], p7 = B[i + w - 1], p8 = B[i - 1], p9 = B[i - w - 1];
          const bn = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (bn < 2 || bn > 6) continue;
          const a =
            (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) + (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
      for (const i of del) B[i] = 0;
      if (del.length) changed = true;
    }
  }
}

function skPlen(pl: Pt[]) {
  let L = 0;
  for (let k = 1; k < pl.length; k++) L += Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
  return L;
}

// one glyph: thin to centrelines and trace; neighbours can never connect because each letter is its own bitmap
function traceGlyph(ch: string, fp: number) {
  const pad = Math.ceil(fp * 0.15), c = cv(10, 10), x = c.getContext("2d", { willReadFrequently: true })!;
  const font = `${fp}px ${FONT.hand}`;
  x.font = font;
  const adv = x.measureText(ch).width, w = Math.ceil(adv) + pad * 2, h = Math.ceil(fp * 1.5);
  c.width = w;
  c.height = h;
  x.font = font;
  x.fillStyle = "#fff";
  x.textBaseline = "middle";
  x.fillText(ch, pad, h * 0.55);
  const d = x.getImageData(0, 0, w, h).data, B = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) B[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  zhangSuen(B, w, h);
  const nb = (i: number) => {
    const out: number[] = [];
    for (const k of [-w, 1, w, -1]) if (B[i + k]) out.push(i + k);
    for (const [dk, a, b] of [
      [-w - 1, -w, -1],
      [-w + 1, -w, 1],
      [w + 1, w, 1],
      [w - 1, w, -1],
    ])
      if (B[i + dk] && !B[i + a] && !B[i + b]) out.push(i + dk);
    return out;
  };
  const px: number[] = [];
  for (let i = 0; i < w * h; i++) if (B[i]) px.push(i);
  const deg = new Map<number, number>();
  for (const i of px) deg.set(i, nb(i).length);
  const seen = new Set<number>(), ek = (a: number, b: number) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  const walk = (a: number, b: number) => {
    const pts = [a];
    let prev = a, cur = b;
    seen.add(ek(a, b));
    for (;;) {
      pts.push(cur);
      if (deg.get(cur) !== 2) break;
      const nx = nb(cur).find((j) => j !== prev && !seen.has(ek(cur, j)));
      if (nx === undefined) break;
      seen.add(ek(cur, nx));
      prev = cur;
      cur = nx;
    }
    return pts;
  };
  const idx: number[][] = [];
  for (const i of px) {
    const dg = deg.get(i);
    if (dg === 0) idx.push([i]);
    else if (dg !== 2) for (const j of nb(i)) if (!seen.has(ek(i, j))) idx.push(walk(i, j));
  }
  for (const i of px) if (deg.get(i) === 2) for (const j of nb(i)) if (!seen.has(ek(i, j))) idx.push(walk(i, j));
  let polys: Pt[][] = idx.map((pl) => pl.map((i): Pt => [i % w, (i / w) | 0]));
  const free = (q: Pt) => (deg.get(q[1] * w + q[0]) || 0) <= 1;
  polys = polys.filter((pl) => pl.length === 1 || skPlen(pl) >= fp * 0.06 || (free(pl[0]) && free(pl[pl.length - 1])));
  polys = polys.map((pl) =>
    pl.length < 5
      ? pl
      : pl.map((p, k): Pt => {
          const a = pl[Math.max(0, k - 2)], b = pl[Math.min(pl.length - 1, k + 2)];
          return k === 0 || k === pl.length - 1 ? p : [(a[0] + p[0] * 2 + b[0]) / 4, (a[1] + p[1] * 2 + b[1]) / 4];
        })
  );
  // a dot: a small piece sitting entirely above the rest of the glyph
  const top = (pl: Pt[]) => Math.min(...pl.map((p) => p[1])), bot = (pl: Pt[]) => Math.max(...pl.map((p) => p[1]));
  const big = polys.reduce((a, pl) => (skPlen(pl) > skPlen(a) ? pl : a), polys[0] || []);
  const marks = polys.map((pl) => pl !== big && skPlen(pl) < fp * 0.16 && bot(pl) < top(big) - fp * 0.02);
  return { polys: polys.map((pl) => pl.map(([a, b]): Pt => [a - pad, b])), marks, adv };
}

function skeletonWord(text: string, n: number): Word {
  const fp = 320, gap = fp * 0.12;
  const polys: Pt[][] = [], dot: boolean[] = [];
  let ox = 0, prev = "";
  for (const ch of text) {
    if (prev === "r" && ch === "i") ox += fp * 0.1; // keep the r shoulder clear of the i stem
    const g = traceGlyph(ch, fp);
    g.polys.forEach((pl, k) => {
      polys.push(pl.map(([a, b]): Pt => [a + ox, b]));
      dot.push(g.marks[k]);
    });
    ox += g.adv + gap;
    prev = ch;
  }
  // stars by arc length (every piece gets at least one, so dots and crossbars read)
  const nd = dot.filter(Boolean).length, lens = polys.map((pl, k) => (dot[k] ? 0 : skPlen(pl))), total = lens.reduce((a, b) => a + b, 0);
  n -= nd;
  const cnt = lens.map((L, k) => (dot[k] ? 0 : Math.max(1, Math.floor((L / total) * n))));
  let sum = cnt.reduce((a, b) => a + b, 0);
  const order = lens.map((L, k) => [(L / total) * n - Math.floor((L / total) * n), k]).sort((a, b) => b[0] - a[0]);
  for (let j = 0; sum < n; j = (j + 1) % order.length) {
    if (!dot[order[j][1]]) {
      cnt[order[j][1]]++;
      sum++;
    }
  }
  while (sum > n) {
    let mx = 0;
    cnt.forEach((v, k) => {
      if (v > cnt[mx]) mx = k;
    });
    cnt[mx]--;
    sum--;
  }
  dot.forEach((d, k) => {
    if (d) cnt[k] = -1;
  });
  const at = (pl: Pt[], sDist: number): Pt => {
    let acc = 0;
    for (let k = 1; k < pl.length; k++) {
      const sl = Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]);
      if (acc + sl >= sDist) {
        const f = sl ? (sDist - acc) / sl : 0;
        return [lerp(pl[k - 1][0], pl[k][0], f), lerp(pl[k - 1][1], pl[k][1], f)];
      }
      acc += sl;
    }
    return pl[pl.length - 1];
  };
  const stars: Pt[] = [], strokes: Pt[][] = [], big: boolean[] = [];
  polys.forEach((pl, k) => {
    if (cnt[k] < 0) {
      // the i dot: one bright star at the centre of the mark, no line
      let sx = 0, sy = 0;
      for (const p of pl) {
        sx += p[0];
        sy += p[1];
      }
      stars.push([sx / pl.length, sy / pl.length]);
      big.push(true);
      return;
    }
    const L = lens[k], m = cnt[k];
    if (!m) return;
    const closed = pl.length > 8 && Math.hypot(pl[0][0] - pl[pl.length - 1][0], pl[0][1] - pl[pl.length - 1][1]) < 2.5;
    const ss: Pt[] = [];
    for (let j = 0; j < m; j++) ss.push(pl.length === 1 ? pl[0] : at(pl, closed ? (j * L) / m : ((j + 0.5) * L) / m));
    stars.push(...ss);
    for (let j = 0; j < ss.length; j++) big.push(false);
    if (pl.length > 1) strokes.push(closed ? [...ss, ss[0]] : [pl[0], ...ss, pl[pl.length - 1]]);
  });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [a, b] of stars) {
    x0 = Math.min(x0, a);
    x1 = Math.max(x1, a);
    y0 = Math.min(y0, b);
    y1 = Math.max(y1, b);
  }
  const W = x1 - x0, nrm = ([a, b]: Pt): Pt => [(a - (x0 + x1) / 2) / W, -(b - (y0 + y1) / 2) / W];
  return { stars: stars.map(nrm), strokes: strokes.map((st) => st.map(nrm)), big };
}
