import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFIER_MODEL } from "./constants";
import { resolveDateSignal, type DateSignal } from "@/lib/scheduling/resolveRelativeDate";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SchedulingAction = "book" | "reschedule" | "cancel";

export interface SchedulingIntentResult {
  action: SchedulingAction;
  date: string | null;
  reason: string | null;
}

// First-touch interpretation of a scheduling-related message: what does
// the patient actually want to do (book new / move / cancel an existing
// appointment)? This only classifies and extracts — it never looks up
// or touches any appointment itself (Regla #1 del CLAUDE.md).
//
// IMPORTANTE: mismo fix que extractDate.ts — Claude identifica QUÉ dijo
// el paciente sobre la fecha, nunca calcula la fecha relativa
// resultante (eso lo hace resolveDateSignal, determinístico). Este
// archivo tenía una copia casi idéntica del prompt ambiguo que causó
// el bug de "viernes" — ver Notas técnicas en CLAUDE.md.
export async function interpretSchedulingIntent(
  messageText: string,
  todayISO: string
): Promise<SchedulingIntentResult> {
  const systemPrompt = `Hoy es ${todayISO} (YYYY-MM-DD), zona horaria de Costa Rica.
Leé el mensaje de un paciente sobre una cita dental y determiná:

- "action": "book" si quiere agendar una cita NUEVA, "reschedule" si quiere cambiar/mover
  una cita que YA TIENE, "cancel" si quiere cancelar una cita que YA TIENE. Si no queda
  claro, usá "book".
- "dateSignal": qué dijo el paciente sobre la fecha. NO calcules ninguna fecha relativa vos
  mismo — solo identificá el tipo de mención:
  - Fecha explícita (día y mes, ej. "el 20 de agosto", "20/08"): {"type": "explicit", "value": "YYYY-MM-DD"}
  - Día de la semana sin más (ej. "el viernes", "jueves"): {"type": "weekday", "value": "viernes"} (nombre en minúsculas, sin tilde)
  - "hoy": {"type": "relative", "value": "hoy"}
  - "mañana": {"type": "relative", "value": "manana"}
  - "pasado mañana": {"type": "relative", "value": "pasado_manana"}
  - Si NO menciona ninguna fecha: null
- "reason": motivo en una palabra corta si lo menciona, si no null.

Respondé ÚNICAMENTE con JSON:
{"action": "book"|"reschedule"|"cancel", "dateSignal": {"type": "explicit"|"weekday"|"relative", "value": string} | null, "reason": string|null}`;

  const response = await anthropic.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 150,
    system: systemPrompt,
    messages: [{ role: "user", content: messageText }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const cleaned = (textBlock?.text ?? "").replace(/```json\s*|\s*```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const action: SchedulingAction = ["book", "reschedule", "cancel"].includes(parsed.action)
      ? parsed.action
      : "book";
    const date = resolveDateSignal(parsed.dateSignal as DateSignal | null, todayISO);
    return { action, date, reason: parsed.reason ?? null };
  } catch {
    console.error("Failed to parse scheduling intent. Raw text was:", textBlock?.text);
    return { action: "book", date: null, reason: null };
  }
}