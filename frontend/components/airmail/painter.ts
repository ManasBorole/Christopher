import { paint, type Job } from "./paint";

export type Order = Omit<Job, "layer"> & { layer?: string }; // the layer by URL

/* Paints jobs in order on one worker. A picture comes back flipped for WebGL:
   an ImageBitmap from the worker, or a canvas where the browser cannot draw
   in a worker (painted on the main thread in idle time instead). */
export function createPainter() {
  const waits = new Map<number, [(s: TexImageSource) => void, (e: unknown) => void, Job]>();
  let seq = 0, worker: Worker | null = null;
  const local = (job: Job) =>
    new Promise<void>((r) => (window.requestIdleCallback ?? setTimeout)(() => r())).then(() => paint({ ...job, flip: true }) as Promise<TexImageSource>);
  try {
    if (typeof OffscreenCanvas !== "undefined" && new OffscreenCanvas(1, 1).getContext("2d")) {
      worker = new Worker(new URL("./paint.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<{ id: number; bmp?: ImageBitmap; err?: string }>) => {
        const w = waits.get(e.data.id);
        if (!w) return;
        waits.delete(e.data.id);
        if (e.data.bmp) w[0](e.data.bmp);
        else local(w[2]).then(w[0], w[1]); // the worker could not finish it: try here
      };
    }
  } catch {
    worker = null;
  }
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async paint({ layer, ...rest }: Order): Promise<TexImageSource> {
      // fetch in parallel, but hand jobs over in the order they were asked for (the atlas first)
      const blob = layer
        ? fetch(layer).then((r) => {
            if (!r.ok) throw new Error(`${r.status} ${layer}`);
            return r.blob();
          })
        : undefined;
      const turn = queue.then(() => blob);
      queue = turn.catch(() => {});
      const job: Job = { ...rest, layer: await turn };
      if (!worker) return local(job);
      return new Promise((ok, no) => {
        waits.set(++seq, [ok, no, job]);
        worker!.postMessage({ id: seq, job: { ...job, flip: true } });
      });
    },
    dispose() {
      worker?.terminate();
      waits.clear();
    },
  };
}
