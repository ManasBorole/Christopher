// Christopher's name with a small portrait of him, like a stamp on an envelope.
export default function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="block shrink-0 overflow-hidden rounded-full bg-[var(--mascot-bg)] shadow-[0_0_0_2.5px_var(--card),0_4px_10px_-4px_rgb(var(--shadow)/0.5)]"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascot/idle.webp" alt="" className="h-full w-full scale-[2.1] object-cover object-[50%_14%]" />
      </span>
      <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-ink">Christopher</span>
    </span>
  );
}
