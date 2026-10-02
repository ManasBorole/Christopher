import { rng } from "./math";
import { C, FONT, PAPER, cv, fitFont, miniPostmark, nativeStack, paperFill, stamp, stripeBorder, type Ctx2D } from "./paper";

// The 183 languages on the flock's cards, each written in its own script.
// "r" marks right-to-left scripts.
export type Lang = { n: string; e: string; rtl: boolean };

export const LANGS: Lang[] = `日本語|Japanese
Español|Spanish
हिन्दी|Hindi
العربية|Arabic|r
한국어|Korean
Français|French
Русский|Russian
Ελληνικά|Greek
ไทย|Thai
Kiswahili|Swahili
मराठी|Marathi
עברית|Hebrew|r
Tiếng Việt|Vietnamese
Türkçe|Turkish
தமிழ்|Tamil
বাংলা|Bengali
Polski|Polish
Deutsch|German
Italiano|Italian
Português|Portuguese
中文|Chinese
فارسی|Persian|r
Cymraeg|Welsh
Gaeilge|Irish
Íslenska|Icelandic
Català|Catalan
Euskara|Basque
Tagalog|Tagalog
Українська|Ukrainian
isiZulu|Zulu
Nederlands|Dutch
Svenska|Swedish
Norsk|Norwegian
Dansk|Danish
Suomi|Finnish
Eesti|Estonian
Latviešu|Latvian
Lietuvių|Lithuanian
Čeština|Czech
Slovenčina|Slovak
Slovenščina|Slovenian
Hrvatski|Croatian
Српски|Serbian
Bosanski|Bosnian
Македонски|Macedonian
Български|Bulgarian
Română|Romanian
Magyar|Hungarian
Shqip|Albanian
Беларуская|Belarusian
Қазақша|Kazakh
Oʻzbekcha|Uzbek
Кыргызча|Kyrgyz
Тоҷикӣ|Tajik
Türkmençe|Turkmen
Azərbaycanca|Azerbaijani
ქართული|Georgian
Հայերեն|Armenian
Монгол|Mongolian
اردو|Urdu|r
پښتو|Pashto|r
سنڌي|Sindhi|r
ئۇيغۇرچە|Uyghur|r
کوردی|Sorani Kurdish|r
Kurdî|Kurmanji Kurdish
ייִדיש|Yiddish|r
ދިވެހި|Dhivehi|r
ગુજરાતી|Gujarati
ਪੰਜਾਬੀ|Punjabi
ಕನ್ನಡ|Kannada
తెలుగు|Telugu
മലയാളം|Malayalam
ଓଡ଼ିଆ|Odia
অসমীয়া|Assamese
नेपाली|Nepali
සිංහල|Sinhala
संस्कृतम्|Sanskrit
कोंकणी|Konkani
मैथिली|Maithili
भोजपुरी|Bhojpuri
डोगरी|Dogri
ᱥᱟᱱᱛᱟᱲᱤ|Santali
ತುಳು|Tulu
བོད་ཡིག|Tibetan
རྫོང་ཁ|Dzongkha
ພາສາລາວ|Lao
ខ្មែរ|Khmer
မြန်မာ|Burmese
Bahasa Indonesia|Indonesian
Bahasa Melayu|Malay
Basa Jawa|Javanese
Basa Sunda|Sundanese
Basa Bali|Balinese
Cebuano|Cebuano
Ilokano|Ilocano
Hiligaynon|Hiligaynon
Tetun|Tetum
Hmoob|Hmong
Māori|Māori
Gagana Samoa|Samoan
Lea Faka-Tonga|Tongan
Vosa Vakaviti|Fijian
ʻŌlelo Hawaiʻi|Hawaiian
Reo Tahiti|Tahitian
Tok Pisin|Tok Pisin
Bislama|Bislama
Chamoru|Chamorro
Malagasy|Malagasy
Afrikaans|Afrikaans
isiXhosa|Xhosa
Sesotho|Sesotho
Setswana|Tswana
chiShona|Shona
Yorùbá|Yoruba
Igbo|Igbo
Hausa|Hausa
አማርኛ|Amharic
ትግርኛ|Tigrinya
Afaan Oromoo|Oromo
Soomaali|Somali
Kinyarwanda|Kinyarwanda
Ikirundi|Kirundi
Luganda|Luganda
Chichewa|Chichewa
Wolof|Wolof
Lingála|Lingala
Kikongo|Kikongo
Twi|Twi
Eʋegbe|Ewe
Fulfulde|Fula
Bamanankan|Bambara
Sängö|Sango
Tshivenḓa|Venda
Xitsonga|Tsonga
siSwati|Swati
isiNdebele|Ndebele
Sepedi|Sepedi
ⵜⴰⵎⴰⵣⵉⵖⵜ|Tamazight
Taqbaylit|Kabyle
Gĩkũyũ|Kikuyu
Dholuo|Luo
ichiBemba|Bemba
chiTumbuka|Tumbuka
Fɔngbe|Fon
Malti|Maltese
Lëtzebuergesch|Luxembourgish
Frysk|Frisian
Føroyskt|Faroese
Gàidhlig|Scottish Gaelic
Brezhoneg|Breton
Kernewek|Cornish
Galego|Galician
Asturianu|Asturian
Occitan|Occitan
Corsu|Corsican
Sardu|Sardinian
Furlan|Friulian
Rumantsch|Romansh
Napulitano|Neapolitan
Sicilianu|Sicilian
Esperanto|Esperanto
Latina|Latin
Kalaallisut|Greenlandic
Davvisámegiella|Northern Sami
Татарча|Tatar
Башҡортса|Bashkir
Чӑвашла|Chuvash
Саха тыла|Yakut
Ирон|Ossetian
Нохчийн|Chechen
ᏣᎳᎩ|Cherokee
ᐃᓄᒃᑎᑐᑦ|Inuktitut
Diné bizaad|Navajo
Runa Simi|Quechua
Aymar aru|Aymara
Avañeʼẽ|Guarani
Kreyòl ayisyen|Haitian Creole
Papiamentu|Papiamento
Nāhuatl|Nahuatl
Sranantongo|Sranan Tongo
Krio|Krio
Naijá|Nigerian Pidgin
粵語|Cantonese
臺語|Taiwanese Hokkien
客家話|Hakka
ܣܘܪܝܝܐ|Syriac|r`
  .split("\n")
  .map((l) => {
    const [n, e, r] = l.split("|");
    return { n, e, rtl: r === "r" };
  })
  .slice(0, 183);

