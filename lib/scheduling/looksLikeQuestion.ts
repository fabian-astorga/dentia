// Detección determinística de que un mensaje parece una pregunta nueva
// (probablemente fuera de tema) en vez de un intento de responder lo
// que el bot pidió (una fecha, un horario). No intenta RESPONDER la
// pregunta — eso requiere un sistema de FAQ real, que no existe
// todavía — solo evita que el bot trate una pregunta como un intento
// fallido de dar fecha/horario y repita ciegamente la misma frase.
const QUESTION_STARTERS =
  /^(cu[aá]nto|cu[aá]l|cu[aá]les|qu[eé]|c[oó]mo|d[oó]nde|cu[aá]ndo|por qu[eé]|tienen|hacen|puedo)\b/i;

export function looksLikeQuestion(messageText: string): boolean {
  const trimmed = messageText.trim();
  return trimmed.includes("?") || trimmed.includes("¿") || QUESTION_STARTERS.test(trimmed);
}