"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SkyCourse } from "@vta/shared";
import { cachedSky, getSky } from "../../lib/api";
import { languageCss } from "../../lib/languageColor";
import { buildSky, type SkyDay } from "./days";
import { skyFonts } from "./fonts";
import type { SkyReadout, SkyScene } from "./scene";
import "./sky.css";

type SceneModule = typeof import("./scene");

// "Your sky": every day the learner spoke becomes a star over the harbour.
// Paints from this browser's last copy at once, then refreshes underneath.
// three.js and the scene load only here, with import(), so Home stays light.
export default function SkyView({ onBack }: { onBack: () => void }) {
  const [courses, setCourses] = useState<SkyCourse[] | null>(() => cachedSky());
  const [failed, setFailed] = useState(false);
  const model = useMemo(() => buildSky(courses ?? []), [courses]);
  const [focus, setFocus] = useState<number | "all" | null>(null); // null = the language spoken last
  const shownFocus = focus ?? model.focus;
  const [readout, setReadout] = useState<SkyReadout>({ title: "Tonight", sub: "", away: false });
  const [day, setDay] = useState<SkyDay | null>(null);
  const [mod, setMod] = useState<SceneModule | null>(null);
  const [nogl, setNogl] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SkyScene | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    getSky()
      // the same sky as the cached copy: keep it, so nothing redraws
      .then((fresh) => setCourses((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh)))
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    let live = true;
    import("./scene").then((m) => live && setMod(m));
    return () => {
      live = false;
    };
  }, []);

  // one scene for the life of the page; later data and focus go to it
  const focusRef = useRef(shownFocus);
  focusRef.current = shownFocus;
  const modelRef = useRef(model);
  useEffect(() => {
    if (!mod || !rootRef.current) return;
    const s = mod.createSkyScene(rootRef.current, modelRef.current, focusRef.current, skyFonts, { onReadout: setReadout, onOpenDay: setDay });
    sceneRef.current = s;
    setNogl(!s.webgl);
    return () => {
      s.dispose();
      sceneRef.current = null;
    };
  }, [mod]);
  useEffect(() => {
    if (modelRef.current === model) return;
    modelRef.current = model;
    sceneRef.current?.setModel(model);
  }, [model]);
  useEffect(() => sceneRef.current?.setFocus(shownFocus), [shownFocus]);
  useEffect(() => {
    if (day) dateRef.current?.focus({ preventScroll: true });
  }, [day]);

  // the language chips scroll sideways when there are many; fades mark the side with more
  const chipFades = useCallback(() => {
    const b = chipsRef.current;
    if (!b) return;
    const more = b.scrollWidth - b.clientWidth > 2;
    b.classList.toggle("fl", more && b.scrollLeft > 2);
    b.classList.toggle("fr", more && b.scrollLeft < b.scrollWidth - b.clientWidth - 2);
  }, []);
  useEffect(() => {
    const b = chipsRef.current, c = b?.querySelector<HTMLElement>(`[data-l="${shownFocus}"]`);
    if (b && c) {
      const br = b.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (cr.right > br.right - 34) b.scrollLeft += cr.right - br.right + 34;
      else if (cr.left < br.left + 34) b.scrollLeft -= br.left + 34 - cr.left;
    }
    chipFades();
  }, [shownFocus, model.langs.length, chipFades]);
  useEffect(() => {
    addEventListener("resize", chipFades);
    return () => removeEventListener("resize", chipFades);
  }, [chipFades]);

  const loading = courses === null && !failed;
  const empty = courses !== null && model.days.length === 0;
  const many = model.langs.length > 1;
  const plural = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

  return (
    <div ref={rootRef} className={`sky${day ? " sky-open" : ""}`}>
      <div className="sky-vig" aria-hidden />
      <div className="sky-ov" aria-hidden>
        <div className="sky-lbls" />
        <div className="sky-words" />
        <div className="sky-tip">
          <b />
          <span />
        </div>
      </div>

      <div className="sky-ui">
        <div className="sky-btns hit" role="group" aria-label="Your stars, by date" />

        <div className="sky-top">
          <button type="button" className="sky-btn hit" onClick={onBack}>
            Your languages
          </button>
          <div className="sky-ttl">
            <h1>Your sky</h1>
            <p>Every day you speak becomes a star.</p>
          </div>
        </div>

        {!empty && !loading && !failed && (
          <div className="sky-when">
            <b key={`t${readout.title}`}>{readout.title}</b>
            {readout.sub && <span key={`s${readout.sub}`}>{readout.sub}</span>}
            {readout.away && (
              <button type="button" className="sky-chip hit" onClick={() => sceneRef.current?.toTonight()}>
                Back to tonight
              </button>
            )}
          </div>
        )}

        {nogl ? (
          <div className="sky-nogl">
            <p>Your sky needs WebGL to draw. Your stars are safe and will appear on a browser that supports it.</p>
          </div>
        ) : failed && courses === null ? (
          <div className="sky-note" role="alert">
            <p>Your sky did not load.</p>
            <button type="button" className="sky-btn hit" onClick={load}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="sky-note small" role="status">
            Gathering your stars
          </div>
        ) : (
          empty && (
            <div className="sky-note">
              <p>Your first star appears after your first conversation.</p>
            </div>
          )
        )}

        {!loading && !empty && !(failed && courses === null) && (
          <div className="sky-stats" aria-label="Totals">
            <div>
              <b>{model.spoken}</b>
              <span>{model.spoken === 1 ? "star" : "stars"}</span>
            </div>
            <div>
              <b>{model.streak}-day</b>
              <span>streak</span>
            </div>
            <div>
              <b>{model.words}</b>
              <span>{model.words === 1 ? "word" : "words"}</span>
            </div>
          </div>
        )}

        {model.langs.length > 0 && !empty && (
          <div className="sky-ctrl">
            <div ref={chipsRef} className="sky-chips hit" role="group" aria-label="Language in focus" onScroll={chipFades}>
              {many && (
                <button type="button" className="sky-chip" data-l="all" aria-pressed={shownFocus === "all"} onClick={() => setFocus("all")}>
                  All
                </button>
              )}
              {model.langs.map((l, i) => (
                <button key={l.name} type="button" className="sky-chip" data-l={i} lang={l.code} aria-pressed={shownFocus === i} onClick={() => setFocus(i)}>
                  <span className="sky-dot" style={{ background: languageCss(i) }} aria-hidden />
                  {l.native}
                </button>
              ))}
            </div>
          </div>
        )}

        {day && <DayCard day={day} lang={model.langs[day.lang]} color={languageCss(day.lang)} dateRef={dateRef} onClose={() => sceneRef.current?.closeDay()} plural={plural} />}
      </div>
    </div>
  );
}

