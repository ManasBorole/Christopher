import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import * as THREE from "three";
import { QE, QP, measureBeats, readBeats, updateHTML } from "./beats";
import { ATLAS_COLS, ATLAS_ROWS, JP, LANGS, drawAtlas } from "./cards";
import { createFlock, type Rect, type Uniforms, type Zone } from "./flock";
import { smr } from "./math";
import { FONT, readFonts } from "./paper";
import { DOME_FRAG, DOME_VERT } from "./shaders";

/* "Airmail in flight": the landing's WebGL harbour. Every language's postcard
   rides the evening wind over the water, and the camera narrates the scroll.
   Client only; loaded with import() after hydration.

   Beats (story progress p, camera damped toward key targets):
     0.000 hero        cam (0,0,14.5) looking up at the flock; horizon low
     0.08-0.165 dive   into the current; card bend rises with scroll speed */

export type AirmailScene = { dispose: () => void };

const lin = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace);
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tanH = Math.tan(THREE.MathUtils.degToRad(35 / 2));
type Key = [number, THREE.Vector3, THREE.Vector3];

export function createAirmailScene(root: HTMLElement): AirmailScene {
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

  const N = MOB ? 183 : 340, F = 183;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 800);
  camera.position.set(0, 0, 14.5);
  let flock: ReturnType<typeof createFlock> | null = null;
  let sky: THREE.Mesh | null = null;

  async function build(gl: THREE.WebGLRenderer) {
    readFonts();
    const fontJobs = [`700 64px ${FONT.display}`, `600 64px ${FONT.display}`, `500 30px ${FONT.sans}`, `600 30px ${FONT.sans}`, `700 30px ${FONT.sans}`, `40px ${FONT.hand}`].map((f) =>
      document.fonts.load(f, "Greetings from Christopher 0123")
    );
    const names = LANGS.map((l) => l.n).join("");
    for (const w of ["400", "500", "700"]) fontJobs.push(document.fonts.load(`${w} 40px ${FONT.jp}`, JP + names));
    for (const f of [FONT.deva, FONT.arab, FONT.hebr]) fontJobs.push(document.fonts.load(`700 40px ${f}`, names));
    await Promise.race([Promise.all(fontJobs), new Promise((r) => setTimeout(r, 6000))]);
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
    gl.compile(scene, camera);
  }

  /* ---------- camera choreography ---------- */
  let KEYS: Key[] = [];
  function buildKeys() {
    const asp = innerWidth / innerHeight, mob = asp < 0.95;
    const z0 = mob ? 20 : 14.5;
    KEYS = [
      [0.0, V(0, 0, z0), V(0, 2.4, 0)],
      [0.08, V(0.3, 0.35, z0 - 2.5), V(0, 2.2, 0)],
      [0.165, V(0.7, 1.0, 3.8), V(-0.2, 1.3, -8)],
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

  /* ---------- main loop ---------- */
  let q = RM ? snap(targetP) : 0, p = 0, pPrev = 0, tAcc = 0, last = performance.now() / 1000, bend = 0, ready = false;
  const camP = V(0, 0, 14.5), camT = V(0, 2.4, 0), wantP = V(), wantT = V(), tmpV = V();
  const zones: Zone[] = [
    { a: V(), b: V(), r0: 0.5, rk: 0.05, w: 0 }, // pointer
    { a: V(), b: V(), r0: 1.6, rk: 0, w: 1 }, // keep the lens clear
  ];
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
    if (!ready || !renderer || !flock || !sky) return;
    tAcc += dt * (RM ? 0.25 : 1);
    bend += (Math.min(0.32, vel * 1.6) - bend) * (1 - Math.exp(-dt * 4));
    const t = tAcc;
    shared.uTime.value = t;

    camAt(p, wantP, wantT);
    if (RM) {
      camP.copy(wantP);
      camT.copy(wantT);
    } else {
      const k = 1 - Math.exp(-dt * 3.4);
      camP.lerp(wantP, k);
      camT.lerp(wantT, k);
    }
    camera.position.copy(camP);
    // breathing
    camera.position.x += Math.sin(t * 0.31) * 0.05;
    camera.position.y += Math.sin(t * 0.23) * 0.04;
    camera.lookAt(camT);
    sky.position.copy(camera.position);

    shared.uFocus.value += ((p < 0.12 ? 12 : 14) - shared.uFocus.value) * 0.08;
    shared.uDof.value = p < 0.12 || p > 0.9 ? 0.04 : 0.065;

    if (pointerOn && !MOB) {
      ray.setFromCamera(pointer, camera);
      zones[0].a.copy(ray.ray.origin);
      zones[0].b.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 60);
      zones[0].w = 0.85;
    } else zones[0].w = 0;
    zones[1].a.copy(camera.position);
    zones[1].b.copy(camera.position).addScaledVector(camera.getWorldDirection(tmpV), 2.2);
    zones[1].w = p > 0.12 && p < 0.2 ? 0.25 : 1; // let cards whip past the lens during the dive

    flock.material.uniforms.uBend.value = bend;
    const rects: Rect[] = [];
    for (const b of beats) if (b.on && b.ndc) rects.push(b.ndc);
    flock.update(t, RM ? dt * 0.25 : dt, zones, camera, rects);
    renderer.render(scene, camera);
  }
  gsap.ticker.add(tick);

  const measureAll = () => measureBeats(beats);
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
        measureAll();
        ready = true;
      })
      .catch((err) => {
        console.warn("scene failed", err);
        root.classList.add("nogl");
      });
  updateHTML(beats, 0, 1, RM);

  return {
    dispose() {
      disposed = true;
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
      renderer?.dispose();
      renderer?.forceContextLoss();
      glCanvas.remove();
      for (const b of beats) {
        b.el.classList.remove("on");
        b.el.style.maskImage = b.el.style.webkitMaskImage = "";
      }
      root.classList.remove("nogl");
    },
  };
}
