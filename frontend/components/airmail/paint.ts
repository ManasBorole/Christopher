import { drawAtlas } from "./cards";
import { PAPER, cv, paperFill } from "./paper";

/* Finishing a baked picture: its paper grain is noise that would not compress,
   so it is drawn here from the original seeds (with the atlas's stripes and
   stamps), and the baked layer of what sits on the paper goes on top. Runs in
   the paint worker; the main thread only uses it where workers cannot draw. */

export type Job = {
  w: number;
  h: number;
  paper?: [tone: string, amt: number, cell: number, seed: number];
  atlas?: boolean; // the flock's card atlas; true for the phone-sized one
  layer?: Blob; // the baked layer (fetched by the page, so its preload is used)
  flip?: boolean; // upside down, ready for WebGL (bitmaps ignore UNPACK_FLIP_Y)
};

export async function paint(j: Job) {
  let c: HTMLCanvasElement;
  if (j.atlas !== undefined) {
    PAPER.text = false;
    try {
      c = drawAtlas(j.atlas);
    } finally {
      PAPER.text = true;
    }
  } else {
    c = cv(j.w, j.h);
    if (j.paper) paperFill(c.getContext("2d")!, 0, 0, j.w, j.h, ...j.paper);
  }
  if (j.layer) c.getContext("2d")!.drawImage(await createImageBitmap(j.layer), 0, 0, c.width, c.height);
  if (!j.flip) return c;
  const f = cv(c.width, c.height), x = f.getContext("2d")!;
  x.setTransform(1, 0, 0, -1, 0, c.height);
  x.drawImage(c, 0, 0);
  return f;
}
