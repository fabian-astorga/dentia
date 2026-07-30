import { NextRequest, NextResponse } from "next/server";

// Meta calls this once, when you configure the webhook URL in the dashboard,
// to confirm you actually own this endpoint.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    // Must echo back the challenge as plain text for Meta to accept the webhook.
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Meta calls this every time a message (or status update) happens.
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Log raw payload for now — we'll wire this into the real conversation
  // flow in the next step. Nothing gets processed yet.
  console.log("WhatsApp webhook payload:", JSON.stringify(body, null, 2));

  // Meta requires a fast 200 response, or it will retry (and eventually
  // disable the webhook). Always acknowledge immediately.
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}