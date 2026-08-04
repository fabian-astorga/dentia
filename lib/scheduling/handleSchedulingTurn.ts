import { DEFAULT_APPOINTMENT_DURATION_MINUTES, APPOINTMENT_DURATION_BY_REASON } from "./constants";
import { extractDateAndReason } from "@/lib/ai/extractDate";
import { getAvailableSlots } from "@/lib/google/availability";
import { createCalendarEvent } from "@/lib/google/calendar";
import { matchSlotSelection } from "./matchSlotSelection";
import { insertAppointment } from "@/lib/db/queries/appointments";
import { findOrCreatePatient } from "@/lib/db/queries/patients";
import type { TimeSlot } from "@/lib/google/availability";

export interface SchedulingContext {
  step?: "collecting_date" | "awaiting_slot_selection";
  reason?: string | null;
  durationMinutes?: number;
  requestedDate?: string;
  offeredSlots?: TimeSlot[];
}

interface SchedulingResult {
  replyText: string;
  newContext: SchedulingContext;
}

function formatSlotForHuman(slot: TimeSlot): string {
  return new Date(slot.start).toLocaleTimeString("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Costa_Rica",
  });
}

export async function handleSchedulingTurn(
  clinicId: string,
  phone: string,
  messageText: string,
  context: SchedulingContext
): Promise<SchedulingResult> {
  const todayISO = new Date().toISOString().slice(0, 10);

  // Paso 3: el paciente está eligiendo un horario ya ofrecido.
  if (context.step === "awaiting_slot_selection" && context.offeredSlots?.length) {
    const chosen = matchSlotSelection(messageText, context.offeredSlots);

    if (!chosen) {
      return {
        replyText: `No logré identificar cuál horario elegiste. Las opciones eran: ${context.offeredSlots
          .map(formatSlotForHuman)
          .join(", ")}. ¿Cuál preferís?`,
        newContext: context,
      };
    }

    const patient = await findOrCreatePatient(clinicId, phone);

    await createCalendarEvent(clinicId, {
      summary: `Cita dental${context.reason ? ` - ${context.reason}` : ""}`,
      startISO: chosen.start,
      endISO: chosen.end,
    });

    await insertAppointment({
      clinicId,
      patientId: patient.id,
      scheduledAt: new Date(chosen.start),
      status: "pending",
    });

    return {
      replyText: `¡Listo! Tu cita quedó agendada para las ${formatSlotForHuman(chosen)}. Te vamos a recordar un día antes.`,
      newContext: {}, // se cierra el flujo, la conversación vuelve a estado neutral
    };
  }

  // Paso 1/2: todavía no tenemos una fecha confirmada.
  const extraction = await extractDateAndReason(messageText, todayISO);
  const reason = extraction.reason ?? context.reason ?? null;

  if (!extraction.date) {
    return {
      replyText: "¡Perfecto! ¿Qué día te queda mejor para la cita?",
      newContext: { step: "collecting_date", reason },
    };
  }

  const durationMinutes = reason
  ? APPOINTMENT_DURATION_BY_REASON[reason.toLowerCase()] ?? DEFAULT_APPOINTMENT_DURATION_MINUTES
  : DEFAULT_APPOINTMENT_DURATION_MINUTES;

  const slots = await getAvailableSlots(clinicId, extraction.date, durationMinutes);

  if (slots.length === 0) {
    return {
      replyText: "No encontré espacios disponibles ese día. ¿Querés probar con otra fecha?",
      newContext: { step: "collecting_date", reason },
    };
  }

  return {
    replyText: `Para ese día tengo estos horarios disponibles: ${slots
      .map(formatSlotForHuman)
      .join(", ")}. ¿Cuál preferís?`,
    newContext: {
      step: "awaiting_slot_selection",
      reason,
      durationMinutes,
      requestedDate: extraction.date,
      offeredSlots: slots,
    },
  };
}