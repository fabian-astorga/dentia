import { NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { extractInboundMessage, extractPhoneNumberId } from "@/lib/whatsapp/parseWebhookPayload";
import { handleIncomingMessage } from "@/lib/whatsapp/handleIncomingMessage";
import { getClinicIdByPhoneNumberId } from "@/lib/db/whatsappIntegrations";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/types";

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

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WhatsAppWebhookPayload;
  const incomingMessage = extractInboundMessage(body);

  if (!incomingMessage?.text?.body) {
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  const phoneNumberId = extractPhoneNumberId(body);
  const clinicId = phoneNumberId
    ? await getClinicIdByPhoneNumberId(phoneNumberId)
    : null;

  if (!clinicId) {
    console.error(`[webhook] No clinic found for phone_number_id=${phoneNumberId}`);
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  await handleIncomingMessage(clinicId, incomingMessage.from, incomingMessage.text.body);

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}