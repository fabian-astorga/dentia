import { db } from "@/lib/db";
import { clinics } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ClinicConfig {
  notificationPhone?: string;
}

export async function getClinicById(clinicId: string) {
  const [clinic] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  return clinic ?? null;
}

export async function getClinicNotificationPhone(clinicId: string): Promise<string | null> {
  const clinic = await getClinicById(clinicId);
  const config = (clinic?.config as ClinicConfig) ?? {};
  return config.notificationPhone ?? null;
}