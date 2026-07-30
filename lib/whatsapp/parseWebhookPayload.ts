import type { WhatsAppWebhookPayload, WhatsAppInboundMessage } from "./types";

// Meta's webhook payload also carries status updates (delivered/read)
// through this same shape. Returns null for anything that isn't an
// actual inbound message, so callers don't need to know the payload's shape.
export function extractInboundMessage(
  body: WhatsAppWebhookPayload
): WhatsAppInboundMessage | null {
  return body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? null;
}