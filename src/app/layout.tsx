import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Comps · Find the readers who will buy your book",
  description:
    "An AI agent that reads Qloo's taste graph to find real comp titles, Amazon Ads targets, reader channels and regions for self-published authors.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
