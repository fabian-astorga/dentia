import { DEV_CLINIC_ID } from "@/lib/config";
import { classifyIntent } from "@/lib/ai/classify";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { BOT_REPLIES } from "@/lib/whatsapp/replies";
import { findOrCreateConversation, touchConversation } from "@/lib/db/queries/conversations";
import { insertMessage, setDetectedIntent } from "@/lib/db/queries/messages";

// Orchestrates one inbound WhatsApp message end to end: persist it,
// classify intent, reply, and persist the reply. classifyIntent only
// returns a decision — it never touches the database or sends anything
// itself (CLAUDE.md rule #1: the AI never acts directly).
export async function handleIncomingMessage(fromPhone: string, messageText: string) {
  const conversation = await findOrCreateConversation(DEV_CLINIC_ID, fromPhone);

  const inboundMessage = await insertMessage({
    conversationId: conversation.id,
    direction: "inbound",
    content: messageText,
  });

  await touchConversation(conversation.id);

  const classification = await classifyIntent(messageText);
  await setDetectedIntent(inboundMessage.id, classification.intent);

  const replyText = BOT_REPLIES[classification.intent];
  await sendWhatsAppMessage(fromPhone, replyText);

  await insertMessage({
    conversationId: conversation.id,
    direction: "outbound",
    content: replyText,
  });

  return { conversation, classification, replyText };
}