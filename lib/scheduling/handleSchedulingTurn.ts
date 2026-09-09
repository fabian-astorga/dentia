import { DEFAULT_APPOINTMENT_DURATION_MINUTES } from "./constants";
import { extractDateAndReason } from "@/lib/ai/extractDate";
import { interpretSchedulingIntent } from "@/lib/ai/interpretSchedulingIntent";
import { generateReply } from "@/lib/ai/generateReply";
import { matchAppointmentByText } from "./matchAppointmentByText";
import { getAvailableSlots } from "@/lib/google/availability";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "@/lib/google/calendar";
import { matchSlotSelection, suggestNearestSlots } from "./matchSlotSelection";
import { isAffirmative } from "./isAffirmative";
import { isDecline } from "./isDecline";
import { isMedicalConcern } from "./isMedicalConcern";
import { formatTimeForHuman, formatDateTimeForHuman, formatDateLabel, formatFullDayLabel } from "./format";
import { getCostaRicaTodayISO } from "./timezone";
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
import { isWithinBusinessHours, formatOpeningTime } from "./isWithinBusinessHours";

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
  // Qué acción se resolvió realmente en este turno — usado por
  // handleIncomingMessage.ts para etiquetar la conversación en el panel
  // con precisión ("Cancelar cita" en vez de "Agendar cita" genérico
  // para todo lo que pasa por este archivo). Antes no existía este
  // campo y el panel mostraba "Agendar cita" incluso para
  // cancelaciones — encontrado revisando el panel al final del guión
  // de pruebas. Opcional porque algunos turnos (ej. declinar el flujo)
  // no tienen una acción clara que etiquetar.
  action?: "book" | "reschedule" | "cancel";
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
      action,
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
    action,
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
      action: "cancel",
    };
  }

  const replyText = await generateReply({ situation: "ask_date", facts: {} });
  return {
    replyText,
    newContext: { step: "collecting_date", action: "reschedule", appointmentId: appointment.id },
    action: "reschedule",
  };
}

