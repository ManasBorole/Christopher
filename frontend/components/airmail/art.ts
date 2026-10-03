// The baked artwork in /public/airmail (see bake.ts). Bump after re-baking:
// the files are cached for a year under this version (also in airmail.css).
export const ART_V = 1;
export const artUrl = (name: string) => new URL(`/airmail/${name}.webp?v=${ART_V}`, location.href).href;

// a picture decoded off the main thread, ready to upload
export function loadImage(src: string) {
  const im = new Image();
  im.src = src;
  return im.decode().then(() => im);
}
