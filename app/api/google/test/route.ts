import { NextResponse } from "next/server";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { DEV_CLINIC_ID } from "@/lib/config";

// Temporary debug route to confirm the Calendar connection works before
// wiring it into the bot flow. Safe to delete once appointment creation
// (Paso 13g) is working.
export async function GET() {
  const events = await listUpcomingEvents(DEV_CLINIC_ID);
  return NextResponse.json({ count: events.length, events });
}