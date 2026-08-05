import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Christopher - AI Voice Language Tutor",
  description: "Learn any language through natural voice conversation with an AI tutor.",
};

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen">
        <div className="aurora" aria-hidden />
        <div className="grain" aria-hidden />
        {children}
      </body>
    </html>
  );
  return hasClerk ? <ClerkProvider>{shell}</ClerkProvider> : shell;
}
