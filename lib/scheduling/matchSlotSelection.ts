import type { TimeSlot } from "@/lib/google/availability";

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
      const d = new Date(slot.start);
      return d.getHours() === hour && d.getMinutes() === minute;
    }) ?? null
  );
}