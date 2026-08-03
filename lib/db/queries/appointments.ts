import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";

interface NewAppointmentInput {
  clinicId: string;
  patientId: string;
  scheduledAt: Date;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
}

export async function insertAppointment(input: NewAppointmentInput) {
  const [created] = await db.insert(appointments).values(input).returning();
  return created;
}