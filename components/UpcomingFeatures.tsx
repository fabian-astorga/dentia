// Lista fija de features Post-MVP para mostrar en el sidebar como
// vidriera del roadmap durante demos con clientes — ver CLAUDE.md
// pendientes #13-16 y Excel Backlog MVP B31-B34/B24-B26. Ninguno de
// estos ítems es funcional todavía: son intencionalmente no
// clickeables, solo comunican profundidad de producto.
const UPCOMING_FEATURES = [
  { label: "Gestor de contenido educativo", hint: "Cargá y aprobá los artículos que el bot le comparte a tus pacientes (higiene, cuidados, dudas frecuentes)." },
  { label: "Resumen antes de cada cita", hint: "Un resumen breve de lo que el paciente ya contó por WhatsApp al agendar, antes de que entre al consultorio." },
  { label: "Relleno automático de cancelaciones", hint: "Cuando alguien cancela, el horario se ofrece solo a pacientes en espera — sin que nadie tenga que llamar." },
  { label: "Recordatorio de control periódico", hint: "Pacientes que ya pasaron su intervalo de limpieza/revisión, listos para reactivar con un mensaje." },
  { label: "Reportes e insights", hint: "Métricas de la clínica más allá del reporte semanal — tendencias, motivos de cancelación, horarios más pedidos." },
];

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function UpcomingFeatures() {
  return (
    <div className="px-6 pt-4 pb-5 border-t border-brand-border shrink-0">
      <p className="text-[11px] uppercase tracking-wide text-brand-muted mb-2">Próximamente</p>
      <div className="flex flex-col gap-0.5">
        {UPCOMING_FEATURES.map((f) => (
          <div
            key={f.label}
            title={f.hint}
            className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-default"
          >
            <span className="text-[13px] text-brand-muted">{f.label}</span>
            <span className="flex items-center gap-1 shrink-0 text-[10px] font-medium bg-brand-accent/15 text-brand-accent px-2 py-0.5 rounded-full">
              <LockIcon />
              Pronto
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}