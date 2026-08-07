import { classifyIntent, type DetectedIntent } from "@/lib/ai/classify";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { BOT_REPLIES } from "@/lib/whatsapp/replies";
import { isGreeting } from "@/lib/whatsapp/isGreeting";
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
    const result = await handleSchedulingTurn(clinicId, fromPhone, messageText, context);
    replyText = result.replyText;
    await updateConversationContext(conversation.id, result.newContext);
    detectedIntent = "agendar_cita";
  } else if (isGreeting(messageText)) {
    replyText = await generateReply({ situation: "greeting", facts: {} });
    detectedIntent = "saludo";
  } else {
    const classification = await classifyIntent(messageText);
    detectedIntent = classification.intent;

    if (classification.intent === "agendar_cita") {
      const result = await handleSchedulingTurn(clinicId, fromPhone, messageText, {});
      replyText = result.replyText;
      await updateConversationContext(conversation.id, result.newContext);
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
      replyText = await generateReply({ situation: "escalation", facts: {} });
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