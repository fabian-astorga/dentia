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
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/3.46.0/tabler-icons.min.css"
        />
        {/* Confirmada directo en cdnjs.com/libraries/tabler-icons —
            la estructura de carpetas cambió entre versiones: en la
            2.44.0 (y las que probé antes) los archivos vivían dentro
            de iconfont/, pero en la versión actual (3.46.0) los
            movieron a la raíz sin esa subcarpeta. Dos intentos
            anteriores fallaron por esto — esta la verifiqué visitando
            la página real del CDN, no adivinando de nuevo. */}
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)]">{children}</body>
    </html>
  );
}