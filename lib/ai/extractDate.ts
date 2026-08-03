import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFIER_MODEL } from "./constants";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DateExtractionResult {
  date: string | null; // "YYYY-MM-DD" o null si no se entendió
  reason: string | null;
}

// Extrae fecha y motivo del mensaje del paciente. Nunca decide nada —
// solo interpreta texto (cumple la Regla #1 del CLAUDE.md).
export async function extractDateAndReason(
  messageText: string,
  todayISO: string
): Promise<DateExtractionResult> {
  const systemPrompt = `Hoy es ${todayISO} (YYYY-MM-DD), zona horaria de Costa Rica.
Leé el mensaje de un paciente que está agendando una cita dental y extraé:
- "date": la fecha mencionada, en formato YYYY-MM-DD. Si dice un día de la semana sin más (ej. "jueves"), asumí el próximo. Si dice "mañana"/"pasado mañana", calculalo relativo a hoy. Si NO menciona ninguna fecha, devolvé null.
- "reason": el motivo de la cita si lo menciona (ej. "limpieza", "revisión"), en una palabra corta. Si no lo menciona, null.

No inventes texto que la persona no escribió. Respondé ÚNICAMENTE con JSON:
{"date": "YYYY-MM-DD" | null, "reason": string | null}`;

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
    return { date: parsed.date ?? null, reason: parsed.reason ?? null };
  } catch {
    console.error("Failed to parse date extraction. Raw text was:", textBlock?.text);
    return { date: null, reason: null };
  }
}