import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { DetectedIntent } from "@/lib/ai/classify";

interface NewMessageInput {
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
  whatsappMessageId?: string;
}

export async function insertMessage(input: NewMessageInput) {
  const [created] = await db.insert(messages).values(input).returning();
  return created;
}

// Chequeo de idempotencia: si Meta reintenta la entrega de un mensaje
// (pasa después de cualquier error 500 nuestro), este wamid ya va a
// existir acá — handleIncomingMessage.ts corta el procesamiento antes
// de generar una respuesta duplicada. Ver comentario en schema.ts.
export async function findMessageByWhatsappId(whatsappMessageId: string) {
  const [existing] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.whatsappMessageId, whatsappMessageId))
    .limit(1);
  return existing ?? null;
}

export async function setDetectedIntent(messageId: string, intent: DetectedIntent) {
  await db.update(messages).set({ detectedIntent: intent }).where(eq(messages.id, messageId));
}

export async function listMessagesForConversation(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}