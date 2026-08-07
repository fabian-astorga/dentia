import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { DetectedIntent } from "@/lib/ai/classify";

interface NewMessageInput {
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
}

export async function insertMessage(input: NewMessageInput) {
  const [created] = await db.insert(messages).values(input).returning();
  return created;
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