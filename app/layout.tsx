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
          href="https://cdnjs.cloudflare.com/ajax/libs/tabler-icons/2.44.0/iconfont/tabler-icons.min.css"
        />
        {/* La URL anterior (jsdelivr, @tabler/icons-webfont) le faltaba
            el segmento /dist/ en la ruta — apuntaba a un archivo que
            no existe (404 silencioso), por eso ningún ícono cargaba.
            Esta URL de cdnjs es la que ya usamos con éxito en los
            mockups de hoy — confirmada funcionando, no solo teórica. */}
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)]">{children}</body>
    </html>
  );
}