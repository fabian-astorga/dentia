import type { Metadata } from "next";
import { Bevan, Inter } from "next/font/google";
import "./globals.css";

const bevan = Bevan({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "DentIA — Panel",
  description: "Panel de conversaciones de DentIA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${bevan.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)]">{children}</body>
    </html>
  );
}