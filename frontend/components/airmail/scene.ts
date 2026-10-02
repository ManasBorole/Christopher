import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { QE, QP, measureBeats, readBeats, updateHTML } from "./beats";
import { ATLAS_COLS, ATLAS_ROWS, JP, LANGS, drawAtlas, drawBack } from "./cards";
import { createSphereDrag } from "./drag";
import { createDust } from "./dust";
import { createEnding } from "./ending";
import { createFlock, lin, paperMat, type Rect, type Uniforms, type Zone } from "./flock";
import { createHear } from "./hear";
import { loadImages, type ImgName } from "./images";
import { clamp, easeOut, lerp, sm, smr } from "./math";
import { FONT, cv, drawPostmark, readFonts } from "./paper";
import { drawAfter, drawHeroBack, drawHeroFront, drawPolaroid } from "./postcards";
import { DOME_FRAG, DOME_VERT, TRAIL_FRAG, TRAIL_VERT } from "./shaders";

/* "Airmail in flight": the landing's WebGL harbour. Every language's postcard
   rides the evening wind over the water, and the camera narrates the scroll.
   Client only; loaded with import() after hydration.

   Beats (story progress p, camera damped toward key targets):
     0.000 hero        cam (0,0,14.5) looking up at the flock; horizon low
     0.08-0.165 dive   into the current; card bend rises with scroll speed
     0.165-0.215       hero postcard H(0,1.3,-3) slows, turns to camera
     0.235-0.29 flip   scroll-scrubbed flip with paper curl; 0.275-0.335 ink draws in (shader mask)
     0.345-0.40        card rejoins the wind; camera pulls back
     0.40-0.53 scale   183 cards gather into a slow sphere S(0,1.8,-8) R5, each a different language */

export type AirmailScene = { setLang: (lang: string) => void; dispose: () => void };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tanH = Math.tan(THREE.MathUtils.degToRad(35 / 2));
type Key = [number, THREE.Vector3, THREE.Vector3];

