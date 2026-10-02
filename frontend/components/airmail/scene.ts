import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, JP, LANGS, drawAtlas } from "./cards";
import { createFlock, type Uniforms, type Zone } from "./flock";
import { FONT, readFonts } from "./paper";
import { DOME_FRAG, DOME_VERT } from "./shaders";

/* "Airmail in flight": the landing's WebGL harbour. Every language's postcard
   rides the evening wind over the water. Client only; loaded with import(). */

export type AirmailScene = { dispose: () => void };

const lin = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Color().setRGB(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, THREE.LinearSRGBColorSpace);
};

export function createAirmailScene(root: HTMLElement): AirmailScene {
  const MOB = Math.min(innerWidth, innerHeight * 1.2) < 760 || innerWidth < 760;
  let disposed = false;
  const offs: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
    addEventListener(type, fn, o);
    offs.push(() => removeEventListener(type, fn, o));
  };

  // the canvas belongs to the scene, so a remount never inherits a spent context
  const glCanvas = document.createElement("canvas");
  glCanvas.id = "gl";
  glCanvas.setAttribute("aria-hidden", "true");
  root.prepend(glCanvas);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    glCanvas.remove();
    root.classList.add("nogl");
    return { dispose: () => root.classList.remove("nogl") };
  }

  const textures: THREE.Texture[] = [];
  const canvasTex = (c: HTMLCanvasElement, srgb = true, mips = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
  let ready = false;

  async function build() {
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

    renderer.setPixelRatio(Math.min(devicePixelRatio, MOB ? 1.5 : 1.75));
    renderer.setSize(innerWidth, innerHeight, false);

    // sky dome
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 48, 32),
      new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: shared, vertexShader: DOME_VERT, fragmentShader: DOME_FRAG })
    );
    sky.renderOrder = -1;
    scene.add(sky);

    flock = createFlock(N, F, canvasTex(drawAtlas(MOB)), ATLAS_COLS, ATLAS_ROWS, shared);
    scene.add(flock.mesh);
    renderer.compile(scene, camera);
  }

  const zones: Zone[] = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r0: 1.6, rk: 0, w: 1 }]; // keep the lens clear
  let last = performance.now() / 1000, tAcc = 0, raf = 0;
  const tmpV = new THREE.Vector3();
  function tick() {
    raf = requestAnimationFrame(tick);
    const now = performance.now() / 1000, dt = Math.min(0.05, now - last);
    last = now;
    if (document.hidden || !ready || !flock || !sky) return;
    tAcc += dt;
    const t = tAcc;
    shared.uTime.value = t;
    camera.lookAt(0, 2.4, 0);
    sky.position.copy(camera.position);
    zones[0].a.copy(camera.position);
    zones[0].b.copy(camera.position).addScaledVector(camera.getWorldDirection(tmpV), 2.2);
    flock.update(t, dt, zones);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(tick);

  let rsz = 0;
  on("resize", () => {
    clearTimeout(rsz);
    rsz = window.setTimeout(() => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight, false);
    }, 150);
  });

  build()
    .then(() => {
      if (!disposed) ready = true;
    })
    .catch((err) => {
      console.warn("scene failed", err);
      root.classList.add("nogl");
    });

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(rsz);
      offs.forEach((off) => off());
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => mt.dispose());
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      glCanvas.remove();
      root.classList.remove("nogl");
    },
  };
}
