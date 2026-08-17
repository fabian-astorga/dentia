// Isotipo simple: una forma orgánica única que evoca a la vez una hoja
// (cuidado, natural, boutique) y una muela estilizada (el rubro) — sin
// caer en el cliché de dibujar literalmente un diente. Un solo color
// (currentColor), pensado para funcionar tanto en el verde principal
// como en blanco sobre un fondo oscuro si hiciera falta más adelante.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 5c-2.6 0-4.3 1.7-6.3 1.7-1.7 0-2.8-0.9-4.2-0.9 0 3.6 0.8 6.5 1.8 9.3 1 2.9 2.7 8.4 5.4 8.4 1.8 0 1.9-3.4 3.3-3.4s1.5 3.4 3.3 3.4c2.7 0 4.4-5.5 5.4-8.4 1-2.8 1.8-5.7 1.8-9.3-1.4 0-2.5 0.9-4.2 0.9C20.3 6.7 18.6 5 16 5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="w-6 h-6 text-brand-primary shrink-0" />
      <span className="font-[family-name:var(--font-display)] text-[19px] tracking-wide uppercase text-brand-heading">
        Dent<span className="text-brand-primary">IA</span>
      </span>
    </div>
  );
}