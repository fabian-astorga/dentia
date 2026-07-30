import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { extractInboundMessage } from "@/lib/whatsapp/parseWebhookPayload";
import { handleIncomingMessage } from "@/lib/whatsapp/handleIncomingMessage";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

// Meta calls this once, when you configure the webhook URL in the dashboard,
// to confirm you actually own this endpoint.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN")) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// Meta calls this every time a message (or status update) happens.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as WhatsAppWebhookPayload;
  const incomingMessage = extractInboundMessage(body);

  // Status updates (delivered/read receipts) also come through here —
  // we only care about actual text messages for now.
  if (!incomingMessage?.text?.body) {
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  await handleIncomingMessage(incomingMessage.from, incomingMessage.text.body);

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}