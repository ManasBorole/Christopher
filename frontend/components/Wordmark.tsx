// Christopher's name with a small portrait of him, like a stamp on an envelope.
export default function Wordmark({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden
        className="relative block shrink-0 overflow-hidden rounded-full bg-[var(--mascot-bg)] shadow-[0_0_0_2.5px_var(--card),0_4px_10px_-4px_rgb(var(--shadow)/0.5)]"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* image at 2x the circle, offset so his face centre (52%, 27% of the art) sits in the middle */}
        <img src="/mascot/idle.webp" alt="" className="absolute left-[-54%] top-[-14.8%] w-[200%] max-w-none" />
      </span>
      <span className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">Christopher</span>
    </span>
  );
}
