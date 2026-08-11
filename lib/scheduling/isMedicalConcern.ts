// Detección determinística de posible urgencia médica dentro de
// cualquier paso del flujo de scheduling — no una IA, porque esto
// tiene que funcionar siempre, sin depender de que un prompt lo
// capture bien en cada llamada (Regla #2 de CLAUDE.md: escalar
// siempre ante mención de dolor/sangrado/fiebre, sin excepción).
//
// Chequeado ANTES que isDecline y antes que cualquier paso específico
// del switch en handleSchedulingTurn — un paciente puede mencionar un
// síntoma en medio de elegir un horario, no solo en el primer mensaje,
// y classifyIntent (que sí detecta esto) nunca vuelve a correr una vez
// que el flujo de agenda arrancó.
const MEDICAL_CONCERN_PATTERN =
  /\b(duele|dolor|sangr|fiebre|hinchad[oa]|inflamad[oa]|urgen(te|cia)|emergencia|infecci[oó]n|pus|absceso)\b/i;

export function isMedicalConcern(messageText: string): boolean {
  return MEDICAL_CONCERN_PATTERN.test(messageText);
}