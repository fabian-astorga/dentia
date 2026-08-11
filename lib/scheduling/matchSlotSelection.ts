import type { TimeSlot } from "@/lib/google/availability";

// Costa Rica no observa horario de verano — mismo offset fijo usado en
// lib/reports/weekRange.ts y sendReminders.ts.
const COSTA_RICA_UTC_OFFSET_HOURS = -6;

// IMPORTANTE: nunca usar Date.getHours()/getMinutes() acá — eso lee la
// zona horaria del SERVIDOR (Costa Rica en local, UTC en Vercel), no la
// de Costa Rica. En producción esto causó que "4pm" matcheara por
// casualidad matemática con el slot de las 10am (el offset de 6 horas
// hizo colisionar ambos valores). Siempre convertir explícito.
function getCostaRicaHourAndMinute(isoString: string): { hour: number; minute: number } {
  const utcDate = new Date(isoString);
  const crDate = new Date(utcDate.getTime() + COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return { hour: crDate.getUTCHours(), minute: crDate.getUTCMinutes() };
}

// Interpretación determinística (sin IA) de cuál horario eligió el
// paciente — más confiable y más barato que pedirle a Claude que
// "adivine" contra una lista que ya tenemos en código.
export function matchSlotSelection(messageText: string, slots: TimeSlot[]): TimeSlot | null {
  const normalized = messageText.toLowerCase().replace(/\s/g, "");
  const match = normalized.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return (
    slots.find((slot) => {
      const { hour: slotHour, minute: slotMinute } = getCostaRicaHourAndMinute(slot.start);
      return slotHour === hour && slotMinute === minute;
    }) ?? null
  );
}