import { google } from "googleapis";
import { getAuthorizedClient } from "./calendar";
import { BUSINESS_HOURS, CLINIC_TIMEZONE_OFFSET } from "@/lib/scheduling/constants";

export interface TimeSlot {
  start: string; // ISO con offset
  end: string;
}

// Calcula huecos libres en un día, restando los eventos ya existentes
// contra el horario de atención. Barrido simple por incrementos de
// `durationMinutes` — suficiente para el volumen de un piloto.
export async function getAvailableSlots(
  clinicId: string,
  dateISO: string, // "YYYY-MM-DD"
  durationMinutes: number
): Promise<TimeSlot[]> {
  const { client, integration } = await getAuthorizedClient(clinicId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const dayStart = `${dateISO}T${String(BUSINESS_HOURS.startHour).padStart(2, "0")}:00:00${CLINIC_TIMEZONE_OFFSET}`;
  const dayEnd = `${dateISO}T${String(BUSINESS_HOURS.endHour).padStart(2, "0")}:00:00${CLINIC_TIMEZONE_OFFSET}`;

  const response = await calendar.events.list({
    calendarId: integration.googleCalendarId,
    timeMin: dayStart,
    timeMax: dayEnd,
    singleEvents: true,
    orderBy: "startTime",
  });

  const busy = (response.data.items ?? [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }));

  const slots: TimeSlot[] = [];
  let cursor = new Date(dayStart);
  const dayEndDate = new Date(dayEnd);

  while (cursor.getTime() + durationMinutes * 60000 <= dayEndDate.getTime()) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    const overlaps = busy.some((b) => cursor < b.end && slotEnd > b.start);
    if (!overlaps) {
      slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
    }
    cursor = new Date(cursor.getTime() + durationMinutes * 60000);
  }

  return slots;
}