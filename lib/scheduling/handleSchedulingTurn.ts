import { DEFAULT_APPOINTMENT_DURATION_MINUTES } from "./constants";
import { extractDateAndReason } from "@/lib/ai/extractDate";
import { interpretSchedulingIntent } from "@/lib/ai/interpretSchedulingIntent";
import { generateReply } from "@/lib/ai/generateReply";
import { matchAppointmentByText } from "./matchAppointmentByText";
import { getAvailableSlots } from "@/lib/google/availability";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { matchSlotSelection } from "./matchSlotSelection";
import { isAffirmative } from "./isAffirmative";
import { isDecline } from "./isDecline";
import { isMedicalConcern } from "./isMedicalConcern";
import { formatTimeForHuman, formatDateTimeForHuman, formatDateLabel } from "./format";
import {
  insertAppointment,
  getAppointmentById,
  findActiveAppointmentsForPatient,
  updateAppointmentStatus,
  rescheduleAppointmentRecord,
} from "@/lib/db/queries/appointments";
import { findOrCreatePatient } from "@/lib/db/queries/patients";
import { getClinicSchedulingConfig } from "@/lib/db/queries/clinics";
import type { TimeSlot } from "@/lib/google/availability";
import { looksLikeQuestion } from "./looksLikeQuestion";
import { notifyStaffOfEscalation } from "@/lib/notifications/notifyStaff";
import { insertEscalation } from "@/lib/db/queries/escalations";

export interface SchedulingContext {
  step?:
    | "collecting_date"
    | "awaiting_slot_selection"
    | "confirming_cancellation"
    | "selecting_appointment";
  action?: "book" | "reschedule" | "cancel";
  reason?: string | null;
  durationMinutes?: number;
  requestedDate?: string;
  offeredSlots?: TimeSlot[];
  appointmentId?: string;
}

interface SchedulingResult {
  replyText: string;
  newContext: SchedulingContext;
  escalated?: boolean;
}

// Normaliza texto en español para comparaciones tolerantes a tildes —
// mismo criterio usado en isAffirmative.ts. "extracción" y "extraccion"
// deben matchear igual, sin importar cómo se cargó el motivo en
// clinics.config ni cómo lo escribió el paciente.
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resolveDuration(reason: string | null, durationByReason: Record<string, number>): number {
  if (!reason) return DEFAULT_APPOINTMENT_DURATION_MINUTES;
  const normalizedReason = stripAccents(reason.toLowerCase());

  const match = Object.entries(durationByReason).find(
    ([key]) => stripAccents(key.toLowerCase()) === normalizedReason
  );

  return match?.[1] ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
}

async function offerSlotsForDate(
  clinicId: string,
  date: string,
  reason: string | null,
  action: "book" | "reschedule",
  appointmentId: string | undefined
): Promise<SchedulingResult> {
  const { businessHours, appointmentDurationByReason } = await getClinicSchedulingConfig(clinicId);
  const durationMinutes = resolveDuration(reason, appointmentDurationByReason);
  const slots = await getAvailableSlots(clinicId, date, durationMinutes, businessHours);

  if (slots.length === 0) {
    return {
      replyText: "No encontré espacios disponibles ese día. ¿Querés probar con otra fecha?",
      newContext: { step: "collecting_date", reason, action, appointmentId },
    };
  }

  const replyText = await generateReply({
    situation: "offer_slots",
    facts: {
      día: formatDateLabel(date),
      horarios_disponibles: slots.map((s) => formatTimeForHuman(new Date(s.start))).join(", "),
    },
  });

  return {
    replyText,
    newContext: {
      step: "awaiting_slot_selection",
      reason,
      durationMinutes,
      offeredSlots: slots,
      action,
      appointmentId,
    },
  };
}

async function beginActionForAppointment(
  clinicId: string,
  appointment: { id: string; scheduledAt: Date },
  action: "cancel" | "reschedule"
): Promise<SchedulingResult> {
  if (action === "cancel") {
    return {
      replyText: `¿Confirmás que querés cancelar tu cita del ${formatDateTimeForHuman(appointment.scheduledAt)}?`,
      newContext: { step: "confirming_cancellation", appointmentId: appointment.id },
    };
  }

  const replyText = await generateReply({ situation: "ask_date", facts: {} });
  return {
    replyText,
    newContext: { step: "collecting_date", action: "reschedule", appointmentId: appointment.id },
  };
}

