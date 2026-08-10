// Detección determinística de que el paciente quiere abandonar el flujo
// actual (agendar/reprogramar/cancelar) — sin necesidad de otra llamada
// a Claude (Regla #7 de CLAUDE.md). Anclado a frases completas, no a
// "contiene la palabra no", para evitar falsos positivos con mensajes
// como "no tengo esa cita" durante selecting_appointment.
const DECLINE_PATTERNS = [
  /^ya no(?: quiero| gracias)?[\s!?.,¡¿]*$/i,
  /^no,? gracias[\s!?.,¡¿]*$/i,
  /^mejor no[\s!?.,¡¿]*$/i,
  /^olv[íi]d[ae]lo[\s!?.,¡¿]*$/i,
  /^d[eé]jalo(?: as[íi])?[\s!?.,¡¿]*$/i,
  /^no importa[\s!?.,¡¿]*$/i,
  /^cancela(?: eso| todo)?[\s!?.,¡¿]*$/i,
];

export function isDecline(messageText: string): boolean {
  const trimmed = messageText.trim();
  return DECLINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}