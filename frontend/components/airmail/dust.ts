import * as THREE from "three";
import type { Beat } from "./beats";
import { clamp, rng } from "./math";
import { cv } from "./paper";
import { DUST_FS, DUST_VS } from "./shaders";

/* Copy leaves as dust blown by the wind, and gathers back on the way in. Each
   panel's glyphs are sampled into particles on their own WebGL layer; positions
   are a pure function of the sweep, so scrolling back reassembles the text. */

// paint every glyph, button outline and select box of a panel in white
function inkOf(root: HTMLElement, x: CanvasRenderingContext2D, r: DOMRect) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), rg = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const pe = node.parentElement, txt = (node as Text).data;
    if (!pe || pe.closest(".sr, select, #sub, svg")) continue;
    const cs = getComputedStyle(pe);
    x.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (/\s/.test(ch)) continue;
      rg.setStart(node, i);
      rg.setEnd(node, i + 1);
      const rc = rg.getClientRects()[0];
      if (!rc || !rc.width) continue;
      x.fillText(ch, rc.left - r.left, rc.top - r.top + x.measureText(ch).fontBoundingBoxAscent);
    }
  }
  const box = (el: Element, rad: (q: DOMRect) => number) => {
    const q = el.getBoundingClientRect();
    if (!q.width) return;
    x.beginPath();
    x.roundRect(q.left - r.left, q.top - r.top, q.width, q.height, rad(q));
    x.stroke();
  };
  x.lineWidth = 2.4;
  root.querySelectorAll("button.cta").forEach((el) => box(el, () => 6));
  x.lineWidth = 1.6;
  root.querySelectorAll("select").forEach((el) => box(el, () => 6));
  root.querySelectorAll(".hear").forEach((el) => box(el, (q) => q.height / 2));
}

export function createDust(canvas: HTMLCanvasElement, beats: Beat[], RM: boolean, MOB: boolean) {
  let dR: THREE.WebGLRenderer | null = null, dCam: THREE.OrthographicCamera | null = null;
  const dScene = new THREE.Scene();
  let ready = false, drawn = false;

  const drop = (b: Beat) => {
    if (!b.pts || !b.glow) return;
    dScene.remove(b.pts, b.glow);
    b.pts.geometry.dispose();
    (b.pts.material as THREE.Material).dispose();
    (b.glow.material as THREE.Material).dispose();
    b.pts = b.glow = undefined;
  };

  function measure() {
    for (const b of beats) b.ex = b.el.getBoundingClientRect().left;
    if (RM) return;
    if (!dR) {
      try {
        dR = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
        dR.setClearColor(0x000000, 0);
      } catch {
        dR = null;
        return;
      }
    }
    dR.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    dR.setSize(innerWidth, innerHeight, false);
    dCam = new THREE.OrthographicCamera(0, innerWidth, 0, innerHeight, -1, 1);
    const S = 2, budget = MOB ? 40000 : 200000;
    const jobs: { b: Beat; r: DOMRect; w: number; h: number; d: Uint8ClampedArray; n: number }[] = [];
    for (const b of beats) {
      const r = b.el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const w = Math.ceil(r.width * S), h = Math.ceil(r.height * S), x = cv(w, h).getContext("2d", { willReadFrequently: true })!;
      x.setTransform(S, 0, 0, S, 0, 0);
      x.fillStyle = x.strokeStyle = "#fff";
      inkOf(b.el, x, r);
      const d = x.getImageData(0, 0, w, h).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 100) n++;
      jobs.push({ b, r, w, h, d, n });
    }
    const total = jobs.reduce((a, j) => a + j.n, 0), st = Math.max(1, Math.sqrt(total / budget));
    for (const j of jobs) {
      const R = rng(j.w * 7 + j.h), O: number[] = [], Sd: number[] = [];
      let lo = 1e9, hi = -1e9;
      for (let y = 0; y < j.h; y += st)
        for (let x = 0; x < j.w; x += st) {
          const xx = Math.min(j.w - 1, (x + R() * st) | 0), yy = Math.min(j.h - 1, (y + R() * st) | 0);
          if (j.d[(yy * j.w + xx) * 4 + 3] > 100) {
            const px = j.r.left + xx / S;
            O.push(px, j.r.top + yy / S);
            Sd.push(R(), R(), R());
            lo = Math.min(lo, px);
            hi = Math.max(hi, px);
          }
        }
      drop(j.b);
      if (!O.length) {
        lo = j.r.left;
        hi = j.r.right;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("aO", new THREE.BufferAttribute(new Float32Array(O), 2));
      g.setAttribute("aS", new THREE.BufferAttribute(new Float32Array(Sd), 3));
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((O.length / 2) * 3), 3));
      const pr = dR.getPixelRatio();
      const mk = (glow: boolean) =>
        new THREE.ShaderMaterial({
          vertexShader: DUST_VS,
          fragmentShader: DUST_FS,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneFactor,
          uniforms: {
            uX: { value: 0 },
            uSpan: { value: 1 },
            uMode: { value: 1 },
            uPR: { value: pr },
            uSz: { value: MOB ? 1.05 : 1.25 },
            uGlow: { value: glow ? 1 : 0 },
            uHotK: { value: MOB ? 0.3 : 0.75 },
          },
        });
      const pts = new THREE.Points(g, mk(false)), glow = new THREE.Points(g, mk(true));
      pts.frustumCulled = glow.frustumCulled = false;
      pts.visible = glow.visible = false;
      dScene.add(glow, pts);
      Object.assign(j.b, { pts, glow, dl: lo, dw: Math.max(40, hi - lo), span: Math.max(240, (hi - lo) * 0.85) });
    }
    ready = true;
  }

  // reveal: the hero's own entrance (after the preloader), since it has no scroll-in
  function draw(q: number, reveal: number) {
    if (!ready || !dR || !dCam) return;
    let any = false;
    for (const b of beats) {
      if (!b.pts || !b.glow || b.dl === undefined || b.dw === undefined) continue;
      const [i0, i1, o0, o1] = b.r;
      const a = i0 < 0 ? reveal : clamp((q - i0) / (i1 - i0)), xo = clamp((q - o0) / (o1 - o0));
      const entering = b.on && a > 0 && a < 1, leaving = b.on && a >= 1 && xo > 0 && xo < 1;
      b.pts.visible = b.glow.visible = entering || leaving;
      if (!b.pts.visible) continue;
      any = true;
      const X = entering ? b.dl - b.span - 8 + a * (b.dw + b.span + 16) : b.dl - 8 + xo * (b.dw + b.span + 16);
      for (const m of [b.pts.material, b.glow.material] as THREE.ShaderMaterial[]) {
        m.uniforms.uX.value = X;
        m.uniforms.uSpan.value = b.span;
        m.uniforms.uMode.value = entering ? -1 : 1;
      }
    }
    if (any || drawn) dR.render(dScene, dCam);
    drawn = any;
  }

  return {
    measure,
    draw,
    dispose() {
      beats.forEach(drop);
      for (const b of beats) b.dl = b.dw = undefined;
      dR?.dispose();
      dR?.forceContextLoss();
    },
  };
}
