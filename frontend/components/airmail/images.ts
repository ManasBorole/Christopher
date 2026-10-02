// Mascot images: load early, retry once, and let any texture baked without its
// image redraw itself when the image arrives.

export const IMG_NAMES = ["wave", "listen", "think", "speak-open", "speak-half", "speak-closed", "goahead", "postcard", "idle"] as const;
export type ImgName = (typeof IMG_NAMES)[number];

export function loadImages(onEach: (done: number, total: number) => void) {
  const imgs: Partial<Record<ImgName, HTMLImageElement>> = {};
  const hooks: Partial<Record<ImgName, (() => void)[]>> = {};
  const timers: number[] = [];
  let live = true;

  const load = (src: string, tries = 2): Promise<HTMLImageElement | null> =>
    new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => {
        if (tries > 1 && live) timers.push(window.setTimeout(() => load(src + (src.includes("?") ? "" : "?r=1"), tries - 1).then(res), 1200));
        else res(null);
      };
      im.src = src;
    });

  let done = 0;
  const jobs = IMG_NAMES.map((n) =>
    load(`/mascot/${n}.webp`).then((im) => {
      if (!live) return;
      done++;
      onEach(done, IMG_NAMES.length);
      if (!im) return;
      imgs[n] = im;
      const hs = hooks[n];
      delete hooks[n];
      hs?.forEach((fn) => fn());
    })
  );

  // redraw once each missing image arrives
  function whenImg(names: ImgName[], redraw: () => void) {
    for (const n of names) if (!imgs[n]) (hooks[n] ??= []).push(redraw);
  }

  return {
    imgs,
    jobs,
    whenImg,
    dispose() {
      live = false;
      timers.forEach(clearTimeout);
      for (const k of Object.keys(hooks) as ImgName[]) delete hooks[k];
    },
  };
}
