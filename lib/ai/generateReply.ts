import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFIER_MODEL } from "./constants";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ReplySituation =
  | "greeting"
  | "flow_exited"
  | "ask_date"
  | "offer_slots"
  | "booking_confirmed"
  | "reschedule_confirmed"
  | "cancellation_confirmed"
  | "cancellation_declined"
  | "escalation"
  | "faq_placeholder";

interface GenerateReplyInput {
  situation: ReplySituation;
  facts: Record<string, string>; // datos exactos que DEBEN aparecer tal cual en la respuesta
}

const SITUATION_GUIDANCE: Record<ReplySituation, string> = {
  greeting:
    "El paciente solo saludó, sin pedir nada específico todavía. Saludalo con calidez y contale brevemente que podés ayudarlo a agendar, reprogramar o cancelar una cita.",
  ask_date: "El paciente quiere agendar o mover una cita. Preguntale con calidez qué día le queda mejor.",
  offer_slots:
    "Vas a ofrecer los horarios disponibles listados en los datos. Sé claro y organizado, pero natural — no como una lista robótica.",
  booking_confirmed:
    "Confirmá con entusiasmo genuino (sin exagerar) que la cita quedó agendada. Mencioná que se le va a recordar un día antes.",
  reschedule_confirmed: "Confirmá con tono tranquilizador que la cita fue movida al nuevo horario exitosamente.",
  cancellation_confirmed:
  "Confirmá la cancelación con respeto y sin presionar, dejando la puerta abierta a agendar de nuevo cuando quiera. No asumas ni menciones ningún motivo de la cancelación.",
  cancellation_declined: "El paciente decidió NO cancelar. Confirmá con calidez que la cita se mantiene como estaba.",
  escalation:
    "Este mensaje puede involucrar dolor, urgencia o algo que requiere atención humana. Respondé con calma y empatía genuina, sin minimizar ni alarmar, dejando claro que vas a poner en contacto directo con la clínica lo antes posible.",
  faq_placeholder:
    "Respondé con calidez que todavía estás aprendiendo a resolver preguntas frecuentes, pero que pronto vas a poder ayudar con horarios, precios y ubicación.",
  flow_exited:
    "El paciente decidió no seguir con lo que estaba haciendo (agendar, reprogramar o cancelar una cita). Respondé con calidez, sin insistir ni preguntar por qué, dejando claro que podés ayudarlo cuando quiera retomarlo."
};

const SYSTEM_PROMPT = `Sos DentIA, el asistente de WhatsApp de una clínica dental en Costa Rica.
Redactá UN SOLO mensaje corto y natural para un paciente, en español de Costa Rica, como lo
escribiría una persona real y cálida en recepción — no como un bot con plantillas.

Reglas estrictas:
- Tono: profesional pero cercano, ajustado al caso — cálido al confirmar algo bueno, calmado
  y respetuoso en cancelaciones, tranquilizador ante posibles urgencias.
- SIEMPRE incluí, sin alterarlos, TODOS los datos exactos que te dan en "Datos que debés incluir
  tal cual" (horas, días) — nunca los inventes, nunca los cambies, nunca los omitas.
- NUNCA prometas nada que no esté en esos datos.
- NUNCA des información médica, diagnóstico ni recomendación de tratamiento.
- NUNCA asumas ni menciones motivos, síntomas o circunstancias que el paciente no haya
  dicho explícitamente — por ejemplo, no asumas que canceló porque está enfermo, ni le
  desees que se mejore, salvo que el paciente lo haya mencionado. Quedate solo con los
  hechos que te dieron.
- Como máximo un emoji, solo si aporta calidez — nunca obligatorio.
- Máximo 2-3 frases. Esto es WhatsApp, no un correo.
- Respondé ÚNICAMENTE con el mensaje final, sin comillas ni explicaciones.`;

const FALLBACK_MESSAGE = "Perfecto, ya procesé tu solicitud.";

export async function generateReply(input: GenerateReplyInput): Promise<string> {
  try {
    const factsList =
      Object.entries(input.facts)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n") || "(ninguno)";

    const userPrompt = `Situación: ${SITUATION_GUIDANCE[input.situation]}\n\nDatos que debés incluir tal cual:\n${factsList}`;

    const response = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock?.text?.trim() || FALLBACK_MESSAGE;
  } catch (err) {
    // Fail-safe: si Claude falla por cualquier motivo, el paciente igual
    // recibe una respuesta, aunque sea genérica — nunca dejarlo sin nada.
    console.error("generateReply failed, using fallback:", err);
    return FALLBACK_MESSAGE;
  }
}