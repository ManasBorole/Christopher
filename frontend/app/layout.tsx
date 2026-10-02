import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Figtree,
  Gochi_Hand,
  Noto_Naskh_Arabic,
  Noto_Sans_Devanagari,
  Noto_Sans_Hebrew,
  Noto_Sans_JP,
} from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Latin faces preload. Script faces don't: their unicode-range means the browser
// only fetches them when a Devanagari/Arabic/Hebrew character is on screen.
const sans = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
// opsz is loaded for the landing's display sizes; the app keeps the default cut (globals.css).
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], axes: ["opsz"], variable: "--font-display", display: "swap" });
const hand = Gochi_Hand({ weight: "400", subsets: ["latin"], variable: "--font-hand", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", display: "swap", preload: false });
const arab = Noto_Naskh_Arabic({ subsets: ["arabic"], variable: "--font-arab", display: "swap", preload: false });
const hebr = Noto_Sans_Hebrew({ subsets: ["hebrew"], variable: "--font-hebr", display: "swap", preload: false });
// Japanese for the landing's postcards; its unicode-range slices load on demand.
const jp = Noto_Sans_JP({ weight: ["400", "500", "700"], variable: "--font-jp", display: "swap", preload: false });
const fontVars = [sans, display, hand, deva, arab, hebr, jp].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "Christopher, a voice tutor for 180+ languages",
  description: "Talk out loud in a new language with Christopher. He listens to the whole sentence and gently repeats the right way when you slip.",
};

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Runs before first paint so a saved light/dark choice never flashes the other theme.
const themeBoot = `try{var t=localStorage.getItem("chr-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-screen">
        <div className="airmail-edge" aria-hidden />
        {children}
      </body>
    </html>
  );
  return hasClerk ? <ClerkProvider>{shell}</ClerkProvider> : shell;
}
