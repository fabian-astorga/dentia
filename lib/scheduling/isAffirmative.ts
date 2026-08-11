// Deterministic yes/no interpretation — no AI needed for something this
// simple, and it's more predictable than asking Claude to judge intent
// on a two-word reply.
//
// IMPORTANT: matches son por PALABRA/FRASE COMPLETA, con límites de
// palabra explícitos — nunca substring plano. "dejalo asi" contiene
// "si" como substring, lo cual antes se leía como una afirmación falsa.
// Un .includes() ingenuo acá es exactamente el tipo de bug que puede
// cancelar una cita real que nadie pidió cancelar.
const AFFIRMATIVE_PHRASES = ["si", "confirmo", "correcto", "sip", "dale", "afirmativo"];
const NEGATIVE_PHRASES = ["no", "negativo", "mejor no", "nel"];

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function containsWholePhrase(normalized: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)${escaped}($|\\s|[.,!?¡¿])`, "i");
  return pattern.test(normalized);
}

export function isAffirmative(messageText: string): boolean | null {
  const normalized = stripAccents(messageText.toLowerCase().trim());

  const affirmativeMatch = AFFIRMATIVE_PHRASES.some((phrase) => containsWholePhrase(normalized, phrase));
  const negativeMatch = NEGATIVE_PHRASES.some((phrase) => containsWholePhrase(normalized, phrase));

  // Ambiguo (matchea ambos, o ninguno) — mejor volver a preguntar que
  // adivinar mal algo tan consecuente como cancelar una cita real.
  if (affirmativeMatch && negativeMatch) return null;
  if (affirmativeMatch) return true;
  if (negativeMatch) return false;
  return null;
}