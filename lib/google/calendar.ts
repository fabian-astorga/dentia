import { google } from "googleapis";
import { createOAuthClient } from "./client";
import { getCalendarIntegration } from "@/lib/db/queries/calendarIntegrations";

export async function getAuthorizedClient(clinicId: string) {
  const integration = await getCalendarIntegration(clinicId);
  if (!integration) {
    throw new Error(`No hay Google Calendar conectado para la clínica ${clinicId}`);
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
  });

  return { client, integration };
}

export async function listUpcomingEvents(clinicId: string, maxResults = 5) {
  const { client, integration } = await getAuthorizedClient(clinicId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const response = await calendar.events.list({
    calendarId: integration.googleCalendarId,
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items ?? [];
}

export async function createCalendarEvent(
  clinicId: string,
  input: { summary: string; startISO: string; endISO: string }
) {
  const { client, integration } = await getAuthorizedClient(clinicId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const response = await calendar.events.insert({
    calendarId: integration.googleCalendarId,
    requestBody: {
      summary: input.summary,
      start: { dateTime: input.startISO, timeZone: "America/Costa_Rica" },
      end: { dateTime: input.endISO, timeZone: "America/Costa_Rica" },
    },
  });

  return response.data;
}

export async function updateCalendarEvent(
  clinicId: string,
  eventId: string,
  input: { startISO: string; endISO: string }
) {
  const { client, integration } = await getAuthorizedClient(clinicId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const response = await calendar.events.patch({
    calendarId: integration.googleCalendarId,
    eventId,
    requestBody: {
      start: { dateTime: input.startISO, timeZone: "America/Costa_Rica" },
      end: { dateTime: input.endISO, timeZone: "America/Costa_Rica" },
    },
  });

  return response.data;
}

export async function deleteCalendarEvent(clinicId: string, eventId: string) {
  const { client, integration } = await getAuthorizedClient(clinicId);
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.delete({ calendarId: integration.googleCalendarId, eventId });
}