export async function handleSchedulingTurn(
  clinicId: string,
  phone: string,
  messageText: string,
  context: SchedulingContext,
  conversationId: string
): Promise<SchedulingResult> {
  // IMPORTANTE: NUNCA usar new Date().toISOString().slice(0, 10) acá —
  // eso da la fecha en UTC del servidor (Vercel), no en Costa Rica.
  // Como CR está 6 horas atrás, cualquier momento después de ~6pm hora
  // CR ya cruzó a "mañana" en UTC, y todo lo que depende de este
  // todayISO (extractDateAndReason, interpretSchedulingIntent,
  // matchAppointmentByText) heredaba un "hoy" equivocado. Encontrado
  // probando a las 7:41pm CR: "el viernes" volvió a resolver una
  // semana después en vez de mañana. Ver Notas técnicas en CLAUDE.md.
  const todayISO = getCostaRicaTodayISO();

  if (isMedicalConcern(messageText)) {
    await notifyStaffOfEscalation({ clinicId, patientPhone: phone, messageText });
    await insertEscalation({
      conversationId,
      clinicId,
      reason: "Mención de posible urgencia médica durante el flujo de agenda",
    });

    const { businessHours } = await getClinicSchedulingConfig(clinicId);
    const withinHours = isWithinBusinessHours(businessHours);

    const replyText = await generateReply({
      situation: withinHours ? "escalation" : "escalation_after_hours",
      facts: withinHours ? {} : { hora_de_apertura: formatOpeningTime(businessHours) },
    });
    return { replyText, newContext: {}, escalated: true };
  }

  if (context.step !== "confirming_cancellation" && isDecline(messageText)) {
    const replyText = await generateReply({ situation: "flow_exited", facts: {} });
    return { replyText, newContext: {}, action: context.action };
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
        action: context.action,
      };
    }

    return beginActionForAppointment(clinicId, match, context.action as "cancel" | "reschedule");
  }

  if (context.step === "confirming_cancellation" && context.appointmentId) {
    const confirmed = isAffirmative(messageText);

    if (confirmed === null) {
      return {
        replyText: "¿Confirmás que querés cancelar la cita? Respondé sí o no.",
        newContext: context,
        action: "cancel",
      };
    }

    if (!confirmed) {
      const replyText = await generateReply({ situation: "cancellation_declined", facts: {} });
      return { replyText, newContext: {}, action: "cancel" };
    }

    const appointment = await getAppointmentById(context.appointmentId);
    if (appointment?.calendarEventId) {
      await deleteCalendarEvent(clinicId, appointment.calendarEventId);
    }
    await updateAppointmentStatus(context.appointmentId, "cancelled");

    const replyText = await generateReply({ situation: "cancellation_confirmed", facts: {} });
    return { replyText, newContext: {}, action: "cancel" };
  }

  if (context.step === "awaiting_slot_selection" && context.offeredSlots?.length) {
    const chosen = matchSlotSelection(messageText, context.offeredSlots);

    if (!chosen) {
      if (looksLikeQuestion(messageText)) {
        const replyText = await generateReply({ situation: "off_topic_during_flow", facts: {} });
        return { replyText, newContext: context, action: context.action };
      }

      // Antes de repetir la lista completa sin cambios, intentamos
      // sugerir específicamente lo más cercano a lo que el paciente
      // escribió — encontrado necesario cuando la duración de la cita
      // deja horarios en intervalos "raros" (20 min en vez de 30), y el
      // paciente pide una hora razonable que simplemente no está en el
      // menú (ej. "11:30" cuando solo hay 11:20/11:40). Repetir la
      // misma pared de texto sin ayudar a entender por qué se siente
      // robótico; sugerir lo cercano se siente como que el bot
      // entendió la intención. Nunca reserva nada por su cuenta — el
      // paciente igual tiene que confirmar una opción explícita.
      const nearest = suggestNearestSlots(messageText, context.offeredSlots);
      if (nearest.length > 0) {
        const nearestFormatted = nearest.map((s) => formatTimeForHuman(new Date(s.start))).join(" o ");
        return {
          replyText: `Esa hora exacta no la tengo, pero sí tengo ${nearestFormatted} — ¿te sirve alguna? Si preferís otra, elegí de la lista completa: ${context.offeredSlots
            .map((s) => formatTimeForHuman(new Date(s.start)))
            .join(", ")}.`,
          newContext: context,
          action: context.action,
        };
      }

      return {
        replyText: `No logré identificar cuál horario elegiste. Las opciones eran: ${context.offeredSlots
          .map((s) => formatTimeForHuman(new Date(s.start)))
          .join(", ")}. ¿Cuál preferís?`,
        newContext: context,
        action: context.action,
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
        facts: {
          día: formatFullDayLabel(new Date(chosen.start)),
          hora: formatTimeForHuman(new Date(chosen.start)),
        },
      });
      return { replyText, newContext: {}, action: "reschedule" };
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
      facts: {
        día: formatFullDayLabel(new Date(chosen.start)),
        hora: formatTimeForHuman(new Date(chosen.start)),
      },
    });
    return { replyText, newContext: {}, action: "book" };
  }

  if (context.step === "collecting_date") {
    const extraction = await extractDateAndReason(messageText, todayISO);
    const reason = extraction.reason ?? context.reason ?? null;

    if (!extraction.date) {
      if (looksLikeQuestion(messageText)) {
        const replyText = await generateReply({ situation: "off_topic_during_flow", facts: {} });
        return { replyText, newContext: context, action: context.action };
      }
      return {
        replyText: "No logré entender la fecha. ¿Podés decirme el día de nuevo?",
        newContext: context,
        action: context.action,
      };
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
        action: intent.action,
      };
    }

    if (active.length > 1) {
      // Antes de pedirle al paciente que repita la fecha/hora, intentamos
      // resolver con lo que YA escribió en este mismo mensaje — si dijo
      // "la de las 2:30pm" en su primer mensaje, no tiene sentido
      // ignorarlo y preguntarle de nuevo. Encontrado en vivo probando
      // Categoría 6: el bot pedía "escribime la fecha exacta" incluso
      // cuando el paciente ya la había dado. Ver Notas técnicas en
      // CLAUDE.md.
      const candidates = active.map((a) => ({ id: a.id, scheduledAt: new Date(a.scheduledAt) }));
      const match = await matchAppointmentByText(messageText, todayISO, candidates);

      if (match) {
        return beginActionForAppointment(clinicId, match, intent.action as "cancel" | "reschedule");
      }

      const list = active.map((a) => formatDateTimeForHuman(new Date(a.scheduledAt))).join("; ");
      // Si ya identificamos una fecha en el mensaje (aunque no haya
      // alcanzado para desambiguar sola), lo que realmente falta es la
      // hora — no repetir "la fecha" cuando el paciente ya la dio.
      const faltante = intent.date ? "la hora exacta" : "la fecha y hora exacta";
      return {
        replyText: `Tenés más de una cita activa (${list}). Decime ${faltante} de la que querés ${
          intent.action === "cancel" ? "cancelar" : "reprogramar"
        }.`,
        newContext: { step: "selecting_appointment", action: intent.action },
        action: intent.action,
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
      action: "reschedule",
    };
  }

  if (!intent.date) {
    const replyText = await generateReply({ situation: "ask_date", facts: {} });
    return { replyText, newContext: { step: "collecting_date", reason: intent.reason }, action: "book" };
  }

  return offerSlotsForDate(clinicId, intent.date, intent.reason, "book", undefined);
}