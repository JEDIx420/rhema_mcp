import type { Metadata } from "next";
import "./globals.css";
import EnglishTranslationProvider from "@/components/EnglishTranslationProvider";

export const metadata: Metadata = {
  title: "rhelo — bible study engine",
  description: "A high-fidelity, local-first Bible study search engine and exegesis machine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased text-base selection:bg-blue-100 selection:text-blue-900 min-h-full flex flex-col print:!block print:!h-auto print:!min-h-0 print:!overflow-visible"><EnglishTranslationProvider>{children}</EnglishTranslationProvider></body>
    </html>
  );
}
