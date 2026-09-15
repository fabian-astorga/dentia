"use server";

import { revalidatePath } from "next/cache";
import { updateCurrentUserClinicSettings } from "@/lib/supabase/queries/clinic";

export async function saveClinicSettings(formData: FormData) {
  const startHour = Number(formData.get("startHour"));
  const endHour = Number(formData.get("endHour"));
  const notificationPhone = String(formData.get("notificationPhone") ?? "").trim();
  const notificationEmail = String(formData.get("notificationEmail") ?? "").trim();

  const result = await updateCurrentUserClinicSettings({
    businessHours: { startHour, endHour },
    notificationPhone,
    notificationEmail,
  });

  if (!result.success) {
    // Devolvemos el error para que el formulario cliente lo muestre —
    // ver la nota en clinic.ts: esto puede fallar por falta de una
    // política de UPDATE en Supabase para la tabla clinics, mismo tipo
    // de error que ya diagnosticamos antes ("permission denied").
    return { success: false, error: result.error };
  }

  revalidatePath("/panel/settings");
  return { success: true, error: null };
}