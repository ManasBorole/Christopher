import { paint, type Job } from "./paint";

// Paints the landing's paper off the main thread (see paint.ts), one job at a
// time in the order asked, so the flock's atlas is never held up by later art.
let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent<{ id: number; job: Job }>) => {
  const { id, job } = e.data;
  queue = queue.then(async () => {
    try {
      const bmp = ((await paint(job)) as unknown as OffscreenCanvas).transferToImageBitmap();
      self.postMessage({ id, bmp }, { transfer: [bmp] });
    } catch (err) {
      self.postMessage({ id, err: String(err) });
    }
  });
};
