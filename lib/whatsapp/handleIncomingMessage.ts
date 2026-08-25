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
import { insertMessage, setDetectedIntent } from "@/lib/db/queries/messages";
import { handleSchedulingTurn, type SchedulingContext } from "@/lib/scheduling/handleSchedulingTurn";
import { generateReply } from "@/lib/ai/generateReply";
import { notifyStaffOfEscalation } from "@/lib/notifications/notifyStaff";
import { insertEscalation } from "@/lib/db/queries/escalations";
import { getClinicSchedulingConfig } from "@/lib/db/queries/clinics";
import { isWithinBusinessHours, formatOpeningTime } from "@/lib/scheduling/isWithinBusinessHours";

export async function handleIncomingMessage(
  clinicId: string,
  fromPhone: string,
  messageText: string
) {
  const conversation = await findOrCreateConversation(clinicId, fromPhone);

  const inboundMessage = await insertMessage({
    conversationId: conversation.id,
    direction: "inbound",
    content: messageText,
  });

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
    detectedIntent = result.escalated ? "caso_especial" : "agendar_cita";
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
      if (result.escalated) detectedIntent = "caso_especial";
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