export function createAirmailScene(root: HTMLElement, startLang: string): AirmailScene {
  let lang = startLang;
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MOB = Math.min(innerWidth, innerHeight * 1.2) < 760 || innerWidth < 760;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  let disposed = false;
  const offs: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
    addEventListener(type, fn, o);
    offs.push(() => removeEventListener(type, fn, o));
  };

  /* ---------- HTML choreography (works with or without WebGL) ---------- */
  const beats = readBeats($("#stage"));
  const track = $("#track");
  const mark = $<HTMLAnchorElement>(".mark");

  const dustCanvas = document.createElement("canvas");
  dustCanvas.id = "dust";
  dustCanvas.setAttribute("aria-hidden", "true");
  $("#grab").after(dustCanvas);
  const dust = createDust(dustCanvas, beats, RM, MOB);

  /* ---------- scroll: Lenis + ScrollTrigger ---------- */
  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  scrollTo(0, 0);
  let targetP = 0; // page scroll progress q
  gsap.registerPlugin(ScrollTrigger);
  let lenis: Lenis | null = null;
  const lenisRaf = (t: number) => lenis?.raf(t * 1000);
  if (!RM) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
  }
  const st = ScrollTrigger.create({
    trigger: track,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (s) => {
      targetP = s.progress;
    },
  });
  // reduced motion: composed resting frames only
  const RESTS = [0, 0.31, 0.47, 0.62, 0.655, 0.69, 0.72, 0.832].map((v) => v * QP).concat([0.2, 0.6, 0.86, 1].map((e) => QE + e * (1 - QE)));
  const snap = (p: number) => RESTS.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));

  const toTop = (e: MouseEvent) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(0);
    else scrollTo(0, 0);
  };
  mark.addEventListener("click", toTop);
  offs.push(() => mark.removeEventListener("click", toTop));

  /* ---------- WebGL ---------- */
  // the canvas belongs to the scene, so a remount never inherits a spent context
  const glCanvas = document.createElement("canvas");
  glCanvas.id = "gl";
  glCanvas.setAttribute("aria-hidden", "true");
  root.prepend(glCanvas);
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    renderer = null;
    root.classList.add("nogl");
  }

  const textures: THREE.Texture[] = [];
  const canvasTex = (c: HTMLCanvasElement, srgb = true, mips = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1);
    if (!mips) {
      t.generateMipmaps = false;
      t.minFilter = THREE.LinearFilter;
    }
    textures.push(t);
    return t;
  };

  const shared: Uniforms = {
    uZen: { value: lin("#081a1f") },
    uMid: { value: lin("#1a4c52") },
    uHor: { value: lin("#eaa06c") },
    uSea: { value: lin("#0f3237") },
    uSunDir: { value: new THREE.Vector3(0.42, 0.06, -1).normalize() },
    uKey: { value: new THREE.Vector3(-0.45, 0.65, 0.75) },
    uKeyCol: { value: new THREE.Color("#fff1dc").multiplyScalar(1.08) },
    uAmb: { value: new THREE.Color("#6a8d90") },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uGlint: { value: 0 },
    uFocus: { value: 14 },
    uDof: { value: 0.09 },
    uFogN: { value: 14 },
    uFogF: { value: 58 },
  };

  const T0 = performance.now();
  const images = loadImages(() => {});
  const imgs = images.imgs;

  const N = MOB ? 183 : 340, F = 183;
  const H0 = V(0, 1.3, -3), S0 = V(0, 1.8, -8), G0 = V(0, 0.8, 2), Q0 = V(0, -1.5, 2.5);
  const SR = MOB ? 4.4 : 5.2;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 800);
  camera.position.set(0, 0, 14.5);
  const drag = createSphereDrag($("#grab"), camera, lenis);
  let flock: ReturnType<typeof createFlock> | null = null;
  let sky: THREE.Mesh | null = null;
  let ending: ReturnType<typeof createEnding> | null = null;
  let hero: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  let after: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  let trail: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  const TS = 48; // trail segments
  type Polaroid ={ mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; ctx: CanvasRenderingContext2D; tex: THREE.Texture; cap: string; w: number };
  const polas: Polaroid[] = [];

  async function build(gl: THREE.WebGLRenderer) {
    readFonts();
    const fontJobs = [`700 64px ${FONT.display}`, `600 64px ${FONT.display}`, `500 30px ${FONT.sans}`, `600 30px ${FONT.sans}`, `700 30px ${FONT.sans}`, `40px ${FONT.hand}`].map((f) =>
      document.fonts.load(f, "Greetings from Christopher 0123")
    );
    const names = LANGS.map((l) => l.n).join("");
    for (const w of ["400", "500", "700"]) fontJobs.push(document.fonts.load(`${w} 40px ${FONT.jp}`, JP + names));
    for (const f of [FONT.deva, FONT.arab, FONT.hebr]) fontJobs.push(document.fonts.load(`700 40px ${f}`, names));
    await Promise.race([
      Promise.all([...fontJobs, ...images.jobs]),
      new Promise((r) => setTimeout(r, Math.max(800, 6000 - (performance.now() - T0)))),
    ]);
    try {
      await document.fonts.ready;
    } catch {
      /* draw with whatever is loaded */
    }
    if (disposed) return;

    gl.setPixelRatio(Math.min(devicePixelRatio, MOB ? 1.5 : 1.75));
    gl.setSize(innerWidth, innerHeight, false);

    // sky dome
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 48, 32),
      new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: shared, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG })
    );
    sky.renderOrder = -1;
    scene.add(sky);

    flock = createFlock(N, F, canvasTex(drawAtlas(MOB)), ATLAS_COLS, ATLAS_ROWS, shared);
    scene.add(flock.mesh);

    // hero postcard
    const HW = 1536, HH = 1024;
    const hf = cv(HW, HH);
    drawHeroFront(hf.getContext("2d")!, imgs.wave);
    const hb = cv(HW, HH), hi = cv(HW, HH), hm = cv(HW, HH);
    drawHeroBack(hb.getContext("2d")!, null, imgs.idle, false);
    drawHeroBack(hi.getContext("2d")!, hm.getContext("2d")!, imgs.idle, true);
    hero = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2, 48, 32),
      paperMat(shared, { HERO: "" }, {
        tFront: { value: canvasTex(hf) },
        tBack: { value: canvasTex(hb) },
        tInk: { value: canvasTex(hi) },
        tMask: { value: canvasTex(hm, false, false) },
        uDraw: { value: 0 },
      })
    );
    hero.material.uniforms.uSize.value.set(3, 2);
    hero.frustumCulled = false;
    scene.add(hero);

    // after-conversation postcard
    const af = cv(HW, HH);
    drawAfter(af.getContext("2d")!, imgs.postcard);
    const ab = cv(1024, 683);
    drawBack(ab.getContext("2d")!, 0, 0, 1024, 683, 3, 0.9, 1.5);
    const pm = cv(512, 512);
    drawPostmark(pm.getContext("2d")!, 512);
    after = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2, 56, 36),
      paperMat(shared, { POSTMARK: "" }, {
        tFront: { value: canvasTex(af) },
        tBack: { value: canvasTex(ab) },
        tPost: { value: canvasTex(pm) },
        uPM: { value: new THREE.Vector4(0.795, 0.7, 0.2, 0.3) },
        uStamp: { value: new THREE.Vector2(1, 0) },
      })
    );
    after.material.uniforms.uSize.value.set(3, 2);
    after.frustumCulled = false;
    scene.add(after);
    ending = createEnding({
      scene,
      renderer: gl,
      shared,
      canvasTex,
      imgs,
      postTex: after.material.uniforms.tPost.value,
      ctaB: $("#ctaB"),
      RM,
      camera,
      camR: flock.camR,
      camU: flock.camU,
      keys: () => KEYS,
      MOB,
    });

    // the paper plane's trail ribbon
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TS * 2 * 3), 3));
    tg.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(TS * 2), 1));
    const av = new Float32Array(TS * 2);
    for (let j = 0; j < TS; j++) av[j * 2 + 1] = 1;
    tg.setAttribute("aV", new THREE.BufferAttribute(av, 1));
    const idx: number[] = [];
    for (let j = 0; j < TS - 1; j++) {
      const a = j * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    tg.setIndex(idx);
    trail = new THREE.Mesh(
      tg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uO: { value: 0 } },
        vertexShader: TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
      })
    );
    trail.frustumCulled = false;
    scene.add(trail);

    // polaroids: Christopher's four conversation states
    const back = cv(8, 8), bx = back.getContext("2d")!;
    bx.fillStyle = "#efe6d3";
    bx.fillRect(0, 0, 8, 8);
    const backTex = canvasTex(back);
    const POL: [ImgName, string][] = [
      ["listen", "listening"],
      ["think", "thinking"],
      ["speak-open", "speaking"],
      ["goahead", "go ahead, you first"],
    ];
    for (const [im, cap] of POL) {
      const c = cv(600, 780), ctx = c.getContext("2d")!;
      drawPolaroid(ctx, imgs[im], cap);
      const tex = canvasTex(c);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.56, 10, 13), paperMat(shared, {}, { tFront: { value: tex }, tBack: { value: backTex } }));
      mesh.material.uniforms.uSize.value.set(1.2, 1.56);
      mesh.frustumCulled = false;
      polas.push({ mesh, ctx, tex, cap, w: 0 });
      scene.add(mesh);
    }
    gl.compile(scene, camera);
  }

  /* ---------- camera choreography ---------- */
  // a camera position + target that frames a subject beside (or, on phones, above) the copy
  function frameOn(center: THREE.Vector3, w: number, h: number, viewDir: THREE.Vector3, near = 1): [THREE.Vector3, THREE.Vector3] {
    const asp = innerWidth / innerHeight, side = asp > 0.95;
    const d =
      (side
        ? Math.max(w / (0.5 * 2 * tanH * asp), h / (0.74 * 2 * tanH))
        : Math.max(w / (0.92 * 2 * tanH * asp), h / (0.5 * 2 * tanH))) * near;
    const vd = viewDir.clone().normalize(), fwd = vd.clone().negate();
    const right = V().crossVectors(fwd, V(0, 1, 0)).normalize(), up = V().crossVectors(right, fwd);
    const visH = 2 * d * tanH, visW = visH * asp;
    const tgt = center.clone().add(side ? right.multiplyScalar(-0.2 * visW) : up.multiplyScalar(-0.19 * visH));
    return [tgt.clone().add(vd.multiplyScalar(d)), tgt];
  }
  let KEYS: Key[] = [];
  function buildKeys() {
    const asp = innerWidth / innerHeight, mob = asp < 0.95;
    const hf = frameOn(H0, 3, 2, V(0, 0, 1)), hf2 = frameOn(H0, 3, 2, V(0.04, 0.02, 1), 0.95);
    const sf = frameOn(S0, SR * 2.1, SR * 2.1, V(0, 0.08, 1)), sf2 = frameOn(S0, SR * 2.1, SR * 2.1, V(-0.08, 0.04, 1), 0.92);
    const gf = frameOn(G0, 4.3, 3.0, V(0, 0.05, 1)), gf2 = frameOn(G0, 4.3, 3.0, V(0.06, 0.06, 1), 0.96);
    const qf = frameOn(Q0, 3.1, 2.1, V(0, 1, 0.42)), qf2 = frameOn(Q0, 3.6, 3.6, V(0.05, 1, 0.55), 1.1);
    const z0 = mob ? 20 : 14.5;
    KEYS = [
      [0.0, V(0, 0, z0), V(0, 2.4, 0)],
      [0.08, V(0.3, 0.35, z0 - 2.5), V(0, 2.2, 0)],
      [0.165, V(0.7, 1.0, 3.8), V(-0.2, 1.3, -8)],
      [0.218, ...hf],
      [0.335, ...hf2],
      [0.41, ...sf],
      [0.53, ...sf2],
      [0.592, ...gf],
      [0.735, ...gf2],
      [0.8, ...qf],
      [0.865, ...qf2],
      [0.905, V(0, 1.6, 9.5), V(0, -0.2, -8)],
      [0.955, V(0, 0.1, z0 - 3), V(0, 2.3, -30)],
      [1.0, V(0, 0, z0 - 2), V(0, 2.3, -30)],
    ];
  }
  function camAt(p: number, outP: THREE.Vector3, outT: THREE.Vector3) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smr(a[0], b[0], p);
    outP.lerpVectors(a[1], b[1], t);
    outT.lerpVectors(a[2], b[2], t);
  }

  const pointer = new THREE.Vector2(9, 9), ray = new THREE.Raycaster();
  let pointerOn = false;
  on(
    "pointermove",
    (e) => {
      pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      pointerOn = true;
    },
    { passive: true }
  );
  const offPointer = () => {
    pointerOn = false;
  };
  document.addEventListener("pointerleave", offPointer);
  offs.push(() => document.removeEventListener("pointerleave", offPointer));

  /* ---------- the hero card ---------- */
  const tmpV = V(), tmpE = new THREE.Euler();
  function poseHero(card: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>, p: number, t: number) {
    const vis = p > 0.125 && p < 0.43;
    card.visible = vis;
    if (!vis) return;
    const a = easeOut(clamp((p - 0.13) / (0.218 - 0.13)));
    const st = V(-7.5, -1.2, -11), c1 = V(-4, 3.2, -6);
    const u = 1 - a;
    card.position.set(
      u * u * st.x + 2 * u * a * c1.x + a * a * H0.x,
      u * u * st.y + 2 * u * a * c1.y + a * a * H0.y,
      u * u * st.z + 2 * u * a * c1.z + a * a * H0.z
    );
    const flip = smr(0.236, 0.292, p);
    const ex = sm(0.345, 0.41, p);
    card.position.add(tmpV.set(ex * ex * 10, ex * 3.5, -ex * 5));
    tmpE.set(
      u * u * 4.2 + ex * 2.5 + Math.sin(t * 0.7) * 0.03,
      flip * Math.PI + u * 1.3 - ex * 1.4 + Math.sin(t * 0.5) * 0.04,
      u * 0.6 - 0.04 + ex * 0.6
    );
    card.quaternion.setFromEuler(tmpE);
    card.scale.setScalar(lerp(0.55, 1, a));
    const U = card.material.uniforms;
    U.uCurl.value = Math.sin(flip * Math.PI) * 0.75 + u * 0.4 + ex * 0.6;
    U.uFlut.value = 0.03 + u * 0.14 + ex * 0.12;
    U.uDraw.value = smr(0.272, 0.338, p);
  }

  /* ---------- Meet Christopher: four printed photos fan in; the active one lifts forward ---------- */
  const statesEls = [...root.querySelectorAll<HTMLElement>("#states li")];
  let forceState = -1; // set while Hear it plays
  function posePolas(p: number, t: number) {
    const inA = p > 0.55 && p < 0.79;
    const sub = clamp((p - 0.6) / (0.728 - 0.6));
    const active = forceState >= 0 ? forceState : Math.min(3, Math.floor(sub * 4));
    statesEls.forEach((el, k) => el.classList.toggle("act", k === active));
    polas.forEach((pl, k) => {
      const m = pl.mesh;
      m.visible = inA;
      if (!inA) return;
      const ein = easeOut(clamp((p - 0.56 - k * 0.008) / 0.05));
      const eout = sm(0.735 + k * 0.006, 0.785 + k * 0.006, p);
      const isA = k === active && p > 0.596 ? 1 : 0;
      pl.w += (isA - pl.w) * (RM ? 1 : 0.12);
      const w = pl.w;
      const row = V(G0.x - 1.55 + k * 1.03, G0.y - 0.95 + Math.sin(t * 0.6 + k) * 0.03, G0.z + k * 0.02);
      const lifted = V(G0.x + (k - 1.5) * 0.1, G0.y + 0.72, G0.z + 1.0);
      const tgt = row.lerp(lifted, w);
      const P = V(9 + k * 1.5, 3 - k, -7 - k * 2).lerp(tgt, ein);
      P.add(V(eout * eout * 14, eout * 4 + Math.sin(eout * 3) * 1.2, -eout * 6));
      m.position.copy(P);
      tmpE.set(
        (1 - ein) * 2.4 + eout * 2 + Math.sin(t * 0.8 + k) * 0.03,
        (1 - ein) * 1.2 - eout * 1.1 + Math.sin(t * 0.6 + k * 2) * 0.05,
        lerp((1.5 - k) * 0.08, 0.02, w) + (1 - ein) * 0.5
      );
      m.quaternion.setFromEuler(tmpE);
      m.scale.setScalar(lerp(0.7, 1.12, w));
      const U = m.material.uniforms;
      U.uFlut.value = 0.012 + (1 - ein) * 0.1 + eout * 0.1;
      U.uCurl.value = (1 - ein) * 0.3 + eout * 0.4 + 0.05;
      U.uDim.value = lerp(0.72, 1.04, w);
    });
  }

  /* ---------- the after-conversation postcard: stamp, fold into a plane, fly to the horizon ---------- */
  const UP = V(0, 1, 0), lookM = new THREE.Matrix4(), qFace = new THREE.Quaternion(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
  let shakeT = -9, stamped = false;
  const flightS = (p: number) => {
    const fs = clamp((p - 0.884) / (0.955 - 0.884));
    return fs * fs * (1.6 - 0.6 * fs);
  };
  const FL = [V(0, 0.6, -6), V(1.5, 4, -30), V(4, 9, -90)];
  const flyA = V(), flyB = V(), flyC = V(), flyQ = V();
  function flightPt(s: number, out: THREE.Vector3) {
    const u = 1 - s;
    flyQ.copy(Q0).add(V(0, 0.45, 0));
    flyA.copy(FL[0]).add(flyQ);
    flyB.copy(FL[1]).add(flyQ);
    flyC.copy(FL[2]).add(flyQ);
    return out
      .set(0, 0, 0)
      .addScaledVector(flyQ, u * u * u)
      .addScaledVector(flyA, 3 * u * u * s)
      .addScaledVector(flyB, 3 * u * s * s)
      .addScaledVector(flyC, s * s * s);
  }
  function posePost(card: NonNullable<typeof after>, rib: NonNullable<typeof trail>, p: number, now: number) {
    const vis = p > 0.735 && p < 0.97;
    card.visible = vis;
    rib.visible = vis && p > 0.88;
    if (!vis) return;
    const a = easeOut(clamp((p - 0.745) / (0.8 - 0.745)));
    const u = 1 - a;
    const st = V(8, 3, -6);
    const lift = sm(0.835, 0.86, p);
    const yaw = (smr(0.84, 0.875, p) * Math.PI) / 2;
    const base = V(lerp(st.x, Q0.x, a), lerp(st.y, Q0.y, a) + Math.sin(a * Math.PI) * 1.2 + lift * 0.45, lerp(st.z, Q0.z, a));
    // flat card: rotate -90 about X then yaw about world Y
    qFace.setFromEuler(new THREE.Euler(0, yaw + u * 1.4, 0)).multiply(tmpQ.setFromEuler(new THREE.Euler(-Math.PI / 2 + u * 2.6, 0, u * 0.8)));
    const U = card.material.uniforms;
    U.uFold.value.set(smr(0.842, 0.868, p), smr(0.858, 0.886, p));
    U.uFlut.value = 0.02 + u * 0.12;
    U.uCurl.value = u * 0.5 + Math.sin(lift * Math.PI) * 0.15;
    // stamp
    const sp = smr(0.806, 0.816, p);
    U.uStamp.value.set(lerp(0.62, 1, sp), sp);
    if (p > 0.814 && !stamped) {
      stamped = true;
      shakeT = now;
    }
    if (p < 0.8) stamped = false;
    // flight
    const fs = clamp((p - 0.884) / (0.955 - 0.884));
    const s = flightS(p);
    if (fs > 0) {
      const P = flightPt(s, V()), dir = flightPt(Math.min(1, s + 0.01), V()).sub(P).normalize();
      const yv = V().crossVectors(UP, dir).normalize(), zv = V().crossVectors(dir, yv);
      lookM.makeBasis(dir, yv, zv);
      tmpQ2.setFromRotationMatrix(lookM);
      tmpQ2.multiply(tmpQ.setFromAxisAngle(V(1, 0, 0), Math.sin(s * 5.5) * 0.35 * (1 - s)));
      qFace.slerp(tmpQ2, smr(0, 0.12, fs));
      base.copy(P);
      card.scale.setScalar(1);
    }
    card.position.copy(base);
    card.quaternion.copy(qFace);
    // trail
    const g = rib.geometry, P = g.attributes.position.array as Float32Array, A = g.attributes.aA.array as Float32Array;
    for (let j = 0; j < TS; j++) {
      const sj = Math.max(0, s - j * 0.0014), q = flightPt(sj, V()), d = flightPt(Math.min(1, sj + 0.01), V()).sub(q).normalize();
      const side = V().crossVectors(d, UP).normalize();
      q.addScaledVector(d, -1.4);
      const wdt = 0.22 * (0.35 + (0.65 * j) / TS) * (0.4 + s);
      P.set([q.x - side.x * wdt, q.y - side.y * wdt, q.z - side.z * wdt, q.x + side.x * wdt, q.y + side.y * wdt, q.z + side.z * wdt], j * 6);
      const al = Math.pow(1 - j / TS, 1.6) * sm(0, 0.05, sj) * sm(0.04, 0.12, s);
      A[j * 2] = A[j * 2 + 1] = al;
    }
    g.attributes.position.needsUpdate = g.attributes.aA.needsUpdate = true;
    rib.material.uniforms.uO.value = sm(0.885, 0.9, p) * (1 - sm(0.95, 0.97, p));
  }

  // speaking frames on his polaroid while a clip plays
  let speakTimer = 0;
  function speakFrames(on: boolean) {
    const pl = polas[2];
    if (!pl) return;
    clearInterval(speakTimer);
    const frames: ImgName[] = ["speak-open", "speak-half", "speak-closed", "speak-half"];
    let k = 0;
    const draw = (name: ImgName) => {
      drawPolaroid(pl.ctx, imgs[name] || imgs["speak-open"], pl.cap);
      pl.tex.needsUpdate = true;
    };
    if (on) speakTimer = window.setInterval(() => draw(frames[k++ % 4]), 140);
    else draw("speak-open");
  }
  const hear = createHear($<HTMLButtonElement>("#hear"), $("#sub"), {
    lang: () => lang,
    onState: (s) => {
      forceState = s;
    },
    onSpeak: speakFrames,
  });

  /* ---------- main loop ---------- */
  let q = RM ? snap(targetP) : 0, p = 0, pPrev = 0, tAcc = 0, last = performance.now() / 1000, bend = 0, ready = false;
  const camP = V(0, 0, 14.5), camT = V(0, 2.4, 0), wantP = V(), wantT = V();
  // clearing zones: the flock parts around each subject's line of sight, the pointer and the lens
  const zone = (r0: number, rk = 0): Zone => ({ a: V(), b: V(), r0, rk, w: 0 });
  const zHero = zone(2.0), zPolas = zone(3.2), zPost = zone(2.6), zPointer = zone(0.5, 0.05), zLens = zone(1.6);
  const zones = [zHero, zPolas, zPost, zPointer, zLens];
  // a zone from the camera to a subject, on while the story is at it
  const aim = (z: Zone, at: THREE.Vector3, w: number) => {
    z.a.copy(camP);
    z.b.copy(at);
    z.w = w;
  };
  function tick() {
    const now = performance.now() / 1000, dt = Math.min(0.05, now - last);
    last = now;
    if (document.hidden) return;
    if (RM) q = snap(targetP);
    else q += (targetP - q) * (1 - Math.exp(-dt * 6));
    p = Math.min(1, q / QP);
    const vel = Math.abs(p - pPrev) / Math.max(dt, 1e-3);
    pPrev = p;
    updateHTML(beats, q, 1, RM);
    dust.draw(q, 1);
    const e = clamp((q - QE) / (1 - QE));
    if (!ready || !renderer || !flock || !sky || !hero || !after || !trail || !ending) return;
    tAcc += dt * (RM ? 0.25 : 1);
    bend += (Math.min(0.32, vel * 1.6) - bend) * (1 - Math.exp(-dt * 4));
    const t = tAcc;
    shared.uTime.value = t;

    camAt(p, wantP, wantT);
    // during the flight the camera keeps the airplane framed
    const fw = sm(0.862, 0.886, p) * (1 - sm(0.94, 0.965, p));
    if (fw > 0) {
      flightPt(flightS(p), tmpV);
      wantT.lerp(tmpV, fw);
      wantP.lerp(tmpV.add(V(0, 1.6, 7.5)), fw * 0.35 * sm(0.884, 0.93, p));
    }
    if (e > 0) ending.endCam(e, wantT);
    ending.light(e);
    if (RM) {
      camP.copy(wantP);
      camT.copy(wantT);
    } else {
      const k = 1 - Math.exp(-dt * 3.4);
      camP.lerp(wantP, k);
      camT.lerp(wantT, k);
    }
    camera.position.copy(camP);
    // breathing + stamp shake
    const sh = Math.exp(-(now - shakeT) * 9) * (RM ? 0 : 1);
    camera.position.x += Math.sin(t * 0.31) * 0.05 + Math.sin(now * 71) * sh * 0.05;
    camera.position.y += Math.sin(t * 0.23) * 0.04 + Math.cos(now * 63) * sh * 0.06;
    camera.lookAt(camT);
    sky.position.copy(camera.position);

    // focus distance follows the subject
    const subj =
      p < 0.12
        ? 12
        : p < 0.36
          ? camP.distanceTo(H0)
          : p < 0.56
            ? camP.distanceTo(S0) - SR * 0.4
            : p < 0.76
              ? camP.distanceTo(G0)
              : p < 0.89
                ? camP.distanceTo(Q0)
                : 14;
    shared.uFocus.value += (subj - shared.uFocus.value) * 0.08;
    shared.uDof.value = p < 0.12 || p > 0.9 ? 0.04 : 0.065;

    aim(zHero, H0, sm(0.15, 0.2, p) * (1 - sm(0.33, 0.37, p)));
    aim(zPolas, G0, sm(0.56, 0.6, p) * (1 - sm(0.73, 0.77, p)));
    aim(zPost, Q0, sm(0.74, 0.79, p) * (1 - sm(0.88, 0.92, p)));
    if (pointerOn && !MOB) {
      ray.setFromCamera(pointer, camera);
      zPointer.a.copy(ray.ray.origin);
      zPointer.b.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 60);
      zPointer.w = 0.85;
    } else zPointer.w = 0;
    zLens.a.copy(camera.position);
    zLens.b.copy(camera.position).addScaledVector(camera.getWorldDirection(tmpV), 2.2);
    zLens.w = p > 0.12 && p < 0.2 ? 0.25 : 1; // let cards whip past the lens during the dive

    flock.material.uniforms.uBend.value = bend;
    const ff = smr(0.03, 0.1, e); // cards fold into planes for the murmuration
    flock.material.uniforms.uFold.value.set(ff, ff);
    const rects: Rect[] = [];
    for (const b of beats) if (b.on && b.ndc) rects.push(b.ndc);
    const form = flock.update(p, t, RM ? dt * 0.25 : dt, zones, {
      camera,
      rects,
      sphere: { c: S0, r: SR, q: drag.q },
      e,
      endCard: ending.endCard,
    });
    drag.update(form, dt, S0, SR, tanH);
    poseHero(hero, p, t);
    posePolas(p, t);
    posePost(after, trail, p, now);
    ending.poseC(e, t, renderer.getPixelRatio());
    ending.render(scene, camera, e, t, now);
  }
  gsap.ticker.add(tick);

  const measureAll = () => {
    measureBeats(beats);
    dust.measure();
  };
  let rsz = 0;
  on("resize", () => {
    clearTimeout(rsz);
    rsz = window.setTimeout(() => {
      measureAll();
      if (!renderer || !ready) return;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
      buildKeys();
      ending?.build();
    }, 150);
  });
  document.fonts.ready.then(() => {
    if (!disposed) requestAnimationFrame(measureAll);
  });

  if (renderer)
    build(renderer)
      .then(() => {
        if (disposed) return;
        buildKeys();
        ending?.build();
        measureAll();
        ready = true;
      })
      .catch((err) => {
        console.warn("scene failed", err);
        root.classList.add("nogl");
      });
  updateHTML(beats, 0, 1, RM);

  let langT = 0;
  return {
    setLang(next) {
      if (next === lang) return;
      lang = next;
      hear.stop();
      clearTimeout(langT);
      langT = window.setTimeout(measureAll, 50); // the CTA got wider or narrower
    },
    dispose() {
      disposed = true;
      clearTimeout(langT);
      hear.dispose();
      clearInterval(speakTimer);
      statesEls.forEach((el) => el.classList.remove("act"));
      images.dispose();
      drag.dispose();
      gsap.ticker.remove(tick);
      gsap.ticker.remove(lenisRaf);
      gsap.ticker.lagSmoothing(500, 33);
      st.kill();
      lenis?.destroy();
      history.scrollRestoration = restoration;
      clearTimeout(rsz);
      offs.forEach((off) => off());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => mt.dispose());
      });
      textures.forEach((t) => t.dispose());
      ending?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      glCanvas.remove();
      dust.dispose();
      dustCanvas.remove();
      for (const b of beats) {
        b.el.classList.remove("on");
        b.el.style.maskImage = b.el.style.webkitMaskImage = "";
      }
      root.classList.remove("nogl");
    },
  };
}
