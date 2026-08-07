// Determinstic greeting detection — no AI call needed, matches the
// pattern already used in matchSlotSelection.ts / isAffirmative.ts
// (Regla #7 de CLAUDE.md: interpretación determinística cuando es posible).
//
// Only matches messages that are JUST a greeting, nothing else. A message
// like "hola, me sangra la encía" must NOT match — it needs the real
// classifier so it can be escalated correctly.
const GREETING_PATTERN =
  /^(hola|holaa+|buenas|buenos días|buenas tardes|buenas noches|qué tal|que tal|hey|ola)[\s!?.,¡¿]*$/i;

export function isGreeting(messageText: string): boolean {
  return GREETING_PATTERN.test(messageText.trim());
}