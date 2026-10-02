import { clamp } from "./math";

/* The landing's cold open: a postcard drops in, its airmail border draws, then
   it flies off and the harbour shows through. It is pure CSS on a fixed
   timeline (airmail.css), so it plays from the server's HTML and never waits
   for scripts, fonts or WebGL. This reads that timeline so the hero copy can
   gather in as dust just as the card leaves, if the dust is ready by then;
   otherwise the copy is simply there. */
const FLY = 820; // ms into the card's animations; matches am-pcfly's delay

export function createPreloader(pre: HTMLElement, heroReady: () => boolean) {
  const card = pre.querySelector<HTMLElement>(".pc")!;
  const fly = card.getAnimations().find((a) => (a as CSSAnimation).animationName === "am-pcfly");
  // null while the animation waits for its first frame
  let flyAt: number | null = fly ? null : -1, gather: boolean | null = fly ? null : false, timer = 0, gone = false;
  fly?.ready.then(
    (a) => {
      if (gone) return;
      flyAt = typeof a.startTime === "number" ? a.startTime + FLY : -1;
      // gone once the card has flown and the backdrop faded
      timer = window.setTimeout(() => pre.remove(), Math.max(0, flyAt + 1400 - performance.now()));
    },
    () => {}
  );

  return {
    // 0..1: how far the hero copy has gathered in
    reveal(now = performance.now()) {
      if (gather === null) {
        if (flyAt === null || now < flyAt) return 0;
        gather = flyAt > 0 && now < flyAt + 180 && heroReady(); // too late to hide copy that is already showing
      }
      return gather && flyAt ? clamp((now - flyAt - 180) / 900) : 1;
    },
    dispose() {
      gone = true;
      clearTimeout(timer);
      pre.remove();
    },
  };
}
