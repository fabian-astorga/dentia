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

// Día completo (weekday + número + mes) a partir de un Date con hora
// precisa — no hace falta el truco de mediodía fijo de formatDateLabel
// porque ya tenemos un instante exacto, no solo una fecha sin hora.
// Agregado para pasarle el día explícito a generateReply en las
// confirmaciones de cita: sin esto, el prompt no tenía ningún dato de
// día y Claude terminaba inventando referencias relativas como
// "mañana" que podían ser incorrectas — un paciente confiando en eso
// se presentaría el día equivocado. Ver Notas técnicas en CLAUDE.md.
export function formatFullDayLabel(date: Date): string {
  return date.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  });
}

// Día completo + hora, ej. "jueves 17 de septiembre, 4:40 p. m.".
// Usar en cualquier lugar donde el paciente pueda tener más de una
// cita en semanas distintas — "jueves" solo (formatDateTimeForHuman)
// es genuinamente ambiguo si hay un jueves esta semana Y otro la que
// viene. Encontrado en vivo: el bot listó "jueves, 9:00 a. m.; jueves,
// 3:00 p. m.; jueves, 4:40 p. m." donde dos eran de HOY y una era de
// una semana después — sin el día del mes, no hay forma de saber cuál
// es cuál. Ver Notas técnicas en CLAUDE.md.
export function formatFullDateTimeForHuman(date: Date): string {
  return `${formatFullDayLabel(date)}, ${formatTimeForHuman(date)}`;
}