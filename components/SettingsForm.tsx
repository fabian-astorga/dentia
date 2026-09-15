"use client";

import { useState, useTransition } from "react";
import { saveClinicSettings } from "@/app/panel/settings/actions";
import type { ClinicSettings } from "@/lib/supabase/queries/clinic";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHourOption(hour: number): string {
  const period = hour < 12 ? "a. m." : "p. m.";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

export function SettingsForm({ initial }: { initial: ClinicSettings }) {
  const [tab, setTab] = useState<"general" | "facturacion">("general");
  const [startHour, setStartHour] = useState(initial.businessHours.startHour);
  const [endHour, setEndHour] = useState(initial.businessHours.endHour);
  const [notificationPhone, setNotificationPhone] = useState(initial.notificationPhone);
  const [notificationEmail, setNotificationEmail] = useState(initial.notificationEmail);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("idle");

    const formData = new FormData();
    formData.set("startHour", String(startHour));
    formData.set("endHour", String(endHour));
    formData.set("notificationPhone", notificationPhone);
    formData.set("notificationEmail", notificationEmail);

    startTransition(async () => {
      const result = await saveClinicSettings(formData);
      if (result.success) {
        setStatus("saved");
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  return (
    <div className="max-w-xl">
      <div className="flex gap-1 border-b border-brand-border mb-6">
        <button
          onClick={() => setTab("general")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "general"
              ? "border-brand-primary text-brand-heading"
              : "border-transparent text-brand-muted hover:text-brand-text"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setTab("facturacion")}
          className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-brand-muted flex items-center gap-1.5 cursor-default"
        >
          Facturación
          <span className="flex items-center gap-1 text-[10px] font-medium bg-brand-accent/15 text-brand-accent px-2 py-0.5 rounded-full">
            <i className="ti ti-lock text-[9px]" />
            Pronto
          </span>
        </button>
      </div>

      {tab === "general" ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-medium text-brand-heading mb-3">Horario de atención</h2>
            <div className="flex items-center gap-3">
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="border border-brand-border rounded-lg px-3 py-2 text-sm bg-brand-surface"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {formatHourOption(h)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-brand-muted">a</span>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="border border-brand-border rounded-lg px-3 py-2 text-sm bg-brand-surface"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {formatHourOption(h)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[12px] text-brand-muted mt-2">
              El bot solo ofrece horarios de cita dentro de este rango.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-brand-heading mb-3">Notificaciones internas</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] text-brand-muted block mb-1">Teléfono para casos especiales</label>
                <input
                  type="text"
                  value={notificationPhone}
                  onChange={(e) => setNotificationPhone(e.target.value)}
                  placeholder="+506 8888 8888"
                  className="w-full border border-brand-border rounded-lg px-3 py-2 text-sm bg-brand-surface"
                />
              </div>
              <div>
                <label className="text-[12px] text-brand-muted block mb-1">Correo para el reporte semanal</label>
                <input
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="clinica@ejemplo.com"
                  className="w-full border border-brand-border rounded-lg px-3 py-2 text-sm bg-brand-surface"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-brand-primary hover:bg-brand-primary-hover transition-colors text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            {status === "saved" && <span className="text-sm text-status-positive-text">Guardado ✓</span>}
            {status === "error" && (
              <span className="text-sm text-status-alert-text">
                No se pudo guardar{errorMsg ? `: ${errorMsg}` : ""}.
              </span>
            )}
          </div>
        </form>
      ) : (
        <div className="border border-brand-border rounded-xl p-8 text-center">
          <i className="ti ti-credit-card text-3xl text-brand-faint mb-2" />
          <p className="text-sm text-brand-muted">
            La facturación todavía no está disponible — la vamos a habilitar cuando definamos el modelo de precios
            del piloto.
          </p>
        </div>
      )}
    </div>
  );
}