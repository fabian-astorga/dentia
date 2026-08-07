import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { getClinicNotificationPhone } from "@/lib/db/queries/clinics";

interface NotifyStaffInput {
  clinicId: string;
  patientPhone: string;
  messageText: string;
}

// Envía la alerta real al staff por WhatsApp. Si la clínica no tiene un
// número de notificación configurado todavía, no falla — solo lo loguea,
// para no romper la respuesta al paciente por una config faltante.
export async function notifyStaffOfEscalation(input: NotifyStaffInput) {
  const staffPhone = await getClinicNotificationPhone(input.clinicId);

  if (!staffPhone) {
    console.warn(`Clínica ${input.clinicId} no tiene notificationPhone configurado — no se envió alerta.`);
    return;
  }

  const alertText = `⚠️ Caso especial detectado.\nPaciente: ${input.patientPhone}\nMensaje: "${input.messageText}"\n\nRevisar y contactar directamente.`;

  await sendWhatsAppMessage(staffPhone, alertText);
}