// every Japanese character the postcards draw, so the font slices load before baking
export const JP = "こんにちは！お名前は？わたしは、サムです。きのう、すしを、たべます。いいですね！きのう、すしを、たべました。なんのすしが好きですか？サーモン、大好きです！わたしも！なにをたべましたか…日本語中文粵語臺語客家話";

const TONES = ["#f3e8d2", "#efe2c7", "#f5ecdb", "#ecdcc0"];
const STAMPC = [C.teal, C.red, C.blue, "#c58f1c", "#3f7f5a"];

export function drawFront(c: Ctx2D, x: number, y: number, w: number, h: number, L: Lang, i: number) {
  const tone = TONES[i % 4];
  paperFill(c, x, y, w, h, tone, 0.6, 1, i + 11);
  if (PAPER.art) {
    stripeBorder(c, x + 2, y + 2, w - 4, h - 4, w * 0.032);
    stamp(c, x + w * 0.76, y + h * 0.12, w * 0.14, h * 0.24, STAMPC[i % 5], null, tone);
  }
  if (!PAPER.text) return;
  c.fillStyle = C.teal;
  c.font = `${Math.round(h * 0.135)}px ${FONT.hand}`;
  c.textAlign = "left";
  c.direction = "ltr";
  c.fillText("Greetings from", x + w * 0.1, y + h * 0.3);
  c.fillStyle = C.ink;
  fitFont(c, L.n, 700, nativeStack(), w * 0.8, h * 0.31);
  if (L.rtl) {
    c.direction = "rtl";
    c.textAlign = "right";
    c.fillText(L.n, x + w * 0.9, y + h * 0.66);
    c.direction = "ltr";
    c.textAlign = "left";
  } else c.fillText(L.n, x + w * 0.1, y + h * 0.66);
  c.fillStyle = C.brown;
  c.font = `500 ${Math.round(h * 0.1)}px ${FONT.sans}`;
  c.fillText(L.e, L.rtl ? x + w * 0.9 - c.measureText(L.e).width : x + w * 0.1, y + h * 0.84);
}

// the written side: a few lines of handwriting, an address, a stamp and a postmark
export function drawBack(c: Ctx2D, x: number, y: number, w: number, h: number, i: number, amt = 0.6, cell = 1) {
  const rnd = rng(i * 104729 + 7), tone = TONES[(i + 1) % 4];
  paperFill(c, x, y, w, h, tone, amt, cell, i + 301);
  if (!PAPER.art) return;
  stripeBorder(c, x + 2, y + 2, w - 4, h - 4, w * 0.032);
  c.strokeStyle = "rgba(80,60,40,.35)";
  c.lineWidth = Math.max(1, w * 0.004);
  c.beginPath();
  c.moveTo(x + w * 0.56, y + h * 0.18);
  c.lineTo(x + w * 0.56, y + h * 0.84);
  c.stroke();
  c.strokeStyle = C.pen;
  c.globalAlpha = 0.75;
  c.lineWidth = Math.max(1, w * 0.006);
  for (let k = 0; k < 5; k++) {
    const len = 0.32 + rnd() * 0.12;
    c.beginPath();
    for (let t = 0; t <= 1.001; t += 0.02)
      c.lineTo(x + w * (0.1 + t * len), y + h * (0.24 + k * 0.12) + Math.sin(t * 60 + k * 3) * h * 0.012 * (0.6 + rnd() * 0.5));
    c.stroke();
  }
  c.globalAlpha = 1;
  c.strokeStyle = "rgba(80,60,40,.4)";
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(x + w * 0.62, y + h * (0.58 + k * 0.1));
    c.lineTo(x + w * 0.9, y + h * (0.58 + k * 0.1));
    c.stroke();
  }
  stamp(c, x + w * 0.74, y + h * 0.12, w * 0.15, h * 0.26, STAMPC[(i + 2) % 5], null, tone);
  miniPostmark(c, x + w * 0.7, y + h * 0.36, h * 0.11, i % 2 ? C.red : "#30302e", rnd);
}

// One texture for the whole flock: 183 fronts, then 9 shared backs.
export const ATLAS_COLS = 16, ATLAS_ROWS = 12;
export function drawAtlas(mob: boolean) {
  const TW = mob ? 200 : 256, TH = Math.round(TW * 0.68);
  const at = cv(TW * ATLAS_COLS, TH * ATLAS_ROWS), ac = at.getContext("2d")!;
  LANGS.forEach((L, i) => drawFront(ac, (i % ATLAS_COLS) * TW, Math.floor(i / ATLAS_COLS) * TH, TW, TH, L, i));
  for (let b = 0; b < 9; b++) {
    const i = 183 + b;
    drawBack(ac, (i % ATLAS_COLS) * TW, Math.floor(i / ATLAS_COLS) * TH, TW, TH, b);
  }
  return at;
}
