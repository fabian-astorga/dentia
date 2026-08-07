import { getAppointmentsNeedingReminder, markReminderSent } from "@/lib/db/queries/appointments";
import { getPatientById } from "@/lib/db/queries/patients";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { findOrCreateConversation } from "@/lib/db/queries/conversations";
import { insertMessage } from "@/lib/db/queries/messages";
import { formatDateTimeForHuman } from "./format";

const REMINDER_WINDOW_HOURS = 1; // busca citas entre 23h y 25h desde ahora

export async function sendUpcomingReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (24 - REMINDER_WINDOW_HOURS) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (24 + REMINDER_WINDOW_HOURS) * 60 * 60 * 1000);

  const dueAppointments = await getAppointmentsNeedingReminder(windowStart, windowEnd);

  const results = [];

  for (const appointment of dueAppointments) {
    const patient = await getPatientById(appointment.patientId);
    if (!patient) continue;

    const reminderText = `Hola, te recordamos tu cita mañana ${formatDateTimeForHuman(
      new Date(appointment.scheduledAt)
    )}. ¿Confirmás que asistís?`;

    await sendWhatsAppMessage(patient.phone, reminderText);

    const conversation = await findOrCreateConversation(appointment.clinicId, patient.phone);
    await insertMessage({
      conversationId: conversation.id,
      direction: "outbound",
      content: reminderText,
    });

    await markReminderSent(appointment.id);
    results.push({ appointmentId: appointment.id, phone: patient.phone });
  }

  return results;
}