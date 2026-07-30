import type { Intent } from "@/lib/ai/classify";

// Single source of truth for what the bot says per intent. Kept separate
// from orchestration logic so the copy can be reviewed or edited (e.g. by
// Daniel) without touching how the bot decides what to say.
export const BOT_REPLIES: Record<Intent, string> = {
  faq: "¡Hola! Gracias por escribir. Todavía estoy aprendiendo a responder preguntas — pronto voy a poder ayudarte con horarios, precios y ubicación 🦷",
  agendar_cita: "¡Perfecto! Todavía estoy en pruebas y no puedo agendar citas reales todavía, pero ya entendí que querés una cita 📅",
  caso_especial: "Entiendo que esto es importante. Te voy a poner en contacto directo con la clínica para que te atiendan lo antes posible.",
};