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