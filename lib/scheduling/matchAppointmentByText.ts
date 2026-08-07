import { extractDateAndReason } from "@/lib/ai/extractDate";

interface AppointmentCandidate {
  id: string;
  scheduledAt: Date;
}

// Costa Rica no tiene horario de verano y su offset (-06:00) es un
// múltiplo exacto de horas, así que los minutos son iguales en UTC y en
// hora local — por eso getUTCMinutes() es seguro acá sin conversión.
function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  const normalized = text.toLowerCase().replace(/\s/g, "");
  const match = normalized.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.replace(/\./g, "");
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return { hour, minute };
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
    const refined = sameDayMatches.filter(
      (c) => c.scheduledAt.getUTCHours() === time.hour && c.scheduledAt.getUTCMinutes() === time.minute
    );
    if (refined.length === 1) return refined[0];
  }

  return null;
}