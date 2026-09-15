import { PanelHeader } from "./PanelHeader";
import { PanelNav } from "./PanelNav";

// Envoltorio compartido para las páginas autenticadas del panel
// (Chats, Ajustes, y lo que se sume después). Deliberadamente NO es un
// layout.tsx de Next.js: como /panel/login vive anidado dentro de
// /panel/, un layout ahí lo envolvería también — mostrando el
// header/nav a alguien que todavía no inició sesión. Cada página
// autenticada importa este componente explícitamente en su lugar.
export function PanelShell({ clinicName, children }: { clinicName: string; children: React.ReactNode }) {
  return (
    <div className="h-screen bg-brand-bg flex flex-col text-brand-text">
      <PanelHeader clinicName={clinicName} />
      <div className="flex-1 flex min-h-0">
        <PanelNav />
        {children}
      </div>
    </div>
  );
}