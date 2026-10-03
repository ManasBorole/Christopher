import * as THREE from "three";
import { lin, type Card, type Uniforms } from "./flock";
import { clamp, lerp, rng, sm, smr } from "./math";
import type { Order } from "./painter";
import { C, FONT, cv, fitFont, grain, stripeBorder } from "./paper";
import WORD from "./word.json";
import { GIANT_FRAG, GIANT_VERT, LINE_FRAG, LINE_VERT, REFLECT_FRAG, STAR_FRAG, STAR_VERT } from "./shaders";

/* The ending, one path: murmuration, harbour lights, the world was a postcard.
   Ending progress e (0..1):
     .00-.66 the flock folds into paper planes, chases the plane, then departs over a long window
             (some cross the view; a few stay aloft through the night)
     .38-.86 harbour lights: night falls, 183 lights come on, rise into a Gochi Hand constellation, strokes draw in
     .86-1.0 the night harbour is the picture side of a giant postcard; it flips to "To Christopher", stamp, postmark, CTA */

type Key = [number, THREE.Vector3, THREE.Vector3];
export type EndingEnv = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  shared: Uniforms;
  canvasTex: (c: HTMLCanvasElement) => THREE.Texture;
  paint: (job: Order) => Promise<TexImageSource>; // paper grain, off the main thread
  stamp: Promise<THREE.Texture>; // the big stamp, baked
  postTex: THREE.Texture; // the red postmark, shared with the after card
  ctaB: HTMLElement; // the CTA that rides the postcard's address lines
  RM: boolean;
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
    word: WORD as Word, // the skeleton, baked (bake.ts)
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

  /* ---------- the night harbour was the picture side of a giant postcard; it flips to "To Christopher" ---------- */
  const EB = {
    rt: null as THREE.WebGLRenderTarget | null,
    space: new THREE.Scene(),
    cam: new THREE.PerspectiveCamera(35, 1, 0.1, 3000),
    card: null as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null,
    stamp: null as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null,
    stampHome: V(),
    d0: 10,
    Wc: 1,
    Hc: 1,
    stamped: false,
    shakeT: -9,
    anchor: V(),
  };
  EB.space.background = new THREE.Color("#06171c");
  {
    const sg = new THREE.BufferGeometry(), sp = new Float32Array(900 * 3), R = rng(77);
    for (let k = 0; k < 900; k++) {
      const u = R() * 2 - 1, a = R() * 6.283, r = Math.sqrt(1 - u * u);
      sp.set([Math.cos(a) * r * 700, u * 700, Math.sin(a) * r * 700], k * 3);
    }
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    EB.space.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color("#d9e8e4"), size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55 })));
  }

  let gen = 0, gone = false;
  function buildB() {
    const asp = innerWidth / innerHeight, sz = env.renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!EB.rt) {
      EB.rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { samples: 4 });
      EB.rt.texture.colorSpace = THREE.SRGBColorSpace;
    } else EB.rt.setSize(sz.x, sz.y);
    EB.cam.aspect = asp;
    EB.cam.updateProjectionMatrix();
    const d0 = EB.d0, Hp = 2 * d0 * tanH, Wp = Hp * asp, m = 0.075 * Math.min(Hp, Wp);
    const Wc = Wp + 2 * m, Hc = Hp + 2 * m;
    const aspC = Wc / Hc, bw = aspC >= 1 ? 2048 : 1200, bh = Math.round(bw / aspC), my = ++gen;
    // the card is sized to the screen, so its paper is painted here, then written on once the fonts are in
    Promise.all([
      env.paint({ w: bw, h: bh, paper: ["#f0e4cc", 1, 2, 909] }),
      document.fonts.load(`40px ${FONT.hand}`, "say it out loud. Christopher"),
      document.fonts.load(`700 30px ${FONT.sans}`, "To"),
      env.stamp,
    ]).then(([paper, , , stamp]) => {
      if (my === gen && !gone) dressB(paper, stamp, Wc, Hc, m, aspC, bw, bh);
    }, () => {});
  }
  function dressB(paper: TexImageSource, stamp: THREE.Texture, Wc: number, Hc: number, m: number, aspC: number, bw: number, bh: number) {
    if (!EB.rt) return;
    if (EB.card) {
      EB.space.remove(EB.card);
      EB.card.geometry.dispose();
      EB.card.material.uniforms.tBack.value.dispose();
      EB.card.material.dispose();
      EB.stamp?.geometry.dispose();
      EB.stamp?.material.dispose();
    }
    EB.Wc = Wc;
    EB.Hc = Hc;
    const bc = cv(bw, bh), x = bc.getContext("2d")!;
    x.setTransform(1, 0, 0, -1, 0, bh); // the painter hands pictures over upside down, for WebGL
    x.drawImage(paper as CanvasImageSource, 0, 0, bw, bh);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const L = drawGiantBack(x, aspC);
    EB.card = new THREE.Mesh(
      new THREE.PlaneGeometry(EB.Wc, EB.Hc, 64, 40),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        uniforms: {
          tPic: { value: EB.rt.texture },
          tBack: { value: env.canvasTex(bc) },
          tPost: { value: env.postTex },
          uSize: { value: new THREE.Vector2(EB.Wc, EB.Hc) },
          uM: { value: new THREE.Vector2(m, m) },
          uPM: { value: new THREE.Vector4(L.pm[0], 1 - L.pm[1], L.pm[2], L.pm[2] * aspC) },
          uStamp: { value: new THREE.Vector2(1, 0) },
          uCurl: { value: 0 },
          uPaper: { value: new THREE.Color("#f0e4cc") },
          uRed: { value: new THREE.Color(C.red) },
          uBlue: { value: new THREE.Color(C.blue) },
        },
        vertexShader: GIANT_VERT,
        fragmentShader: GIANT_FRAG,
      })
    );
    EB.card.position.set(0, 0, -EB.d0);
    EB.card.frustumCulled = false;
    EB.space.add(EB.card);
    const swd = L.stamp[2] * EB.Wc, sht = swd * 1.2;
    EB.stamp = new THREE.Mesh(new THREE.PlaneGeometry(swd, sht), new THREE.MeshBasicMaterial({ map: stamp, transparent: true, side: THREE.DoubleSide }));
    EB.stamp.rotation.y = Math.PI;
    EB.stampHome.set((0.5 - (L.stamp[0] + L.stamp[2] / 2)) * EB.Wc, (0.5 - L.stamp[1]) * EB.Hc - sht / 2, -0.02);
    EB.card.add(EB.stamp);
    EB.anchor.set((0.5 - L.cta[0]) * EB.Wc, (0.5 - L.cta[1]) * EB.Hc, -0.02);
  }

  // eb: .1 start of the pull-back .. .9 the CTA. Returns whether the postcard is on screen.
  const ctaB = env.ctaB, tmp = V();
  function poseB(eb: number, t: number, now: number) {
    if (!(eb > 0.1 && EB.card && EB.stamp)) {
      if (ctaB.classList.contains("on")) {
        ctaB.classList.remove("on");
        ctaB.style.opacity = "0";
      }
      return false;
    }
    const asp = innerWidth / innerHeight;
    const k1 = smr(0.1, 0.42, eb), f = smr(0.44, 0.62, eb), k2 = smr(0.56, 0.74, eb), k3 = smr(0.6, 0.84, eb);
    const dMid = Math.max(EB.Hc / (0.62 * 2 * tanH), EB.Wc / (0.62 * 2 * tanH * asp));
    const dFin = Math.max(EB.Hc / (0.78 * 2 * tanH), EB.Wc / (0.84 * 2 * tanH * asp));
    const d = lerp(lerp(EB.d0, dMid, k1), dFin, k3);
    const sh = Math.exp(-(now - EB.shakeT) * 9) * (env.RM ? 0 : 1);
    EB.cam.position.set(
      Math.sin(t * 0.2) * 0.04 * k1 + Math.sin(now * 71) * sh * 0.04,
      Math.sin(t * 0.17) * 0.03 * k1 + Math.cos(now * 63) * sh * 0.05,
      d - EB.d0
    );
    EB.cam.lookAt(0, 0, -EB.d0);
    EB.card.rotation.set(-0.3 * k1 * (1 - k2), 0.42 * k1 * (1 - k2) + f * Math.PI, 0.05 * k1 * (1 - k2));
    const U = EB.card.material.uniforms;
    U.uCurl.value = Math.sin(f * Math.PI) * 0.5 + 0.08 * k1 * (1 - k2);
    const sd = smr(0.645, 0.71, eb);
    EB.stamp.visible = sd > 0;
    EB.stamp.position.copy(EB.stampHome);
    EB.stamp.position.z -= (1 - sd) * 3.5;
    EB.stamp.position.y += (1 - sd) * 0.8;
    EB.stamp.rotation.z = (1 - sd) * 0.7 - 0.05;
    EB.stamp.scale.setScalar(1 + (1 - sd) * 0.25);
    const ps = smr(0.725, 0.737, eb);
    U.uStamp.value.set(lerp(0.6, 1, ps), ps);
    if (eb > 0.736 && !EB.stamped) {
      EB.stamped = true;
      EB.shakeT = now;
    }
    if (eb < 0.72) EB.stamped = false;
    // the CTA sits on the address lines
    const o = sm(0.82, 0.9, eb);
    ctaB.classList.toggle("on", o > 0.01);
    ctaB.style.opacity = o.toFixed(3);
    if (o > 0.01) {
      EB.card.updateMatrixWorld();
      EB.cam.updateMatrixWorld();
      tmp.copy(EB.anchor);
      EB.card.localToWorld(tmp);
      tmp.project(EB.cam);
      const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight;
      ctaB.style.transform = `translate(${x.toFixed(0)}px,${(y - ctaB.offsetHeight / 2).toFixed(0)}px)`;
    }
    return true;
  }

  // the postcard part runs on its own clock over the last stretch of the ending
  const ebOf = (e: number) => (e < 0.86 ? 0 : 0.1 + ((e - 0.86) / 0.14) * 0.9);
  function render(scene: THREE.Scene, camera: THREE.Camera, e: number, t: number, now: number) {
    const gl = env.renderer;
    if (poseB(ebOf(e), t, now) && EB.rt) {
      gl.setRenderTarget(EB.rt);
      gl.render(scene, camera);
      gl.setRenderTarget(null);
      gl.render(EB.space, EB.cam);
    } else gl.render(scene, camera);
  }

  function build() {
    buildC();
    buildB();
  }

  function dispose() {
    gone = true;
    EB.rt?.dispose();
    EB.space.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
    ctaB.classList.remove("on");
    ctaB.style.opacity = ctaB.style.transform = "";
  }

  return { endCard, endCam, light, poseC, build, render, dispose };
}

