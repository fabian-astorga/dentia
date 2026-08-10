import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { getPreviousWeekRange } from "@/lib/reports/weekRange";
import { getWeeklyMetricsForClinic, listClinicsForWeeklyReport } from "@/lib/db/queries/reports";
import { sendWeeklyReportEmail } from "@/lib/email/sendWeeklyReport";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekStart, weekEnd } = getPreviousWeekRange();
  const clinicsToNotify = await listClinicsForWeeklyReport();

  const results = [];
  for (const clinic of clinicsToNotify) {
    const metrics = await getWeeklyMetricsForClinic(clinic.id, weekStart, weekEnd);
    const result = await sendWeeklyReportEmail({
      to: clinic.notificationEmail,
      clinicName: clinic.name,
      metrics,
    });
    results.push({ clinic: clinic.name, ...result });
  }

  return NextResponse.json({ weekStart, weekEnd, results });
}