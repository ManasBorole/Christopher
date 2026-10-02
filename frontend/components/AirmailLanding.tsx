"use client";

import { useEffect, useRef, useState } from "react";
import type { AirmailScene } from "./airmail/scene";
import "./airmail/airmail.css";

// English names as the app stores them, with each language's own name first.
const OPTIONS: [string, string][] = [
  ["Japanese", "日本語"],
  ["Spanish", "Español"],
  ["French", "Français"],
  ["Korean", "한국어"],
  ["Hindi", "हिन्दी"],
  ["Arabic", "العربية"],
  ["German", "Deutsch"],
  ["Portuguese", "Português"],
  ["Chinese", "中文"],
  ["Italian", "Italiano"],
  ["Turkish", "Türkçe"],
  ["Greek", "Ελληνικά"],
  ["Marathi", "मराठी"],
  ["Russian", "Русский"],
];

/* The way in: a scroll through Christopher's harbour, where every language's
   postcard is in the air. The copy, CTA and picker are plain markup; the WebGL
   scene loads after hydration and drives the choreography around them.
   onStart(language) hands off to the parent, which opens the guest / sign-in
   sheet and then drops the learner straight into a conversation. */
export default function AirmailLanding({
  onStart,
  onSignIn,
}: {
  onStart: (language: string) => void;
  onSignIn: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState("Japanese");

  useEffect(() => {
    let gone = false;
    let scene: AirmailScene | null = null;
    import("./airmail/scene").then(({ createAirmailScene }) => {
      if (gone || !rootRef.current) return;
      scene = createAirmailScene(rootRef.current);
    });
    return () => {
      gone = true;
      scene?.dispose();
    };
  }, []);

  const start = () => onStart(lang);

  return (
    <div className="am" ref={rootRef}>
      <div id="grab" aria-hidden="true" />

      <header className="top">
        <a className="mark" href="#" aria-label="Christopher home">
          <span className="av" aria-hidden="true">
            <span />
          </span>
          Christopher
        </a>
        <button type="button" className="signin shade" onClick={onSignIn}>
          Sign in
        </button>
      </header>

      <div className="stage" id="stage">
        <section className="beat hero" data-r="-1,-1,.05,.115" aria-label="Introduction">
          <h1 className="shade">
            <span className="ln">
              <span>Say it out loud.</span>
            </span>
            <span className="ln">
              <span>Christopher will</span>
            </span>
            <span className="ln">
              <span>wait for you.</span>
            </span>
          </h1>
          <p className="lede shade">
            <span className="ln">
              <span>
                A tutor you talk to in your new language. He listens to the whole sentence, answers like a person, and
                quietly says it back the right way when you slip.
              </span>
            </span>
          </p>
          <div className="ln">
            <span>
              <div className="row hit">
                <button className="cta" type="button" onClick={start}>
                  Start talking in {lang}
                </button>
                <label className="sel">
                  <span className="sr">Language</span>
                  <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}>
                    {OPTIONS.map(([en, own]) => (
                      <option key={en} value={en}>
                        {own} {en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="note shade">No account needed for your first conversation.</p>
            </span>
          </div>
        </section>

        <section className="beat slip" data-r=".225,.27,.338,.365" aria-label="The slip">
          <h2 className="shade">
            <span className="ln">
              <span>You slip.</span>
            </span>
            <span className="ln">
              <span>He says it back.</span>
            </span>
          </h2>
          <p className="lede shade">
            <span className="ln">
              <span>
                No red marks, no score. Christopher answers like a friend would, and puts{" "}
                <span className="jp" lang="ja">
                  たべました
                </span>{" "}
                in his reply so the right form sticks.
              </span>
            </span>
          </p>
        </section>

        <section className="beat scale" data-r=".395,.445,.525,.56" aria-label="Languages">
          <div className="big shade">
            <span className="ln">
              <span>183</span>
            </span>
          </div>
          <h2 className="shade">
            <span className="ln">
              <span>languages, each in</span>
            </span>
            <span className="ln">
              <span>its own script.</span>
            </span>
          </h2>
          <p className="scripts shade">
            <span className="ln">
              <span>
                Every card here is a different language, written in its own script. Arabic and Hebrew even read right to
                left, as they should.
              </span>
            </span>
          </p>
        </section>

        <section className="beat meet" data-r=".575,.615,.728,.752" aria-label="Meet Christopher">
          <h2 className="shade">
            <span className="ln">
              <span>Meet Christopher.</span>
            </span>
          </h2>
          <p className="lede shade">
            <span className="ln">
              <span>His body language is the conversation, so you always know whose turn it is.</span>
            </span>
          </p>
          <ul className="states shade" id="states">
            <li>
              <b>Listening</b>
              <span>He waits for the whole sentence.</span>
            </li>
            <li>
              <b>Thinking</b>
              <span>A pause to find the kindest way to say it.</span>
            </li>
            <li>
              <b>Speaking</b>
              <span>He answers like a person would.</span>
            </li>
            <li>
              <b>You cut in</b>
              <span>Start talking and he stops, mid-word.</span>
            </li>
          </ul>
          <div className="hit">
            <button className="hear" type="button" id="hear" aria-pressed="false">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M7 5.5v13l11-6.5z" />
              </svg>
              <span>Hear it in Japanese</span>
            </button>
            <p className="sub shade" id="sub" aria-live="polite" />
          </div>
        </section>

        <section className="beat post" data-r=".778,.81,.862,.885" aria-label="The postcard">
          <h2 className="shade">
            <span className="ln">
              <span>When you finish talking,</span>
            </span>
            <span className="ln">
              <span>Christopher sends</span>
            </span>
            <span className="ln">
              <span>you a postcard.</span>
            </span>
          </h2>
          <p className="lede shade">
            <span className="ln">
              <span>
                The words you used, one thing worth another try, and a topic for next time. Then it flies off, and you
                get on with your day.
              </span>
            </span>
          </p>
        </section>
      </div>

      <div id="ctaB" className="hit">
        <h2 className="sr">Christopher. Say it out loud.</h2>
        <button className="cta" type="button" onClick={start}>
          Start talking in {lang}
        </button>
      </div>
      <div id="track" aria-hidden="true" />
    </div>
  );
}
