import { extractDateAndReason } from "@/lib/ai/extractDate";
import { getCostaRicaHourAndMinute } from "./timezone";

interface AppointmentCandidate {
  id: string;
  scheduledAt: Date;
}

// parseTimeFromText interpreta lo que el PACIENTE escribió — siempre en
// hora de pared de Costa Rica ("a las 3pm"), nunca en UTC. No convertir
// nada acá: el resultado ya es directamente comparable contra
// getCostaRicaHourAndMinute(candidate.scheduledAt).
//
// IMPORTANTE: exige una ancla explícita de hora (am/pm, o ":minutos")
// para aceptar un número como hora. Sin esto, "la del 15 de agosto"
// tomaba el "15" del día del mes como hour: 15, y por coincidencia
// numérica (15h = 3pm) matcheaba con confianza total una cita de las
// 3pm CR aunque el paciente nunca mencionó ninguna hora — un falso
// positivo real encontrado probando Categoría 6 (11 de agosto de 2026).
// Un número suelto sin am/pm ni ":" es ambiguo de por sí (¿3am o 3pm?)
// y debe devolver null, no adivinar.
function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  const normalized = text.toLowerCase().replace(/\s/g, "");

  const withMeridiem = normalized.match(/(\d{1,2})(:(\d{2}))?(am|pm|a\.m\.|p\.m\.)/);
  if (withMeridiem) {
    let hour = parseInt(withMeridiem[1], 10);
    const minute = withMeridiem[3] ? parseInt(withMeridiem[3], 10) : 0;
    const meridiem = withMeridiem[4].replace(/\./g, "");
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const withColon = normalized.match(/(\d{1,2}):(\d{2})/);
  if (withColon) {
    return { hour: parseInt(withColon[1], 10), minute: parseInt(withColon[2], 10) };
  }

  return null;
}

function costaRicaDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" }); // "YYYY-MM-DD"
}

// Encuentra a cuál cita activa se refiere el paciente, cruzando la fecha
// (extraída con Claude) y, si hace falta para desambiguar, la hora
// (parseada con una regex simple, sin IA).
export async function matchAppointmentByText(
  messageText: string,
  todayISO: string,
  candidates: AppointmentCandidate[]
): Promise<AppointmentCandidate | null> {
  const extraction = await extractDateAndReason(messageText, todayISO);
  const time = parseTimeFromText(messageText);

  const sameDayMatches = extraction.date
    ? candidates.filter((c) => costaRicaDateKey(c.scheduledAt) === extraction.date)
    : candidates;

  if (sameDayMatches.length === 1) return sameDayMatches[0];

  if (time) {
    // BUG (arreglado): antes esto comparaba time.hour/minute — hora de
    // pared CR que escribió el paciente — contra
    // c.scheduledAt.getUTCHours()/getUTCMinutes() — hora UTC cruda de
    // la cita. Con el offset de -6h de Costa Rica, eso hacía que "las
    // 3pm" (hour: 15) matcheara la cita guardada como 15:00 UTC, que en
    // realidad es 9am CR — la misma familia de bug que el de
    // matchSlotSelection.ts, pero acá el resultado no era "no
    // encuentra la cita": era encontrar la cita EQUIVOCADA con
    // confianza total (refined.length === 1) y mandarla derecho a
    // cancelar/reprogramar. Fix: convertir la cita a hora CR antes de
    // comparar, mismo patrón que el resto del código.
    const refined = sameDayMatches.filter((c) => {
      const crTime = getCostaRicaHourAndMinute(c.scheduledAt);
      return crTime.hour === time.hour && crTime.minute === time.minute;
    });
    if (refined.length === 1) return refined[0];
  }

  return null;
}