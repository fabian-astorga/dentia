import type { TimeSlot } from "@/lib/google/availability";
import { getCostaRicaHourAndMinute } from "./timezone";

// Interpretación determinística (sin IA) de cuál horario eligió el
// paciente — más confiable y más barato que pedirle a Claude que
// "adivine" contra una lista que ya tenemos en código.
//
// IMPORTANTE: la comparación usa getCostaRicaHourAndMinute (ver
// timezone.ts) — nunca Date.getHours()/getMinutes() directo, eso lee
// la zona horaria del SERVIDOR (Costa Rica en local, UTC en Vercel).
// En producción esto causó que "4pm" matcheara por casualidad
// matemática con el slot de las 10am (el offset de 6 horas hizo
// colisionar ambos valores).
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

// Interpretaciones posibles de lo que escribió el paciente — con
// meridiem explícito, una sola lectura; sin meridiem, las dos posibles
// (mañana y tarde), porque no sabemos cuál quiso decir.
function parseRequestedTimeCandidates(messageText: string): { hour: number; minute: number }[] {
  const normalized = messageText.toLowerCase().replace(/\s/g, "");
  const match = normalized.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/);
  if (!match) return [];

  let hour = parseInt(match[1], 10);
  const minute = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  if (meridiem) return [{ hour, minute }];

  const candidates = [{ hour, minute }];
  if (hour < 12) candidates.push({ hour: hour + 12, minute });
  return candidates;
}

// Cuando matchSlotSelection no encontró nada exacto, esto sugiere hasta
// `maxCandidates` horarios REALES (de los ya ofrecidos) más cercanos a
// lo que el paciente escribió — para que la respuesta de seguimiento
// del bot se sienta como "entendí lo que quisiste decir" en vez de
// repetir la lista completa sin cambios. NUNCA reserva nada por su
// cuenta — el paciente todavía tiene que confirmar explícitamente una
// opción, exactamente como con la lista completa. Encontrado como
// necesario probando con horarios en incrementos de 20 minutos (ej.
// "revisión"): el paciente pedía "11:30" o "3:40" asumiendo intervalos
// de 30 minutos, ninguno de los dos existía, y el bot repetía la
// misma pared de texto sin ayudar a entender por qué.
export function suggestNearestSlots(messageText: string, slots: TimeSlot[], maxCandidates = 2): TimeSlot[] {
  const candidates = parseRequestedTimeCandidates(messageText);
  if (candidates.length === 0) return [];

  const scored = slots.map((slot) => {
    const { hour: slotHour, minute: slotMinute } = getCostaRicaHourAndMinute(slot.start);
    const slotMinutesOfDay = slotHour * 60 + slotMinute;
    const distance = Math.min(...candidates.map((c) => Math.abs(c.hour * 60 + c.minute - slotMinutesOfDay)));
    return { slot, distance };
  });

  return scored
    .filter((s) => s.distance <= 45) // no sugerir algo demasiado lejos de lo que pidió
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxCandidates)
    .map((s) => s.slot);
}