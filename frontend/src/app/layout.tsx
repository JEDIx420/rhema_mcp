import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "targum — bible study engine",
  description: "A high-fidelity, local-first Bible study search engine and exegesis machine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="bg-slate-50 text-slate-900 font-sans antialiased text-base selection:bg-blue-100 selection:text-blue-900 min-h-full flex flex-col">{children}</body>
    </html>
  );
}
