"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Secciones bloqueadas — mismo criterio que antes tenía
// UpcomingFeatures.tsx (ahora retirado, esta navegación cubre el mismo
// propósito de mostrar profundidad de roadmap, mejor integrado).
const LOCKED_ITEMS = [
  { icon: "ti-users", label: "Pacientes", hint: "Historial y datos de contacto de cada paciente." },
  { icon: "ti-book-2", label: "Contenido", hint: "Gestor de contenido educativo para pacientes (Dentipedia)." },
  { icon: "ti-chart-bar", label: "Reportes", hint: "Métricas e insights más allá del reporte semanal." },
];

export function PanelNav() {
  const pathname = usePathname();
  const isChats = pathname === "/panel";
  const isSettings = pathname?.startsWith("/panel/settings");

  return (
    <nav className="w-16 shrink-0 bg-brand-bg border-r border-brand-border flex flex-col items-center py-4">
      <Link href="/panel" className="flex flex-col items-center gap-1 w-full py-2">
        <span
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isChats ? "bg-brand-primary text-white" : "text-brand-faint hover:bg-brand-hover"
          }`}
        >
          <i className="ti ti-message-circle text-xl" />
        </span>
        <span className={`text-[10px] ${isChats ? "text-brand-primary font-medium" : "text-brand-faint"}`}>Chats</span>
      </Link>

      {LOCKED_ITEMS.map((item) => (
        <div key={item.label} title={item.hint} className="flex flex-col items-center gap-1 w-full py-2 cursor-default">
          <span className="w-10 h-10 rounded-lg flex items-center justify-center text-brand-faint relative">
            <i className={`ti ${item.icon} text-xl`} />
            <i className="ti ti-lock text-[9px] absolute bottom-0.5 right-0.5 bg-brand-bg rounded-full" />
          </span>
          <span className="text-[10px] text-brand-faint">{item.label}</span>
        </div>
      ))}

      <Link href="/panel/settings" className="flex flex-col items-center gap-1 w-full py-2 mt-auto">
        <span
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isSettings ? "bg-brand-primary text-white" : "text-brand-faint hover:bg-brand-hover"
          }`}
        >
          <i className="ti ti-settings text-xl" />
        </span>
      </Link>
    </nav>
  );
}