// Scope mínimo necesario: el código solo lee/crea/edita/borra EVENTOS
// (ver lib/google/calendar.ts, lib/google/availability.ts) — nunca crea
// calendarios ni toca su configuración o permisos. Pedir el scope
// completo ("auth/calendar") sería pedir más acceso del que la app usa,
// lo cual agrega fricción/sospecha innecesaria en la revisión de Google
// y aumenta el daño posible si un token se filtra alguna vez.
export const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];