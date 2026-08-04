import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { sendUpcomingReminders } from "@/lib/scheduling/sendReminders";

// Protected by a shared secret so this can't be triggered by anyone who
// finds the URL. Vercel Cron sends this automatically via the
// Authorization header when configured in vercel.json.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${requireEnv("CRON_SECRET")}`;

  if (authHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const results = await sendUpcomingReminders();
  return NextResponse.json({ remindersSent: results.length, results });
}