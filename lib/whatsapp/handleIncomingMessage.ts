import { DEV_CLINIC_ID } from "@/lib/config";
import { classifyIntent, type Intent } from "@/lib/ai/classify";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { BOT_REPLIES } from "@/lib/whatsapp/replies";
import {
  findOrCreateConversation,
  touchConversation,
  updateConversationContext,
} from "@/lib/db/queries/conversations";
import { insertMessage, setDetectedIntent } from "@/lib/db/queries/messages";
import { handleSchedulingTurn, type SchedulingContext } from "@/lib/scheduling/handleSchedulingTurn";

export async function handleIncomingMessage(fromPhone: string, messageText: string) {
  const conversation = await findOrCreateConversation(DEV_CLINIC_ID, fromPhone);

  const inboundMessage = await insertMessage({
    conversationId: conversation.id,
    direction: "inbound",
    content: messageText,
  });

  await touchConversation(conversation.id);

  const context = (conversation.context as SchedulingContext) ?? {};
  const isMidScheduling = context.step === "collecting_date" || context.step === "awaiting_slot_selection";

  let replyText: string;
  let detectedIntent: Intent;

  if (isMidScheduling) {
    // La conversación ya está en un flujo de agenda — el mensaje se
    // interpreta dentro de ese contexto, no se reclasifica de cero.
    const result = await handleSchedulingTurn(DEV_CLINIC_ID, fromPhone, messageText, context);
    replyText = result.replyText;
    await updateConversationContext(conversation.id, result.newContext);
    detectedIntent = "agendar_cita";
  } else {
    const classification = await classifyIntent(messageText);
    detectedIntent = classification.intent;

    if (classification.intent === "agendar_cita") {
      const result = await handleSchedulingTurn(DEV_CLINIC_ID, fromPhone, messageText, {});
      replyText = result.replyText;
      await updateConversationContext(conversation.id, result.newContext);
    } else {
      replyText = BOT_REPLIES[classification.intent];
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