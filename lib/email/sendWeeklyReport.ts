import { resend } from "@/lib/email/resend";
import { WeeklyReportEmail } from "@/lib/email/templates/WeeklyReportEmail";
import type { WeeklyMetrics } from "@/lib/db/queries/reports";

interface SendWeeklyReportInput {
  to: string;
  clinicName: string;
  metrics: WeeklyMetrics;
}

export async function sendWeeklyReportEmail({ to, clinicName, metrics }: SendWeeklyReportInput) {
  const { error } = await resend.emails.send({
    from: "DentIA <onboarding@resend.dev>", // TODO: cambiar cuando verifiques tu dominio propio
    to,
    subject: `Tu resumen semanal de DentIA — ${clinicName}`,
    react: WeeklyReportEmail({ clinicName, metrics }),
  });

  if (error) {
    console.error(`Failed to send weekly report to ${to}:`, error);
    return { success: false, error };
  }

  return { success: true };
}