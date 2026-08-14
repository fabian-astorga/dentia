import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFIER_MODEL } from "./constants";
import { resolveDateSignal, type DateSignal } from "@/lib/scheduling/resolveRelativeDate";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DateExtractionResult {
  date: string | null; // "YYYY-MM-DD" o null si no se entendió
  reason: string | null;
}

// Extrae fecha y motivo del mensaje del paciente. Nunca decide nada —
// solo interpreta texto (cumple la Regla #1 del CLAUDE.md).
//
// IMPORTANTE: Claude identifica QUÉ dijo el paciente sobre la fecha
// (día de semana, "mañana", fecha explícita) pero NUNCA calcula la
// fecha relativa resultante — eso lo hace resolveDateSignal en código,
// determinístico. Antes se le pedía a Claude "día de semana = el
// próximo" directo en el prompt, y produjo un bug real: "viernes"
// dicho un jueves resolvió una semana después de lo esperado. Ver
// Notas técnicas en CLAUDE.md.
export async function extractDateAndReason(
  messageText: string,
  todayISO: string
): Promise<DateExtractionResult> {
  const systemPrompt = `Hoy es ${todayISO} (YYYY-MM-DD), zona horaria de Costa Rica.
Leé el mensaje de un paciente que está agendando una cita dental y extraé:

- "dateSignal": qué dijo el paciente sobre la fecha. NO calcules ninguna fecha relativa vos
  mismo — solo identificá el tipo de mención:
  - Fecha explícita (día y mes, ej. "el 20 de agosto", "20/08"): {"type": "explicit", "value": "YYYY-MM-DD"}
  - Día de la semana sin más (ej. "el viernes", "jueves"): {"type": "weekday", "value": "viernes"} (nombre en minúsculas, sin tilde)
  - "hoy": {"type": "relative", "value": "hoy"}
  - "mañana": {"type": "relative", "value": "manana"}
  - "pasado mañana": {"type": "relative", "value": "pasado_manana"}
  - Si NO menciona ninguna fecha: null
- "reason": el motivo de la cita si lo menciona (ej. "limpieza", "revisión"), en una palabra corta. Si no lo menciona, null.

No inventes texto que la persona no escribió. Respondé ÚNICAMENTE con JSON:
{"dateSignal": {"type": "explicit"|"weekday"|"relative", "value": string} | null, "reason": string | null}`;

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
    const date = resolveDateSignal(parsed.dateSignal as DateSignal | null, todayISO);
    return { date, reason: parsed.reason ?? null };
  } catch {
    console.error("Failed to parse date extraction. Raw text was:", textBlock?.text);
    return { date: null, reason: null };
  }
}