import { db } from "@/lib/db";
import { patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function findOrCreatePatient(clinicId: string, phone: string) {
  const [existing] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db.insert(patients).values({ clinicId, phone }).returning();
  return created;
}

export async function getPatientById(patientId: string) {
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  return patient ?? null;
}