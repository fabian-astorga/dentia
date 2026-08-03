import { NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google/client";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google/constants";

// Visiting this route redirects to Google's consent screen. This is what
// a clinic (or, for now, you as the test clinic) clicks to connect Calendar.
export async function GET() {
  const client = createOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces Google to always issue a fresh refresh_token
    scope: GOOGLE_CALENDAR_SCOPES,
  });

  return NextResponse.redirect(authUrl);
}