/* ---------- giant postcard drawing ---------- */
type Layout = { stamp: [number, number, number]; pm: [number, number, number]; cta: [number, number] };
function drawGiantBack(c: CanvasRenderingContext2D, aspC: number): Layout {
  const W = c.canvas.width, H = c.canvas.height, land = aspC >= 1;
  stripeBorder(c, 0, 0, W, H, Math.min(W, H) * 0.034);
  c.strokeStyle = "rgba(80,60,40,.32)";
  c.lineWidth = 3;
  c.textAlign = "left";
  const rule = (ys: number[], x0: number, x1: number) => {
    c.strokeStyle = "rgba(80,60,40,.3)";
    c.lineWidth = 2;
    for (const y of ys) {
      c.beginPath();
      c.moveTo(W * x0, H * y);
      c.lineTo(W * x1, H * y);
      c.stroke();
    }
  };
  if (land) {
    c.beginPath();
    c.moveTo(W * 0.56, H * 0.14);
    c.lineTo(W * 0.56, H * 0.86);
    c.stroke();
    c.fillStyle = C.pen;
    fitFont(c, "say it out loud.", "", FONT.hand, W * 0.44, H * 0.14);
    c.fillText("say it out loud.", W * 0.07, H * 0.38);
    c.font = `${H * 0.06}px ${FONT.hand}`;
    c.fillText("Take your time. I will wait", W * 0.075, H * 0.52);
    c.fillText("for the whole sentence.", W * 0.075, H * 0.6);
    c.fillText("C.", W * 0.075, H * 0.72);
    c.fillStyle = C.ochre;
    c.font = `700 ${H * 0.036}px ${FONT.sans}`;
    c.fillText("To", W * 0.61, H * 0.44);
    c.fillStyle = C.pen;
    fitFont(c, "Christopher", "", FONT.hand, W * 0.32, H * 0.13);
    c.fillText("Christopher", W * 0.61, H * 0.57);
    rule([0.68, 0.79, 0.9], 0.61, 0.93);
    return { stamp: [0.78, 0.09, 0.15], pm: [0.76, 0.33, 0.17], cta: [0.61, 0.785] };
  }
  c.fillStyle = C.pen;
  fitFont(c, "say it out loud.", "", FONT.hand, W * 0.84, W * 0.13);
  c.fillText("say it out loud.", W * 0.08, H * 0.3);
  c.font = `${W * 0.062}px ${FONT.hand}`;
  c.fillText("Take your time. I will wait", W * 0.085, H * 0.37);
  c.fillText("for the whole sentence.  C.", W * 0.085, H * 0.415);
  c.beginPath();
  c.moveTo(W * 0.08, H * 0.48);
  c.lineTo(W * 0.92, H * 0.48);
  c.stroke();
  c.fillStyle = C.ochre;
  c.font = `700 ${W * 0.04}px ${FONT.sans}`;
  c.fillText("To", W * 0.08, H * 0.56);
  c.fillStyle = C.pen;
  fitFont(c, "Christopher", "", FONT.hand, W * 0.8, W * 0.15);
  c.fillText("Christopher", W * 0.08, H * 0.65);
  rule([0.73, 0.82, 0.91], 0.08, 0.92);
  return { stamp: [0.64, 0.05, 0.26], pm: [0.6, 0.15, 0.3], cta: [0.08, 0.775] };
}

