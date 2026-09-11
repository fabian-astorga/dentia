import { classifyIntent, type DetectedIntent } from "@/lib/ai/classify";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { BOT_REPLIES } from "@/lib/whatsapp/replies";
import { isGreeting } from "@/lib/whatsapp/isGreeting";
import { isCourtesyClosing } from "@/lib/whatsapp/isCourtesyClosing";
import { getClinicById } from "@/lib/db/queries/clinics";
import {
  findOrCreateConversation,
  touchConversation,
  updateConversationContext,
} from "@/lib/db/queries/conversations";
import { insertMessage, setDetectedIntent, findMessageByWhatsappId } from "@/lib/db/queries/messages";
import { handleSchedulingTurn, type SchedulingContext } from "@/lib/scheduling/handleSchedulingTurn";
import { generateReply } from "@/lib/ai/generateReply";
import { notifyStaffOfEscalation } from "@/lib/notifications/notifyStaff";
import { insertEscalation } from "@/lib/db/queries/escalations";
import { getClinicSchedulingConfig } from "@/lib/db/queries/clinics";
import { isWithinBusinessHours, formatOpeningTime } from "@/lib/scheduling/isWithinBusinessHours";

// Traduce la 'action' resuelta por handleSchedulingTurn a la etiqueta
// que se guarda y se muestra en el panel — antes cualquier cosa que
// pasara por ese archivo se etiquetaba genéricamente "agendar_cita",
// incluso cancelaciones y reprogramaciones. Encontrado revisando el
// panel al final del guión de pruebas (13 de septiembre 2026).
const ACTION_TO_INTENT: Record<"book" | "reschedule" | "cancel", DetectedIntent> = {
  book: "agendar_cita",
  reschedule: "reprogramar_cita",
  cancel: "cancelar_cita",
};

export async function handleIncomingMessage(
  clinicId: string,
  fromPhone: string,
  messageText: string,
  whatsappMessageId?: string
) {
  // Idempotencia: si Meta reintenta la entrega de este mismo mensaje
  // (pasa después de cualquier error 500 nuestro — lo confirmamos en
  // vivo el 7-8 de septiembre 2026, cuando el token de Google Calendar
  // vencido tiró varios 500 y Meta reintentó esos mensajes horas
  // después), cortamos ACÁ, antes de tocar nada — nada de clasificar
  // de nuevo, nada de llamar a Claude, nada de responder de nuevo.
  if (whatsappMessageId) {
    const existing = await findMessageByWhatsappId(whatsappMessageId);
    if (existing) {
      return { conversation: null, replyText: null, deduped: true };
    }
  }

  const conversation = await findOrCreateConversation(clinicId, fromPhone);

  let inboundMessage;
  try {
    inboundMessage = await insertMessage({
      conversationId: conversation.id,
      direction: "inbound",
      content: messageText,
      whatsappMessageId,
    });
  } catch (err) {
    // Red de seguridad para la rara condición de carrera de dos
    // reintentos casi simultáneos, que el chequeo de arriba podría no
    // alcanzar a atrapar: si el índice único de whatsappMessageId
    // rechaza el insert, es porque ya se procesó — no tirar 500 (eso
    // solo generaría OTRO reintento de Meta), simplemente cortar acá.
    const isDuplicateKeyError =
      whatsappMessageId && err && typeof err === "object" && "code" in err && err.code === "23505";
    if (isDuplicateKeyError) {
      return { conversation, replyText: null, deduped: true };
    }
    throw err;
  }

  await touchConversation(conversation.id);

  const context = (conversation.context as SchedulingContext) ?? {};
  const isMidScheduling =
    context.step === "collecting_date" ||
    context.step === "awaiting_slot_selection" ||
    context.step === "confirming_cancellation" ||
    context.step === "selecting_appointment";

  let replyText: string;
  let detectedIntent: DetectedIntent;

  if (isMidScheduling) {
    const result = await handleSchedulingTurn(clinicId, fromPhone, messageText, context, conversation.id);
    replyText = result.replyText;
    await updateConversationContext(conversation.id, result.newContext);
    detectedIntent = result.escalated
      ? "caso_especial"
      : result.action
        ? ACTION_TO_INTENT[result.action]
        : "agendar_cita";
  } else if (isGreeting(messageText)) {
    // Traemos el nombre real de la clínica para que el paciente sienta
    // que le habla a SU clínica, no a un producto genérico llamado
    // "DentIA" — el nombre solo se necesita acá, en la presentación
    // inicial; repetirlo en cada respuesta sonaría robótico.
    const clinic = await getClinicById(clinicId);
    replyText = await generateReply({
      situation: "greeting",
      facts: clinic?.name ? { nombre_clinica: clinic.name } : {},
    });
    detectedIntent = "saludo";
  } else if (isCourtesyClosing(messageText)) {
    // Filtro determinístico, mismo criterio que isGreeting justo arriba
    // — evita mandarle un "gracias"/"listo"/"dale" al clasificador de
    // IA, donde antes caía en el fallback "ambiguo → caso_especial" y
    // disparaba una falsa alarma de escalación. Ver Notas técnicas en
    // CLAUDE.md.
    replyText = await generateReply({ situation: "cordial_closing", facts: {} });
    detectedIntent = "cortesia";
  } else {
    const classification = await classifyIntent(messageText);
    detectedIntent = classification.intent;

    if (classification.intent === "agendar_cita") {
      const result = await handleSchedulingTurn(clinicId, fromPhone, messageText, {}, conversation.id);
      replyText = result.replyText;
      await updateConversationContext(conversation.id, result.newContext);
      if (result.escalated) {
        detectedIntent = "caso_especial";
      } else if (result.action) {
        detectedIntent = ACTION_TO_INTENT[result.action];
      }
    } else if (classification.intent === "faq") {
      replyText = await generateReply({ situation: "faq_placeholder", facts: {} });
    } else {
      await notifyStaffOfEscalation({
        clinicId,
        patientPhone: fromPhone,
        messageText,
      });
      await insertEscalation({
        conversationId: conversation.id,
        clinicId,
        reason: "Mensaje clasificado como caso especial",
      });

      const { businessHours } = await getClinicSchedulingConfig(clinicId);
      const withinHours = isWithinBusinessHours(businessHours);

      replyText = await generateReply({
        situation: withinHours ? "escalation" : "escalation_after_hours",
        facts: withinHours ? {} : { hora_de_apertura: formatOpeningTime(businessHours) },
      });
    }
  }

  await setDetectedIntent(inboundMessage.id, detectedIntent);
  await sendWhatsAppMessage(fromPhone, replyText);

  await insertMessage({
    conversationId: conversation.id,
    direction: "outbound",
    content: replyText,
  });

  return { conversation, replyText };
}