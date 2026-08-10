// Costa Rica no observa horario de verano — offset fijo UTC-6 todo el
// año, así que no hace falta una librería de zonas horarias para esto.
const COSTA_RICA_UTC_OFFSET_HOURS = -6;

export interface WeekRange {
  weekStart: Date; // lunes 00:00 hora de Costa Rica, expresado en UTC
  weekEnd: Date;   // lunes siguiente 00:00 hora de Costa Rica, expresado en UTC
}

// Calcula la semana pasada completa (lunes a domingo, hora de Costa Rica).
// Pensado para correr el lunes por la mañana y reportar la semana que
// acaba de terminar.
export function getPreviousWeekRange(referenceDate: Date = new Date()): WeekRange {
  const crNow = new Date(referenceDate.getTime() + COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  const dayOfWeek = crNow.getUTCDay(); // ya representa el día en CR, tras el corrimiento
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const crMondayThisWeek = new Date(crNow);
  crMondayThisWeek.setUTCHours(0, 0, 0, 0);
  crMondayThisWeek.setUTCDate(crMondayThisWeek.getUTCDate() - daysSinceMonday);

  const crMondayLastWeek = new Date(crMondayThisWeek);
  crMondayLastWeek.setUTCDate(crMondayLastWeek.getUTCDate() - 7);

  const weekStart = new Date(crMondayLastWeek.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const weekEnd = new Date(crMondayThisWeek.getTime() - COSTA_RICA_UTC_OFFSET_HOURS * 60 * 60 * 1000);

  return { weekStart, weekEnd };
}