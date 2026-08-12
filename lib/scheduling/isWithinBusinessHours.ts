import type { BusinessHours } from "@/lib/db/queries/clinics";

// Costa Rica no observa horario de verano — mismo offset fijo usado en
// weekRange.ts, sendReminders.ts y matchSlotSelection.ts.
const COSTA_RICA_UTC_OFFSET_HOURS = -6;

function getCurrentCostaRicaHour(referenceDate: Date = new Date()): number {
  const crDate = new Date(referenceDate.getTime() + COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return crDate.getUTCHours();
}

export function isWithinBusinessHours(businessHours: BusinessHours): boolean {
  const currentHour = getCurrentCostaRicaHour();
  return currentHour >= businessHours.startHour && currentHour < businessHours.endHour;
}

// Para el mensaje de escalación fuera de horario — "8:00 a. m." en vez
// de "8". No usa formatTimeForHuman porque no tenemos un Date real de
// la apertura, solo la hora — más simple armarlo acá directo.
export function formatOpeningTime(businessHours: BusinessHours): string {
  const hour = businessHours.startHour;
  const period = hour < 12 ? "a. m." : "p. m.";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}