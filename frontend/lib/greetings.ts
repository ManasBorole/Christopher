// An everyday "hello" for common languages, keyed by ISO 639-1 code. Shown on
// course tags and in Christopher's welcome. Languages missing here simply show
// no greeting; add them as learners ask.
const HELLO: Record<string, string> = {
  af: "Hallo", am: "ሰላም", ar: "مرحبا", bg: "Здравей", bn: "নমস্কার", ca: "Hola", cs: "Ahoj", cy: "Helo",
  da: "Hej", de: "Hallo", el: "Γειά σου", en: "Hello", es: "Hola", et: "Tere", eu: "Kaixo", fa: "سلام",
  fi: "Hei", fr: "Bonjour", ga: "Dia duit", gu: "નમસ્તે", he: "שלום", hi: "नमस्ते", hr: "Bok", hu: "Szia",
  id: "Halo", is: "Halló", it: "Ciao", ja: "こんにちは", kn: "ನಮಸ್ಕಾರ", ko: "안녕하세요", lt: "Labas", lv: "Sveiki",
  ml: "നമസ്കാരം", mr: "नमस्कार", ms: "Helo", nb: "Hei", ne: "नमस्ते", nl: "Hallo", no: "Hei", pa: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
  pl: "Cześć", pt: "Olá", ro: "Salut", ru: "Привет", sk: "Ahoj", sl: "Živijo", sr: "Здраво", sv: "Hej",
  sw: "Habari", ta: "வணக்கம்", te: "నమస్కారం", th: "สวัสดี", tl: "Kumusta", tr: "Merhaba", uk: "Привіт",
  ur: "السلام علیکم", vi: "Xin chào", zh: "你好", zu: "Sawubona",
};

export function greeting(code: string | undefined): string | undefined {
  return code ? HELLO[code] : undefined;
}
