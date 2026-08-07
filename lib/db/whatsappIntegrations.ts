import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappIntegrations } from "@/lib/db/schema";

export async function getClinicIdByPhoneNumberId(
  phoneNumberId: string
): Promise<string | null> {
  const [row] = await db
    .select({ clinicId: whatsappIntegrations.clinicId })
    .from(whatsappIntegrations)
    .where(eq(whatsappIntegrations.phoneNumberId, phoneNumberId))
    .limit(1);

  return row?.clinicId ?? null;
}