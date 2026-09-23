// Real-language dataset for the language picker.
//
// We keep only the ISO 639-1 two-letter codes and let the platform's
// Intl.DisplayNames (CLDR-backed) supply the human names. That gives a
// comprehensive, reliable list of world languages without hand-maintaining
// ~180 display strings, and it localises for free.

// name = English name (what we store and send to the backend).
// native = the language's own name for itself, e.g. "मराठी" for Marathi.
export type Language = { code: string; name: string; native: string; rtl: boolean };

// Scripts written right to left among the codes below.
const RTL = new Set(["ar", "dv", "fa", "he", "ks", "ps", "sd", "ug", "ur", "yi"]);

// Full ISO 639-1 set.
const CODES = [
  "aa","ab","ae","af","ak","am","an","ar","as","av","ay","az","ba","be","bg",
  "bh","bi","bm","bn","bo","br","bs","ca","ce","ch","co","cr","cs","cu","cv",
  "cy","da","de","dv","dz","ee","el","en","eo","es","et","eu","fa","ff","fi",
  "fj","fo","fr","fy","ga","gd","gl","gn","gu","gv","ha","he","hi","ho","hr",
  "ht","hu","hy","hz","ia","id","ie","ig","ii","ik","io","is","it","iu","ja",
  "jv","ka","kg","ki","kj","kk","kl","km","kn","ko","kr","ks","ku","kv","kw",
  "ky","la","lb","lg","li","ln","lo","lt","lu","lv","mg","mh","mi","mk","ml",
  "mn","mr","ms","mt","my","na","nb","nd","ne","ng","nl","nn","no","nr","nv",
  "ny","oc","oj","om","or","os","pa","pi","pl","ps","pt","qu","rm","rn","ro",
  "ru","rw","sa","sc","sd","se","sg","si","sk","sl","sm","sn","so","sq","sr",
  "ss","st","su","sv","sw","ta","te","tg","th","ti","tk","tl","tn","to","tr",
  "ts","tt","tw","ty","ug","uk","ur","uz","ve","vi","vo","wa","wo","xh","yi",
  "yo","za","zh","zu",
];

let cache: Language[] | null = null;

// The picker's language list, sorted by English name. Codes the platform can't
// name are dropped, so every entry is a language the browser recognises.
export function allLanguages(): Language[] {
  if (cache) return cache;
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames(["en"], { type: "language" });
  } catch {
    /* Intl.DisplayNames unavailable -> fall back to raw codes below */
  }
  const seen = new Set<string>();
  const list: Language[] = [];
  for (const code of CODES) {
    const name = dn?.of(code) ?? code;
    if (!name || name.toLowerCase() === code) continue; // unknown to CLDR
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ code, name, native: nativeName(code) ?? name, rtl: RTL.has(code) });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  cache = list;
  return list;
}

// The autonym, capitalised the way the language itself would start a label.
function nativeName(code: string): string | null {
  try {
    const n = new Intl.DisplayNames([code], { type: "language" }).of(code);
    if (!n || n.toLowerCase() === code) return null;
    return n.charAt(0).toLocaleUpperCase(code) + n.slice(1);
  } catch {
    return null;
  }
}

// Match against the English name or the native one ("jap", "日本", "marathi").
export function searchLanguages(list: Language[], query: string): Language[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return list;
  const hit = (l: Language) => l.name.toLowerCase().includes(q) || l.native.toLocaleLowerCase().includes(q);
  const starts = (l: Language) => l.name.toLowerCase().startsWith(q) || l.native.toLocaleLowerCase().startsWith(q);
  const all = list.filter(hit);
  return [...all.filter(starts), ...all.filter((l) => !starts(l))];
}
