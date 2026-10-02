import * as THREE from "three";
import { clamp, lerp, rng, sm, smr } from "./math";
import { PAPER_FRAG, PAPER_VERT } from "./shaders";

// The flock: every language's postcard riding the harbour wind, drawn as one
// instanced mesh over the card atlas.

export type Uniforms = Record<string, THREE.IUniform>;

export function paperMat(shared: Uniforms, defs: Record<string, string>, extra: Uniforms) {
  return new THREE.ShaderMaterial({
    defines: defs,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared,
      uBend: { value: 0 },
      uCurl: { value: 0 },
      uFlut: { value: 0 },
      uFold: { value: new THREE.Vector2() },
      uSize: { value: new THREE.Vector2(1, 1) },
      uDim: { value: 1 },
      ...extra,
    },
    vertexShader: PAPER_VERT,
    fragmentShader: PAPER_FRAG,
  });
}

type Card = { ph: number; sp: number; spin: number; sc: number };
// a clearing zone: cards inside the capsule a..b (radius r0 growing by rk) are pushed out
export type Zone = { a: THREE.Vector3; b: THREE.Vector3; r0: number; rk: number; w: number };

export function createFlock(n: number, featured: number, atlas: THREE.Texture, cols: number, rows: number, shared: Uniforms) {
  const pos = new Float32Array(n * 3), off = new Float32Array(n * 3), cards: Card[] = [];
  const geo = new THREE.PlaneGeometry(1, 0.68, 12, 8);
  const data = new Float32Array(n * 4);
  const R = rng(2024);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = -26 + R() * 52;
    pos[i * 3 + 1] = -4.5 + R() * 13;
    pos[i * 3 + 2] = -34 + R() * 41;
    const ph = R(), sp = 0.75 + R() * 0.5;
    data.set([ph, sp, i % 183, 183 + Math.floor(R() * 9)], i * 4);
    cards.push({ ph, sp, spin: (R() - 0.5) * 0.9, sc: 0.55 + R() * 0.5 + (i < featured ? 0.1 : 0) });
  }
  geo.setAttribute("aData", new THREE.InstancedBufferAttribute(data, 4));
  const material = paperMat(shared, { FLOCK: "" }, { tAtlas: { value: atlas }, uGrid: { value: new THREE.Vector2(cols, rows) } });
  material.uniforms.uSize.value.set(1, 0.68);
  const mesh = new THREE.InstancedMesh(geo, material, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const push = [0, 0, 0], sh = [0, 0];
  const exO = new Float32Array(n * 3), fadeK = new Float32Array(n).fill(1), prj = new THREE.Vector3();
  const camR = new THREE.Vector3(), camU = new THREE.Vector3();

  const lookM = new THREE.Matrix4(), tmpQ2 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const gold = Math.PI * (3 - Math.sqrt(5));

  // returns how far the featured cards have gathered into the sphere (0..1)
  function update(p: number, t: number, dt: number, zones: Zone[], view: FlockView) {
    const { camera, rects, sphere } = view;
    const form = sm(0.37, 0.45, p) * (1 - sm(0.535, 0.6, p));
    const rot = t * 0.07 + p * 3.2;
    camera.updateMatrixWorld();
    camR.setFromMatrixColumn(camera.matrixWorld, 0);
    camU.setFromMatrixColumn(camera.matrixWorld, 1);
    const asp = camera.aspect, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ke = 1 - Math.exp(-dt * 12), kf = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < n; i++) {
      const c = cards[i], k3 = i * 3;
      let x = pos[k3], y = pos[k3 + 1], z = pos[k3 + 2];
      const ph = c.ph * 6.283;
      const vx = (0.75 + 0.35 * Math.sin(0.19 * y + 0.11 * z + t * 0.13 + ph)) * c.sp;
      const vy = 0.28 * Math.sin(0.17 * x + t * 0.29 + ph) + 0.18 * Math.cos(0.13 * z - t * 0.21);
      const vz = 0.24 * Math.sin(0.15 * y + 0.1 * x + t * 0.23 + ph * 0.5);
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (y > 9.5) y -= 0.02;
      if (y < -5) y += 0.02;
      if (x > 27 && (i >= featured || form < 0.01)) {
        x -= 54;
        y = -4 + ((i * 37) % 13);
      }
      pos[k3] = x;
      pos[k3 + 1] = y;
      pos[k3 + 2] = z;
      // clearing zones (subjects + pointer)
      push[0] = push[1] = push[2] = 0;
      for (const zn of zones) if (zn.w > 0.001) segPush(x, y, z, zn, push);
      const kk = 1 - Math.exp(-dt * 3.2);
      off[k3] += (push[0] - off[k3]) * kk;
      off[k3 + 1] += (push[1] - off[k3 + 1]) * kk;
      off[k3 + 2] += (push[2] - off[k3 + 2]) * kk;
      tmpV.set(x + off[k3], y + off[k3 + 1], z + off[k3 + 2]);
      tmpE.set(ph * 3 + t * c.spin, 0.55 * Math.sin(t * 0.21 + ph) + vy * 0.4, 0.3 * Math.sin(t * 0.27 + ph * 2) - 0.15);
      tmpQ.setFromEuler(tmpE);
      let s = c.sc;
      if (i < featured) {
        // the featured 183 gather into a slow sphere, one language per card, facing out
        const mi = smr(0, 1, clamp(form * 1.45 - (i / featured) * 0.45));
        if (mi > 0) {
          const yy = 1 - ((i + 0.5) / featured) * 2, rr = Math.sqrt(1 - yy * yy), th = gold * i + rot;
          tmpS.set(Math.cos(th) * rr * sphere.r, yy * sphere.r * 0.92, Math.sin(th) * rr * sphere.r).applyQuaternion(sphere.q).add(sphere.c);
          tmpV.lerp(tmpS, mi);
          lookM.lookAt(tmpS, sphere.c, UP);
          tmpQ2.setFromRotationMatrix(lookM);
          tmpQ.slerp(tmpQ2, mi);
          s = lerp(s, 0.95, mi);
        }
      } else s *= 1 - smr(0, 0.6, form);
      // keep the copy clean: slide cards out of the text panels, fade any that still overlap
      let ex = 0, ey = 0, hit = false, near = false;
      if (rects.length) {
        prj.copy(tmpV).project(camera);
        const dist = Math.max(0.5, tmpV.distanceTo(camera.position)), half = (s * 0.62) / (dist * tanH);
        if (prj.z < 1)
          for (const R of rects)
            if (clearShift(prj.x, prj.y, half / asp, half, R, sh)) {
              ex += sh[0];
              ey += sh[1];
            }
        ex *= dist * tanH * asp;
        ey *= dist * tanH;
      }
      exO[k3] += (camR.x * ex + camU.x * ey - exO[k3]) * ke;
      exO[k3 + 1] += (camR.y * ex + camU.y * ey - exO[k3 + 1]) * ke;
      exO[k3 + 2] += (camR.z * ex + camU.z * ey - exO[k3 + 2]) * ke;
      tmpV.x += exO[k3];
      tmpV.y += exO[k3 + 1];
      tmpV.z += exO[k3 + 2];
      if (rects.length) {
        prj.copy(tmpV).project(camera);
        const dist = Math.max(0.5, tmpV.distanceTo(camera.position)), half = (s * 0.62) / (dist * tanH);
        if (prj.z < 1)
          for (const R of rects) {
            if (clearShift(prj.x, prj.y, half / asp, half, R, sh)) hit = true;
            else if (clearShift(prj.x, prj.y, (half * 1.6) / asp, half * 1.6, R, sh)) near = true;
          }
      }
      fadeK[i] = hit ? 0 : fadeK[i] + ((near ? 0 : 1) - fadeK[i]) * kf;
      s *= fadeK[i];
      tmpS.set(s, s, s);
      tmpM.compose(tmpV, tmpQ, tmpS);
      mesh.setMatrixAt(i, tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return form;
  }

  return { mesh, material, update };
}

export type Rect = [number, number, number, number];
export type FlockView = {
  camera: THREE.PerspectiveCamera;
  rects: Rect[]; // the visible copy panels in NDC; cards slide out of them and fade if they still overlap
  sphere: { c: THREE.Vector3; r: number; q: THREE.Quaternion };
};

// how far (NDC) a card at (x,y) with half-size (rx,ry) must move to clear the rect; prefers vertical exits (the wind is horizontal)
function clearShift(x: number, y: number, rx: number, ry: number, R: Rect, out: number[]) {
  const [x0, x1, y0, y1] = R;
  out[0] = out[1] = 0;
  if (x + rx < x0 || x - rx > x1 || y + ry < y0 || y - ry > y1) return false;
  const up = y1 + ry - y, dn = y0 - ry - y, rt = x1 + rx - x, lf = x0 - rx - x;
  const opts = [
    [0, up, up],
    [0, dn, -dn],
    [rt, 0, rt * 1.6],
    [lf, 0, -lf * 1.6],
  ];
  let best = opts[0];
  for (const o of opts) if (o[2] < best[2]) best = o;
  out[0] = best[0];
  out[1] = best[1];
  return true;
}

function segPush(px: number, py: number, pz: number, zn: Zone, out: number[]) {
  const { a, b, r0, rk, w } = zn;
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L2 = abx * abx + aby * aby + abz * abz;
  let t = ((px - a.x) * abx + (py - a.y) * aby + (pz - a.z) * abz) / L2;
  t = Math.min(1, Math.max(0, t));
  const cx = a.x + abx * t, cy = a.y + aby * t, cz = a.z + abz * t;
  const dx = px - cx, dy = py - cy, dz = pz - cz, d = Math.hypot(dx, dy, dz) + 1e-4;
  const r = r0 + rk * t * Math.sqrt(L2);
  if (d < r) {
    const k = ((r - d) / d) * w;
    out[0] += dx * k;
    out[1] += dy * k;
    out[2] += dz * k;
  }
}
