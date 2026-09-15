import { getCurrentUserClinicSettings } from "@/lib/supabase/queries/clinic";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const clinic = await getCurrentUserClinicSettings();

  if (!clinic) {
    return (
      <div className="flex-1 flex items-center justify-center text-brand-muted text-sm">
        No se pudo cargar la configuración de la clínica.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <h1 className="font-[family-name:var(--font-display)] text-xl text-brand-heading mb-1">Ajustes</h1>
      <p className="text-sm text-brand-muted mb-6">{clinic.name}</p>
      <SettingsForm initial={clinic} />
    </div>
  );
}