// the big stamp: Christopher with his postcard, denomination 183 languages
export function drawStampTex(c: HTMLCanvasElement, img: HTMLImageElement | null | undefined) {
  const x = c.getContext("2d")!;
  x.globalCompositeOperation = "source-over";
  x.clearRect(0, 0, 480, 576);
  x.fillStyle = "#fbf6ea";
  x.fillRect(0, 0, 480, 576);
  grain(x, 0, 0, 480, 576, 0.6, 1.5, 4242);
  const m = 38, band = 112, iw = 480 - 2 * m, ih = 576 - 2 * m - band;
  if (img) x.drawImage(img, 0, 30, img.width, (img.width * ih) / iw, m, m, iw, ih);
  // the denomination: ink on a paper band, like a real stamp value
  x.fillStyle = "#f3e8d2";
  x.fillRect(m, m + ih, iw, band);
  x.fillStyle = C.red;
  x.fillRect(m, m + ih, iw, 6);
  x.font = `700 82px ${FONT.display}`;
  x.textAlign = "right";
  x.textBaseline = "alphabetic";
  x.fillText("183", 480 - m - 16, m + ih + band - 22);
  x.fillStyle = C.ink;
  x.font = `600 26px ${FONT.sans}`;
  x.textAlign = "left";
  x.fillText("languages", m + 16, m + ih + band - 30);
  x.globalCompositeOperation = "destination-out";
  const r = 13, st = 34;
  for (let i = st / 2; i < 480; i += st) {
    x.beginPath();
    x.arc(i, 0, r, 0, 7);
    x.arc(i, 576, r, 0, 7);
    x.fill();
  }
  for (let j = st / 2; j < 576; j += st) {
    x.beginPath();
    x.arc(0, j, r, 0, 7);
    x.arc(480, j, r, 0, 7);
    x.fill();
  }
  x.globalCompositeOperation = "source-over";
}

const hillAt = (a: number) => 0.012 + 0.009 * Math.sin(a * 4 + 1.3) + 0.006 * Math.sin(a * 11 + 2) + 0.003 * Math.sin(a * 29);

/* ---------- constellation: the word in Gochi Hand, thinned to stroke centrelines, stars spaced by arc length ---------- */
type Pt = [number, number];
export type Word = { stars: Pt[]; strokes: Pt[][]; big: boolean[] };

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

export function skeletonWord(text: string, n: number): Word {
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
