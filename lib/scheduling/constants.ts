export const BUSINESS_HOURS = { startHour: 8, endHour: 17 }; // 8am–5pm
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

// Duración por tipo de cita — ajustable sin tocar lógica en otros lados.
export const APPOINTMENT_DURATION_BY_REASON: Record<string, number> = {
  limpieza: 30,
  revision: 20,
  consulta: 20,
  extraccion: 45,
  ortodoncia: 30,
  blanqueamiento: 45,
};

// Costa Rica no usa horario de verano — offset fijo todo el año.
// Si algún día DentIA opera en otro país, esto deja de ser válido.
export const CLINIC_TIMEZONE_OFFSET = "-06:00";