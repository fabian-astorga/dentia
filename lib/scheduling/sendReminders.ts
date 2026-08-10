import { getAppointmentsNeedingReminder, markReminderSent } from "@/lib/db/queries/appointments";
import { getPatientById } from "@/lib/db/queries/patients";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { findOrCreateConversation } from "@/lib/db/queries/conversations";
import { insertMessage } from "@/lib/db/queries/messages";
import { formatDateTimeForHuman } from "./format";

// Costa Rica no observa horario de verano — mismo criterio que
// lib/reports/weekRange.ts.
const COSTA_RICA_UTC_OFFSET_HOURS = -6;

// Con el cron de Vercel corriendo una sola vez al día (límite del plan
// Hobby — ver vercel.json), no podemos depender de una ventana angosta
// alrededor de "exactamente 24h": con una sola corrida diaria, eso
// dejaría sin recordatorio a cualquier cita fuera de esa franja
// estrecha. En su lugar, cada corrida cubre el día calendario de
// mañana completo (hora de Costa Rica) — así toda cita de mañana recibe
// su recordatorio, aunque llegue en algún punto entre ~16 y ~33 horas
// antes según la hora de la cita, no exactamente a las 24h.
function getTomorrowRangeInCostaRica(referenceDate: Date = new Date()) {
  const crNow = new Date(referenceDate.getTime() + COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  const crTodayMidnight = new Date(crNow);
  crTodayMidnight.setUTCHours(0, 0, 0, 0);

  const crTomorrowMidnight = new Date(crTodayMidnight);
  crTomorrowMidnight.setUTCDate(crTomorrowMidnight.getUTCDate() + 1);

  const crDayAfterMidnight = new Date(crTomorrowMidnight);
  crDayAfterMidnight.setUTCDate(crDayAfterMidnight.getUTCDate() + 1);

  const windowStart = new Date(crTomorrowMidnight.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(crDayAfterMidnight.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  return { windowStart, windowEnd };
}

export async function sendUpcomingReminders() {
  const { windowStart, windowEnd } = getTomorrowRangeInCostaRica();

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