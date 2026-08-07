const AFFIRMATIVE_WORDS = ["si", "sí", "confirmo", "correcto", "sip", "dale", "afirmativo"];
const NEGATIVE_WORDS = ["no", "negativo", "mejor no", "nel"];

// Deterministic yes/no interpretation — no AI needed for something this
// simple, and it's more predictable than asking Claude to judge intent
// on a two-word reply.
export function isAffirmative(messageText: string): boolean | null {
  const normalized = messageText.toLowerCase().trim();
  if (AFFIRMATIVE_WORDS.some((w) => normalized.includes(w))) return true;
  if (NEGATIVE_WORDS.some((w) => normalized.includes(w))) return false;
  return null;
}