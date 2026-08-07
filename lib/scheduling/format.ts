// Centralizes human-readable date formatting so every place that shows
// a date to a patient uses the same timezone-safe logic (see the
// "lecciones aprendidas" note in CLAUDE.md about this exact bug).
const TIME_ZONE = "America/Costa_Rica";

export function formatTimeForHuman(date: Date): string {
  return date.toLocaleTimeString("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  });
}

export function formatDateTimeForHuman(date: Date): string {
  return date.toLocaleString("es-CR", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TIME_ZONE,
  });
}

export function formatDateLabel(dateISO: string): string {
  // Mediodía fijo para evitar problemas de límite de zona horaria con
  // fechas que no traen hora (ej. "2026-08-06" solo).
  const date = new Date(`${dateISO}T12:00:00-06:00`);
  return date.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Costa_Rica",
  });
}