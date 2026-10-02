import * as THREE from "three";
import type { Card } from "./flock";
import { clamp, lerp, smr, sm } from "./math";

/* The ending, one path: murmuration, harbour lights, the world was a postcard.
   Ending progress e (0..1):
     .00-.66 the flock folds into paper planes, chases the plane, then departs over a long window
             (some cross the view; a few stay aloft through the night) */

type Key = [number, THREE.Vector3, THREE.Vector3];
export type EndingEnv = {
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

  // the camera follows the swarm, then lifts toward the sky
  function endCam(e: number, wantT: THREE.Vector3) {
    swarmC(smr(0.03, 0.3, e), eA);
    wantT.lerp(eA, 0.55 * sm(0.02, 0.12, e) * (1 - smr(0.3, 0.52, e)));
  }

  return { endCard, endCam };
}
