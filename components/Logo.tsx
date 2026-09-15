// Isotipo: diente + burbuja de chat con puntos suspensivos, combinando
// las dos mitades del producto (dental + WhatsApp) en un solo símbolo.
// Basado en un concepto que Fabián generó y aprobó (16 de septiembre
// 2026) — rehecho acá como SVG limpio en los tonos exactos de la
// paleta (heading + primary), en vez de usar el PNG generado
// directamente: un PNG no escala bien en distintos tamaños (favicon,
// retina) ni se puede recolorear con CSS como este SVG si algún día
// hace falta, por ejemplo, en blanco sobre un fondo oscuro.
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 5c-2.6 0-4.3 1.7-6.3 1.7-1.7 0-2.8-0.9-4.2-0.9 0 3.6 0.8 6.5 1.8 9.3 1 2.9 2.7 8.4 5.4 8.4 1.8 0 1.9-3.4 3.3-3.4s1.5 3.4 3.3 3.4c2.7 0 4.4-5.5 5.4-8.4 1-2.8 1.8-5.7 1.8-9.3-1.4 0-2.5 0.9-4.2 0.9C20.3 6.7 18.6 5 16 5z"
        fill="var(--color-brand-heading, currentColor)"
      />
      <path
        d="M11 15c1.2 1.3 2.7 2 5 2s3.8-0.7 5-2"
        stroke="var(--color-brand-primary, currentColor)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="24" cy="10" r="6" fill="var(--color-brand-primary, currentColor)" />
      <path d="M20 15l-1.3 2.8L22 16.5z" fill="var(--color-brand-primary, currentColor)" />
      <circle cx="21.3" cy="10" r="0.9" fill="white" />
      <circle cx="24" cy="10" r="0.9" fill="white" />
      <circle cx="26.7" cy="10" r="0.9" fill="white" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="w-6 h-6 shrink-0" />
      <span className="font-[family-name:var(--font-display)] text-[19px] tracking-wide uppercase text-brand-heading">
        Dent<span className="text-brand-primary">IA</span>
      </span>
    </div>
  );
}