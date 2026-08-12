export const DEFAULT_BUSINESS_HOURS = { startHour: 8, endHour: 17 }; // fallback si la clínica no tiene su propio horario configurado
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

// Duración por tipo de cita — fallback si la clínica no tiene su propia
// tabla en clinics.config.appointmentDurationByReason.
export const DEFAULT_APPOINTMENT_DURATION_BY_REASON: Record<string, number> = {
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