function DayCard({
  day,
  lang,
  color,
  dateRef,
  onClose,
  plural,
}: {
  day: SkyDay;
  lang: { native: string; code: string };
  color: string;
  dateRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  plural: (n: number, one: string, more: string) => string;
}) {
  const date = day.date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", ...(day.date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
  return (
    <aside className="sky-panel hit" aria-labelledby="sky-date">
      <button type="button" className="sky-btn" onClick={onClose}>
        Back to your sky
      </button>
      <h2 id="sky-date" ref={dateRef} tabIndex={-1}>
        {date}
      </h2>
      <p className="sky-meta">
        <span className="sky-dot" style={{ background: color }} aria-hidden />
        {day.pending ? `${lang.native}, not spoken yet` : `${lang.native}, ${plural(day.chats.length, "conversation", "conversations")}, ${plural(day.minutes, "minute", "minutes")}`}
      </p>
      {day.pending ? (
        <p className="sky-wait">Tonight&apos;s star is waiting. Talk with Christopher and it lights up.</p>
      ) : (
        <>
          <h3>Conversations</h3>
          <ul className="sky-chats">
            {day.chats.map((c) => (
              <li key={c.at.getTime()}>
                <span>{c.at.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}</span>
                <span>{plural(c.minutes, "minute", "minutes")}</span>
              </li>
            ))}
          </ul>
          {day.words.length > 0 && (
            <>
              <h3>Words from this day</h3>
              <p className="sky-words-l" lang={lang.code}>
                {day.words.join(", ")}
              </p>
            </>
          )}
        </>
      )}
    </aside>
  );
}
