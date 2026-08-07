import type { WhatsAppWebhookPayload, WhatsAppInboundMessage } from "./types";

export function extractInboundMessage(
  body: WhatsAppWebhookPayload
): WhatsAppInboundMessage | null {
  return body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? null;
}

export function extractPhoneNumberId(
  body: WhatsAppWebhookPayload
): string | null {
  return body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id ?? null;
}