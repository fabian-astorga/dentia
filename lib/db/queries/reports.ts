import { db } from "@/lib/db";
import { conversations, messages, appointments, escalations, clinics } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";

export interface WeeklyMetrics {
  weekStart: Date;
  weekEnd: Date;
  conversationsHandled: number;
  resolvedWithoutHumanPct: number | null; // null si no hubo conversaciones esa semana
  appointmentsCreated: number;
  escalatedCases: number;
}

export async function getWeeklyMetricsForClinic(
  clinicId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyMetrics> {
  const inboundRows = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.clinicId, clinicId),
        eq(messages.direction, "inbound"),
        gte(messages.createdAt, weekStart),
        lt(messages.createdAt, weekEnd)
      )
    );

  const handledConversationIds = [...new Set(inboundRows.map((r) => r.conversationId))];

  const escalationRows = await db
    .select({ conversationId: escalations.conversationId })
    .from(escalations)
    .where(
      and(
        eq(escalations.clinicId, clinicId),
        gte(escalations.createdAt, weekStart),
        lt(escalations.createdAt, weekEnd)
      )
    );

  const escalatedConversationIds = new Set(escalationRows.map((r) => r.conversationId));

  const appointmentRows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        gte(appointments.createdAt, weekStart),
        lt(appointments.createdAt, weekEnd)
      )
    );

  const conversationsHandled = handledConversationIds.length;
  const escalatedWithinHandled = handledConversationIds.filter((id) =>
    escalatedConversationIds.has(id)
  ).length;

  const resolvedWithoutHumanPct =
    conversationsHandled === 0
      ? null
      : Math.round(((conversationsHandled - escalatedWithinHandled) / conversationsHandled) * 100);

  return {
    weekStart,
    weekEnd,
    conversationsHandled,
    resolvedWithoutHumanPct,
    appointmentsCreated: appointmentRows.length,
    escalatedCases: escalationRows.length,
  };
}

export interface ClinicForReport {
  id: string;
  name: string;
  notificationEmail: string;
}

// Solo clínicas que ya tienen notificationEmail cargado en config —
// las demás simplemente no reciben el correo todavía, sin romper nada.
export async function listClinicsForWeeklyReport(): Promise<ClinicForReport[]> {
  const rows = await db.select({ id: clinics.id, name: clinics.name, config: clinics.config }).from(clinics);

  return rows
    .filter((r) => typeof (r.config as Record<string, unknown>)?.notificationEmail === "string")
    .map((r) => ({
      id: r.id,
      name: r.name,
      notificationEmail: (r.config as Record<string, string>).notificationEmail,
    }));
}