export async function handleSchedulingTurn(
  clinicId: string,
  phone: string,
  messageText: string,
  context: SchedulingContext,
  conversationId: string
): Promise<SchedulingResult> {
  const todayISO = new Date().toISOString().slice(0, 10);

  if (isMedicalConcern(messageText)) {
    await notifyStaffOfEscalation({ clinicId, patientPhone: phone, messageText });
    await insertEscalation({
      conversationId,
      clinicId,
      reason: "Mención de posible urgencia médica durante el flujo de agenda",
    });
    const replyText = await generateReply({ situation: "escalation", facts: {} });
    return { replyText, newContext: {}, escalated: true };
  }

  if (context.step !== "confirming_cancellation" && isDecline(messageText)) {
    const replyText = await generateReply({ situation: "flow_exited", facts: {} });
    return { replyText, newContext: {} };
  }

  if (context.step === "selecting_appointment" && context.action) {
    const patient = await findOrCreatePatient(clinicId, phone);
    const active = await findActiveAppointmentsForPatient(clinicId, patient.id);

    const match = await matchAppointmentByText(
      messageText,
      todayISO,
      active.map((a) => ({ id: a.id, scheduledAt: new Date(a.scheduledAt) }))
    );

    if (!match) {
      return {
        replyText:
          "No logré identificar cuál cita es. ¿Podés escribir la fecha y hora exacta, tal como te la confirmamos?",
        newContext: context,
      };
    }

    return beginActionForAppointment(clinicId, match, context.action as "cancel" | "reschedule");
  }

  if (context.step === "confirming_cancellation" && context.appointmentId) {
    const confirmed = isAffirmative(messageText);

    if (confirmed === null) {
      return { replyText: "¿Confirmás que querés cancelar la cita? Respondé sí o no.", newContext: context };
    }

    if (!confirmed) {
      const replyText = await generateReply({ situation: "cancellation_declined", facts: {} });
      return { replyText, newContext: {} };
    }

    const appointment = await getAppointmentById(context.appointmentId);
    if (appointment?.calendarEventId) {
      await deleteCalendarEvent(clinicId, appointment.calendarEventId);
    }
    await updateAppointmentStatus(context.appointmentId, "cancelled");

    const replyText = await generateReply({ situation: "cancellation_confirmed", facts: {} });
    return { replyText, newContext: {} };
  }

  if (context.step === "awaiting_slot_selection" && context.offeredSlots?.length) {
    const chosen = matchSlotSelection(messageText, context.offeredSlots);

    if (!chosen) {
      if (looksLikeQuestion(messageText)) {
        const replyText = await generateReply({ situation: "off_topic_during_flow", facts: {} });
        return { replyText, newContext: context };
      }
      return {
        replyText: `No logré identificar cuál horario elegiste. Las opciones eran: ${context.offeredSlots
          .map((s) => formatTimeForHuman(new Date(s.start)))
          .join(", ")}. ¿Cuál preferís?`,
        newContext: context,
      };
    }

    if (context.action === "reschedule" && context.appointmentId) {
      const appointment = await getAppointmentById(context.appointmentId);
      if (appointment?.calendarEventId) {
        await updateCalendarEvent(clinicId, appointment.calendarEventId, {
          startISO: chosen.start,
          endISO: chosen.end,
        });
      }
      await rescheduleAppointmentRecord(context.appointmentId, new Date(chosen.start));

      const replyText = await generateReply({
        situation: "reschedule_confirmed",
        facts: { hora: formatTimeForHuman(new Date(chosen.start)) },
      });
      return { replyText, newContext: {} };
    }

    const patient = await findOrCreatePatient(clinicId, phone);
    const event = await createCalendarEvent(clinicId, {
      summary: `Cita dental${context.reason ? ` - ${context.reason}` : ""}`,
      startISO: chosen.start,
      endISO: chosen.end,
    });

    await insertAppointment({
      clinicId,
      patientId: patient.id,
      scheduledAt: new Date(chosen.start),
      status: "pending",
      calendarEventId: event.id ?? null,
    });

    const replyText = await generateReply({
      situation: "booking_confirmed",
      facts: { hora: formatTimeForHuman(new Date(chosen.start)) },
    });
    return { replyText, newContext: {} };
  }

  if (context.step === "collecting_date") {
    const extraction = await extractDateAndReason(messageText, todayISO);
    const reason = extraction.reason ?? context.reason ?? null;

    if (!extraction.date) {
      if (looksLikeQuestion(messageText)) {
        const replyText = await generateReply({ situation: "off_topic_during_flow", facts: {} });
        return { replyText, newContext: context };
      }
      return { replyText: "No logré entender la fecha. ¿Podés decirme el día de nuevo?", newContext: context };
    }

    return offerSlotsForDate(
      clinicId,
      extraction.date,
      reason,
      context.action === "reschedule" ? "reschedule" : "book",
      context.appointmentId
    );
  }

  const intent = await interpretSchedulingIntent(messageText, todayISO);

  if (intent.action === "cancel" || intent.action === "reschedule") {
    const patient = await findOrCreatePatient(clinicId, phone);
    const active = await findActiveAppointmentsForPatient(clinicId, patient.id);

    if (active.length === 0) {
      return {
        replyText: "No encontré ninguna cita activa a tu nombre. ¿Querés agendar una nueva?",
        newContext: {},
      };
    }

    if (active.length > 1) {
      const list = active.map((a) => formatDateTimeForHuman(new Date(a.scheduledAt))).join("; ");
      return {
        replyText: `Tenés más de una cita activa (${list}). Por ahora escribime la fecha exacta de la que querés ${
          intent.action === "cancel" ? "cancelar" : "reprogramar"
        }.`,
        newContext: { step: "selecting_appointment", action: intent.action },
      };
    }

    const appointment = active[0];

    if (intent.action === "cancel") {
      return beginActionForAppointment(clinicId, appointment, "cancel");
    }

    if (intent.date) {
      return offerSlotsForDate(clinicId, intent.date, intent.reason, "reschedule", appointment.id);
    }

    const replyText = await generateReply({ situation: "ask_date", facts: {} });
    return {
      replyText,
      newContext: { step: "collecting_date", action: "reschedule", appointmentId: appointment.id },
    };
  }

  if (!intent.date) {
    const replyText = await generateReply({ situation: "ask_date", facts: {} });
    return { replyText, newContext: { step: "collecting_date", reason: intent.reason } };
  }

  return offerSlotsForDate(clinicId, intent.date, intent.reason, "book", undefined);
}