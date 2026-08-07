import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, inArray } from "drizzle-orm";

interface NewAppointmentInput {
  clinicId: string;
  patientId: string;
  scheduledAt: Date;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  calendarEventId?: string | null;
}

export async function insertAppointment(input: NewAppointmentInput) {
  const [created] = await db.insert(appointments).values(input).returning();
  return created;
}

export async function getAppointmentsNeedingReminder(windowStart: Date, windowEnd: Date) {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        gte(appointments.scheduledAt, windowStart),
        lte(appointments.scheduledAt, windowEnd),
        isNull(appointments.reminderSentAt),
        inArray(appointments.status, ["pending", "confirmed"])
      )
    );
}

export async function markReminderSent(appointmentId: string) {
  await db
    .update(appointments)
    .set({ reminderSentAt: new Date() })
    .where(eq(appointments.id, appointmentId));
}

export async function getAppointmentById(appointmentId: string) {
  const [appointment] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  return appointment ?? null;
}

export async function findActiveAppointmentsForPatient(clinicId: string, patientId: string) {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.patientId, patientId),
        inArray(appointments.status, ["pending", "confirmed"])
      )
    )
    .orderBy(appointments.scheduledAt);
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show"
) {
  await db.update(appointments).set({ status }).where(eq(appointments.id, appointmentId));
}

export async function rescheduleAppointmentRecord(appointmentId: string, newScheduledAt: Date) {
  await db.update(appointments).set({ scheduledAt: newScheduledAt }).where(eq(appointments.id, appointmentId));
}