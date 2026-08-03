import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google/client";
import { saveCalendarIntegration } from "@/lib/db/queries/calendarIntegrations";
import { DEV_CLINIC_ID } from "@/lib/config";

// Google redirects here after the clinic approves access, with a one-time
// `code` we exchange for real tokens.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return new NextResponse(
      "Google no devolvió un refresh token. Revocá el acceso de DentIA en myaccount.google.com/permissions e intentá de nuevo.",
      { status: 400 }
    );
  }

  await saveCalendarIntegration({
    clinicId: DEV_CLINIC_ID,
    googleCalendarId: "primary",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  });

  return NextResponse.redirect(new URL("/panel", request.url));
}