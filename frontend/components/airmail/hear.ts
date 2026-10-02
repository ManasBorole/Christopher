// "Hear it": a one-time recorded demo per language (no cost per play). The
// learner slips on the past tense and Christopher says it back the right way.
// Clips live at /hear/<code>/{t1,l1,t2,l2,t3}.mp3, keyed by the app's English names.

type Script = { code: string; fix: string; rtl?: boolean; lines: [string, string, string, string, string] };

export const HEAR: Record<string, Script> = {
  Japanese: {
    code: "ja",
    fix: "たべました",
    lines: [
      "こんにちは！お名前は？",
      "わたしは、サムです。きのう、すしを、たべます。",
      "いいですね！きのう、すしを、たべました。なんのすしが好きですか？",
      "サーモン、大好きです！",
      "わたしも！",
    ],
  },
  Spanish: {
    code: "es",
    fix: "comiste",
    lines: [
      "¡Hola! ¿Cómo te llamas?",
      "Me llamo Sam. Ayer… como sushi.",
      "¡Qué bien! Ayer comiste sushi. ¿Qué sushi te gusta?",
      "¡El salmón, me encanta!",
      "¡A mí también!",
    ],
  },
  French: {
    code: "fr",
    fix: "as mangé",
    lines: [
      "Bonjour ! Comment tu t'appelles ?",
      "Je m'appelle Sam. Hier… je mange des sushis.",
      "Super ! Hier, tu as mangé des sushis. Quels sushis tu aimes ?",
      "Le saumon, j'adore !",
      "Moi aussi !",
    ],
  },
  Korean: {
    code: "ko",
    fix: "먹었어요",
    lines: [
      "안녕하세요! 이름이 뭐예요?",
      "저는 샘이에요. 어제… 초밥을 먹어요.",
      "좋네요! 어제 초밥을 먹었어요. 무슨 초밥을 좋아해요?",
      "연어, 정말 좋아해요!",
      "저도요!",
    ],
  },
  Hindi: {
    code: "hi",
    fix: "खाई",
    lines: [
      "नमस्ते! आपका नाम क्या है?",
      "मेरा नाम सैम है। कल… मैं सुशी खाता हूँ।",
      "बढ़िया! कल आपने सुशी खाई। आपको कौन-सी सुशी पसंद है?",
      "सैल्मन, मुझे बहुत पसंद है!",
      "मुझे भी!",
    ],
  },
  Arabic: {
    code: "ar",
    fix: "أكلتَ", rtl: true,
    lines: [
      "مرحبًا! ما اسمك؟",
      "اسمي سام. أمس… آكلُ السوشي.",
      "جميل! أمس أكلتَ السوشي. أيَّ سوشي تحب؟",
      "السلمون، أحبه كثيرًا!",
      "وأنا أيضًا!",
    ],
  },
  German: {
    code: "de",
    fix: "gegessen",
    lines: [
      "Hallo! Wie heißt du?",
      "Ich heiße Sam. Gestern… esse ich Sushi.",
      "Schön! Gestern hast du Sushi gegessen. Welches Sushi magst du?",
      "Lachs, den liebe ich!",
      "Ich auch!",
    ],
  },
  Portuguese: {
    code: "pt",
    fix: "comeu",
    lines: [
      "Olá! Como você se chama?",
      "Eu me chamo Sam. Ontem… eu como sushi.",
      "Que legal! Ontem você comeu sushi. De qual sushi você gosta?",
      "Salmão, eu adoro!",
      "Eu também!",
    ],
  },
  Chinese: {
    code: "zh",
    fix: "吃了",
    lines: [
      "你好！你叫什么名字？",
      "我叫Sam。昨天……我吃寿司。",
      "真好！昨天你吃了寿司。你喜欢什么寿司？",
      "三文鱼，我很喜欢！",
      "我也是！",
    ],
  },
  Italian: {
    code: "it",
    fix: "hai mangiato",
    lines: [
      "Ciao! Come ti chiami?",
      "Mi chiamo Sam. Ieri… mangio il sushi.",
      "Che bello! Ieri hai mangiato il sushi. Che sushi ti piace?",
      "Il salmone, lo adoro!",
      "Anche a me!",
    ],
  },
  Turkish: {
    code: "tr",
    fix: "yedin",
    lines: [
      "Merhaba! Adın ne?",
      "Benim adım Sam. Dün… suşi yiyorum.",
      "Ne güzel! Dün suşi yedin. Hangi suşiyi seviyorsun?",
      "Somonu çok seviyorum!",
      "Ben de!",
    ],
  },
  Greek: {
    code: "el",
    fix: "έφαγες",
    lines: [
      "Γεια σου! Πώς σε λένε;",
      "Με λένε Σαμ. Χθες… τρώω σούσι.",
      "Ωραία! Χθες έφαγες σούσι. Ποιο σούσι σου αρέσει;",
      "Τον σολομό, τον λατρεύω!",
      "Κι εμένα!",
    ],
  },
  Marathi: {
    code: "mr",
    fix: "खाल्ली",
    lines: [
      "नमस्कार! तुमचं नाव काय आहे?",
      "माझं नाव सॅम आहे. काल… मी सुशी खातो.",
      "छान! काल तुम्ही सुशी खाल्ली. तुम्हाला कोणती सुशी आवडते?",
      "सॅल्मन, मला खूप आवडते!",
      "मलाही!",
    ],
  },
  Russian: {
    code: "ru",
    fix: "ел",
    lines: [
      "Привет! Как тебя зовут?",
      "Меня зовут Сэм. Вчера… я ем суши.",
      "Здорово! Вчера ты ел суши. Какие суши ты любишь?",
      "Лосось, обожаю!",
      "Я тоже!",
    ],
  },
};

