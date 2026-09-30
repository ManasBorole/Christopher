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
      className="sheet-backdrop"
    >
      <div ref={panelRef} className="sheet">
        <h2 id="del-title" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Remove {language}?
        </h2>
        <p id="del-msg" className="mt-2 text-[15px] text-muted">
          This deletes your {language} words and conversation history. If you come back to {language} later,
          Christopher starts from the beginning.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="btn w-full">
            Keep {language}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="btn-quiet w-full text-alert-ink shadow-[inset_0_0_0_1.5px_var(--alert-ink)]"
          >
            {busy ? "Removing…" : `Remove ${language} and its progress`}
          </button>
        </div>
      </div>
    </div>
  );
}
