import { db } from "@/lib/db";
import { calendarIntegrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface SaveCalendarIntegrationInput {
  clinicId: string;
  googleCalendarId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
}

export async function saveCalendarIntegration(input: SaveCalendarIntegrationInput) {
  const [existing] = await db
    .select()
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.clinicId, input.clinicId))
    .limit(1);

  if (existing) {
    await db
      .update(calendarIntegrations)
      .set(input)
      .where(eq(calendarIntegrations.id, existing.id));
    return;
  }

  await db.insert(calendarIntegrations).values(input);
}

export async function getCalendarIntegration(clinicId: string) {
  const [integration] = await db
    .select()
    .from(calendarIntegrations)
    .where(eq(calendarIntegrations.clinicId, clinicId))
    .limit(1);

  return integration ?? null;
}