import * as THREE from "three";

// Drag the sphere to turn it: trackball, inertia, then it eases back to the slow spin.
// `grab` is a round hit area kept over the sphere while it is formed.
export function createSphereDrag(grab: HTMLElement, camera: THREE.Camera, lenis: { stop(): void; start(): void } | null) {
  const q = new THREE.Quaternion(), angVel = new THREE.Vector3(), qI = new THREE.Quaternion(), dQ = new THREE.Quaternion(), dAx = new THREE.Vector3();
  const prj = new THREE.Vector3();
  let dragging = false, lastX = 0, lastY = 0, lastT = 0;

  const down = (e: PointerEvent) => {
    dragging = true;
    try {
      grab.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
    grab.classList.add("drag");
    lenis?.stop();
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = performance.now();
    angVel.set(0, 0, 0);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY, now = performance.now(), dts = Math.max(8, now - lastT) / 1000;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
    dAx.set(dy, dx, 0);
    const ang = dAx.length() * 0.0065;
    if (ang < 1e-6) return;
    dAx.normalize().applyQuaternion(camera.quaternion);
    dQ.setFromAxisAngle(dAx, ang);
    q.premultiply(dQ);
    angVel.copy(dAx).multiplyScalar(Math.min(6, ang / dts));
  };
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    grab.classList.remove("drag");
    try {
      grab.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    lenis?.start();
  };
  grab.addEventListener("pointerdown", down);
  grab.addEventListener("pointermove", move);
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);

  // spin down, ease home, and keep the hit area over the sphere (form: how gathered it is)
  function update(form: number, dt: number, center: THREE.Vector3, radius: number, tanH: number) {
    if (!dragging) {
      const w = angVel.length();
      if (w > 1e-4) {
        dQ.setFromAxisAngle(dAx.copy(angVel).divideScalar(w), w * dt);
        q.premultiply(dQ);
        angVel.multiplyScalar(Math.exp(-dt * 2.2));
      }
      q.slerp(qI, 1 - Math.exp(-dt * 0.35));
    }
    if (form < 0.75 && !dragging) {
      grab.style.display = "none";
      return;
    }
    prj.copy(center).project(camera);
    const dist = camera.position.distanceTo(center), rpx = (((radius * 1.04) / (dist * tanH)) * innerHeight) / 2;
    const cx = (prj.x * 0.5 + 0.5) * innerWidth, cy = (-prj.y * 0.5 + 0.5) * innerHeight;
    grab.style.display = "block";
    grab.style.width = grab.style.height = (2 * rpx).toFixed(0) + "px";
    grab.style.transform = `translate(${(cx - rpx).toFixed(0)}px,${(cy - rpx).toFixed(0)}px)`;
  }

  return {
    q,
    update,
    dispose() {
      grab.removeEventListener("pointerdown", down);
      grab.removeEventListener("pointermove", move);
      grab.removeEventListener("pointerup", end);
      grab.removeEventListener("pointercancel", end);
      grab.classList.remove("drag");
      grab.style.display = "none";
    },
  };
}
