import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function findOrCreateConversation(clinicId: string, phone: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.clinicId, clinicId), eq(conversations.phone, phone)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ clinicId, phone, status: "active" })
    .returning();

  return created;
}

export async function touchConversation(conversationId: string) {
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

export async function listConversationsForClinic(clinicId: string) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.clinicId, clinicId))
    .orderBy(desc(conversations.lastMessageAt));
}