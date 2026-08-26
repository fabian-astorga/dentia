// Detección determinística de posible urgencia médica dentro de
// cualquier paso del flujo de scheduling — no una IA, porque esto
// tiene que funcionar siempre, sin depender de que un prompt lo
// capture bien en cada llamada (Regla #2 de CLAUDE.md: escalar
// siempre ante mención de dolor/sangrado/fiebre/urgencia, sin
// excepción).
//
// Chequeado ANTES que isDecline y antes que cualquier paso específico
// del switch en handleSchedulingTurn — un paciente puede mencionar un
// síntoma en medio de elegir un horario, no solo en el primer mensaje,
// y classifyIntent (que sí detecta esto) nunca vuelve a correr una vez
// que el flujo de agenda arrancó.
//
// IMPORTANTE: cada raíz usa \w* después de la raíz, NO un \b pegado
// directo — "sangr\w*" matchea "sangra", "sangrando", "sangre", etc.
// Un \b pegado directo a la raíz ("sangr\b") solo matchearía la
// palabra "sangr" sola, que no existe en español — habría dejado
// pasar "sangrando" sin detectar, exactamente el caso real que falló.
const MEDICAL_CONCERN_PATTERN =
  /\b(duele\w*|dolor\w*|adolorid\w*|sangr\w*|fiebre\w*|hinchad\w*|inflamad\w*|urgen\w*|emergencia\w*|infecci[oó]n\w*|pus|absces\w*|molest\w*|incomod\w*|sensib\w*)\b/i;

export function isMedicalConcern(messageText: string): boolean {
  return MEDICAL_CONCERN_PATTERN.test(messageText);
}