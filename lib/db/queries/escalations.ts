import { db } from "@/lib/db";
import { escalations } from "@/lib/db/schema";

interface NewEscalationInput {
  conversationId: string;
  clinicId: string;
  reason: string;
}

export async function insertEscalation(input: NewEscalationInput) {
  const [created] = await db.insert(escalations).values(input).returning();
  return created;
}