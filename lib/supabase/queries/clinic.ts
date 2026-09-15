import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ClinicSettings {
  id: string;
  name: string;
  businessHours: { startHour: number; endHour: number };
  notificationPhone: string;
  notificationEmail: string;
}

const DEFAULT_BUSINESS_HOURS = { startHour: 8, endHour: 17 };

// Sin filtro explícito de clínica — igual que
// listConversationsForCurrentUser, RLS es la única fuente de verdad
// sobre qué fila puede ver el usuario logueado.
export async function getCurrentUserClinicSettings(): Promise<ClinicSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clinics").select("id, name, config").limit(1).maybeSingle();

  if (error || !data) {
    console.error("Failed to load clinic settings:", error);
    return null;
  }

  const config = (data.config as Record<string, unknown>) ?? {};
  return {
    id: data.id,
    name: data.name,
    businessHours: (config.businessHours as ClinicSettings["businessHours"]) ?? DEFAULT_BUSINESS_HOURS,
    notificationPhone: (config.notificationPhone as string) ?? "",
    notificationEmail: (config.notificationEmail as string) ?? "",
  };
}

// Actualiza SOLO los campos que le pasamos, preservando cualquier otra
// clave que ya viva en config.jsonb (ej. appointmentDurationByReason,
// que el bot usa pero esta pantalla no edita) — traer el config crudo
// completo primero y mezclar, nunca reemplazarlo entero, para no
// borrar datos que esta pantalla no conoce.
export async function updateCurrentUserClinicSettings(updates: {
  businessHours?: { startHour: number; endHour: number };
  notificationPhone?: string;
  notificationEmail?: string;
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: current, error: fetchError } = await supabase
    .from("clinics")
    .select("id, config")
    .limit(1)
    .maybeSingle();

  if (fetchError || !current) {
    return { success: false, error: fetchError?.message ?? "No se encontró la clínica" };
  }

  const mergedConfig = { ...((current.config as Record<string, unknown>) ?? {}), ...updates };

  const { error } = await supabase.from("clinics").update({ config: mergedConfig }).eq("id", current.id);

  return { success: !error, error: error?.message ?? null };
}