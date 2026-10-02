import { C, FONT, paperFill } from "./paper";

/* The landing's cold open: a postcard drops in, its airmail border draws as
   real loading progress, then it flies off into the scene and the hero copy
   gathers in. */
export function createPreloader(pre: HTMLElement, RM: boolean) {
  const card = pre.querySelector<HTMLElement>(".pc")!, stroke = pre.querySelector<SVGElement>("#pcs")!, canvas = pre.querySelector<HTMLCanvasElement>("#pcv")!;
  const T0 = performance.now(), timers: number[] = [];
  let v = 0, done = false, reveal = RM ? 1 : 0, raf = 0, anim: Animation | null = null;

  const set = (x: number) => {
    v = Math.max(v, Math.min(1, x));
    stroke.style.strokeDashoffset = (1 - v).toFixed(3);
  };
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  function finish() {
    if (done) return;
    done = true;
    set(1);
    if (RM) {
      pre.classList.add("done", "gone");
      later(() => pre.remove(), 650);
      reveal = 1;
      return;
    }
    const wait = Math.max(0, 560 - (performance.now() - T0)) + 260; // let the drop land and the stripe close
    later(() => {
      pre.classList.add("done");
      const tx = innerWidth * 0.26, ty = -innerHeight * 0.3;
      anim = card.animate(
        [
          { transform: "none", opacity: 1 },
          { transform: `translate(${tx}px,${ty}px) rotate(14deg) rotateX(48deg) scale(.22)`, opacity: 0 },
        ],
        { duration: 620, easing: "cubic-bezier(.5,0,.75,.4)", fill: "forwards" }
      );
      const s0 = performance.now();
      const rv = () => {
        reveal = Math.min(1, (performance.now() - s0 - 180) / 900);
        if (reveal < 1) raf = requestAnimationFrame(rv);
        else reveal = 1;
      };
      rv();
      anim.onfinish = () => {
        pre.classList.add("gone");
        later(() => pre.remove(), 650);
      };
    }, wait);
  }
  later(finish, 9000); // never hold the page hostage

  function draw(wave: HTMLImageElement | undefined) {
    const x = canvas.getContext("2d")!, W = canvas.width, H = canvas.height;
    paperFill(x, 0, 0, W, H, "#f0e4cc", 1, 1.5, 55);
    x.fillStyle = C.teal;
    x.font = `${H * 0.1}px ${FONT.hand}`;
    x.textAlign = "left";
    x.fillText("Greetings from", W * 0.08, H * 0.36);
    x.fillStyle = C.ink;
    x.font = `700 ${H * 0.13}px ${FONT.display}`;
    x.fillText("Christopher", W * 0.08, H * 0.54);
    x.fillStyle = C.pen;
    x.font = `${H * 0.065}px ${FONT.hand}`;
    x.fillText("say it out loud.", W * 0.08, H * 0.74);
    x.save();
    x.translate(W * 0.78, H * 0.48);
    x.rotate(0.06);
    const pw = W * 0.24, ph = pw * 1.2, b = pw * 0.06;
    x.shadowColor = "rgba(60,40,20,.25)";
    x.shadowBlur = 14;
    x.shadowOffsetY = 5;
    x.fillStyle = "#faf6ec";
    x.fillRect(-pw / 2 - b, -ph / 2 - b, pw + 2 * b, ph + 2 * b);
    x.shadowColor = "transparent";
    if (wave) x.drawImage(wave, -pw / 2, -ph / 2, pw, ph);
    else {
      x.fillStyle = "#c6a590";
      x.fillRect(-pw / 2, -ph / 2, pw, ph);
    }
    x.restore();
  }

  return {
    set,
    get v() {
      return v;
    },
    finish,
    reveal: () => reveal,
    draw,
    dispose() {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      anim?.cancel();
      pre.remove();
    },
  };
}
