"use client";

// Branded welcome splash. Purely visual; the parent controls how long it shows.
export default function Splash() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center animate-fadein">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <span className="pulsering absolute inset-0 rounded-full bg-emerald-400/30" aria-hidden />
          <div
            className="floaty grid h-24 w-24 place-items-center rounded-[28px] text-3xl font-bold"
            style={{
              background: "linear-gradient(140deg, var(--c1), var(--c2), var(--c3))",
              boxShadow: "0 20px 60px -15px rgba(52,211,153,.6)",
              color: "#04120c",
            }}
          >
            L
          </div>
        </div>
        <div className="text-center animate-fadeup" style={{ animationDelay: "0.15s" }}>
          <h1 className="font-display text-3xl font-semibold tracking-tight gradient-text">Christopher</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Speak. Learn. Fluently.</p>
        </div>
        <div className="mt-2 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, var(--c1), var(--c2))",
              animation: "loadbar 1.7s cubic-bezier(.4,0,.2,1) forwards",
            }}
          />
        </div>
      </div>
      <style>{`@keyframes loadbar{from{width:0}to{width:100%}}`}</style>
    </div>
  );
}