const WHO = ["t", "l", "t", "l", "t"] as const, IDS = ["t1", "l1", "t2", "l2", "t3"];
const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Plays the five turns with subtitles. onState: 0 listening, 1 thinking, 2 speaking, -1 back to the scroll.
export function createHear(
  btn: HTMLButtonElement,
  sub: HTMLElement,
  opts: { lang: () => string; onState: (s: number) => void; onSpeak: (on: boolean) => void }
) {
  const label = btn.querySelector("span")!;
  const lang = () => (HEAR[opts.lang()] ? opts.lang() : "Japanese");
  let playing: { cancel: boolean; audio?: HTMLAudioElement } | null = null;

  function stop() {
    if (playing) {
      playing.cancel = true;
      playing.audio?.pause();
    }
    playing = null;
    opts.onState(-1);
    opts.onSpeak(false);
    btn.setAttribute("aria-pressed", "false");
    label.textContent = "Hear it in " + lang();
    sub.textContent = "";
  }

  async function play() {
    const run: { cancel: boolean; audio?: HTMLAudioElement } = (playing = { cancel: false });
    btn.setAttribute("aria-pressed", "true");
    label.textContent = "Stop";
    const H = HEAR[lang()];
    for (let ci = 0; ci < 5; ci++) {
      const who = WHO[ci], text = H.lines[ci];
      if (run.cancel) return;
      if (who === "t") {
        opts.onState(1);
        sub.innerHTML = '<span class="who t">Christopher is thinking</span>&nbsp;';
        await wait(650);
        if (run.cancel) return;
      }
      opts.onState(who === "t" ? 2 : 0);
      const body = ci === 2 ? esc(text).replace(esc(H.fix), `<span class="fix">${esc(H.fix)}</span>`) : esc(text);
      sub.innerHTML = `<span class="who ${who}">${who === "t" ? "Christopher" : "You"}</span><span lang="${H.code}"${H.rtl ? ' dir="rtl"' : ""}${
        H.code === "ja" ? ' class="jp"' : ""
      }>${body}</span>`;
      const au = (run.audio = new Audio(`/hear/${H.code}/${IDS[ci]}.mp3`));
      if (who === "t") opts.onSpeak(true);
      await new Promise((r) => {
        au.onended = r;
        au.onerror = r;
        au.play().catch(r);
      });
      opts.onSpeak(false);
      await wait(300);
    }
    if (!run.cancel) stop();
  }

  const click = (e: MouseEvent) => {
    e.preventDefault();
    if (playing) stop();
    else play();
  };
  btn.addEventListener("click", click);

  return {
    stop,
    dispose() {
      btn.removeEventListener("click", click);
      if (playing) {
        playing.cancel = true;
        playing.audio?.pause();
        playing = null;
      }
    },
  };
}
