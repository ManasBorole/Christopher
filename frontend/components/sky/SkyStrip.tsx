"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SkyCourse } from "@vta/shared";
import { cachedSky, getSky } from "../../lib/api";
import { languageColor } from "../../lib/languageColor";
import { buildSky, type SkyModel } from "./days";
import "./sky.css";

// A slim window onto tonight's sky for Home: this month's stars of every
// language over the harbour, drawn once on a 2D canvas (no second WebGL
// context, no three.js). The whole strip opens the full sky.
export default function SkyStrip({ onOpen }: { onOpen: () => void }) {
  const [courses, setCourses] = useState<SkyCourse[] | null>(() => cachedSky());
  const model = useMemo(() => buildSky(courses ?? []), [courses]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    getSky()
      .then((fresh) => live && setCourses((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh)))
      .catch(() => {}); // the strip keeps whatever it has; the full sky offers a retry
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const draw = () => drawStrip(c, model);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [model]);

  const nights = new Set(model.days.filter((d) => !d.pending).map((d) => d.key)).size;
  const line = !nights
    ? "Your first star appears after your first conversation."
    : model.tonight?.pending
      ? model.streak > 1 ? `${model.streak}-day streak, tonight's star is waiting` : "Tonight's star is waiting"
      : model.streak > 1 ? `${model.streak}-day streak, tonight's star is out` : "Tonight's star is out";

  return (
    <button type="button" className="sky-strip" onClick={onOpen} aria-label={`Open your sky. ${nights ? `${nights} ${nights === 1 ? "night" : "nights"} so far.` : ""} ${line}`}>
      <canvas ref={canvasRef} aria-hidden />
      <span className="sky-strip-copy">
        <b>{nights ? `Your sky, ${nights} ${nights === 1 ? "night" : "nights"} so far` : "Your sky"}</b>
        <span>{line}</span>
      </span>
    </button>
  );
}

function rng(seed: number) {
  return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
}

// The strip's night: sky, a soft milky band, faint stars, the hills and the water,
// then this month's day stars, one row per language, joined day to day.
function drawStrip(c: HTMLCanvasElement, m: SkyModel) {
  const w = c.clientWidth, h = c.clientHeight, pr = Math.min(devicePixelRatio || 1, 2);
  if (!w || !h) return;
  c.width = Math.round(w * pr); c.height = Math.round(h * pr);
  const x = c.getContext("2d");
  if (!x) return;
  x.setTransform(pr, 0, 0, pr, 0, 0);
  const horizon = h * 0.8;

  const sky = x.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#020a0f"); sky.addColorStop(0.7, "#0d2a30"); sky.addColorStop(1, "#2b3a42");
  x.fillStyle = sky; x.fillRect(0, 0, w, horizon);
  const band = x.createRadialGradient(w * 0.62, h * 0.35, 0, w * 0.62, h * 0.35, w * 0.45);
  band.addColorStop(0, "rgba(95,179,185,.10)"); band.addColorStop(1, "rgba(95,179,185,0)");
  x.fillStyle = band; x.fillRect(0, 0, w, horizon);

  const R = rng(7);
  for (let i = 0; i < Math.round(w / 6); i++) {
    const sx = R() * w, sy = R() * horizon * 0.95, a = 0.15 + R() * 0.45;
    x.fillStyle = `rgba(231,238,236,${a * (sy / horizon < 0.85 ? 1 : 0.4)})`;
    x.fillRect(sx, sy, R() < 0.1 ? 1.6 : 1, R() < 0.1 ? 1.6 : 1);
  }

  // water, then the hills
  const sea = x.createLinearGradient(0, horizon, 0, h);
  sea.addColorStop(0, "#0a1f25"); sea.addColorStop(1, "#03121a");
  x.fillStyle = sea; x.fillRect(0, horizon, w, h - horizon);
  x.fillStyle = "#081a20";
  x.beginPath(); x.moveTo(0, horizon);
  for (let px = 0; px <= w; px += 8) x.lineTo(px, horizon - 4 - 3 * Math.sin(px / 61 + 1.3) - 2 * Math.sin(px / 23));
  x.lineTo(w, horizon); x.closePath(); x.fill();

  // the last two weeks of stars, every language
  const recent = m.days.filter((d) => d.key > m.today - 14);
  // wide strips keep the stars right of the words; narrow ones keep them above
  const narrow = w < 560, from = m.today - 13, left = narrow ? 18 : w * 0.42, right = w - 18;
  const rows = Math.max(1, m.langs.length), top = h * (narrow ? 0.12 : 0.16), span = narrow ? h * 0.36 : horizon - 22 - top;
  const at = (d: (typeof recent)[number]) => {
    const f = (d.key - from) / 13, row = rows === 1 ? 0.45 : d.lang / (rows - 1);
    return { px: left + f * (right - left), py: top + row * span * 0.75 + Math.sin(d.key * 1.7 + d.lang) * span * 0.08 };
  };
  const rgb = (i: number, a: number) => `rgba(${languageColor(i).map((v) => Math.round(v * 255)).join(",")},${a})`;
  x.lineWidth = 1;
  for (let i = 1; i < recent.length; i++) {
    const a = recent[i - 1];
    const b = recent.slice(i).find((d) => d.lang === a.lang);
    if (!b || b.key - a.key > 4) continue;
    const p = at(a), q = at(b);
    x.strokeStyle = rgb(a.lang, b.key - a.key === 1 && !b.pending ? 0.35 : 0.12);
    x.beginPath(); x.moveTo(p.px, p.py); x.lineTo(q.px, q.py); x.stroke();
  }
  for (const d of recent) {
    const { px, py } = at(d), r = d.pending ? 2 : 1.1 + Math.min(d.minutes, 30) / 18;
    const glow = x.createRadialGradient(px, py, 0, px, py, r * 3.4);
    glow.addColorStop(0, rgb(d.lang, d.pending ? 0.5 : 0.75)); glow.addColorStop(1, rgb(d.lang, 0));
    x.fillStyle = glow; x.beginPath(); x.arc(px, py, r * 3.4, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#fff8e8"; x.beginPath(); x.arc(px, py, r * 0.7, 0, Math.PI * 2); x.fill();
    if (d === m.tonight) { x.strokeStyle = rgb(d.lang, 0.45); x.beginPath(); x.arc(px, py, 9, 0, Math.PI * 2); x.stroke(); }
  }
}
