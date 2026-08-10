"use client";

import { useEffect, useRef } from "react";

// Confirmation dialog for permanently deleting a language and all its progress.
// Guest flow: no password, just an explicit acknowledgement.
export default function DeleteLanguageModal({
  language,
  busy,
  onConfirm,
  onCancel,
}: {
  language: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus Cancel on open, restore focus to the opener on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  // ESC to cancel + a simple Tab focus trap within the panel.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-title"
      aria-describedby="del-msg"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(2,3,8,.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", animation: "fadeIn .4s both" }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-[28px] p-8 animate-scalein"
        style={{
          // Solid, opaque surface (not the translucent .glass) so the confirmation
          // reads clearly instead of blending into the background. Sits distinctly
          // lighter than the darkened scrim, with a brighter border for separation.
          background: "linear-gradient(180deg,#141826,#0d101b)",
          border: "1px solid rgba(255,255,255,.16)",
          boxShadow: "0 40px 120px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: "linear-gradient(140deg,#f87171,#c084fc)" }}>
            ⚠️
          </div>
          <h2 id="del-title" className="font-display text-2xl font-semibold tracking-tight">
            Delete Language?
          </h2>
          <p id="del-msg" className="mt-2 text-sm text-[var(--muted)]">
            Deleting this language will permanently remove all of your learning progress for
            this language. If you decide to learn it again in the future, you will need to start
            from the beginning.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={onConfirm} disabled={busy} className="btn-primary w-full disabled:opacity-50" style={{ background: "linear-gradient(100deg,#f87171,#fb7185)", color: "#1a0606" }}>
            {busy ? "Deleting…" : "I'm OK losing my progress"}
          </button>
          <button ref={cancelRef} onClick={onCancel} disabled={busy} className="btn-ghost w-full">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
