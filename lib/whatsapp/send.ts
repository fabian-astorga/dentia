import { requireEnv } from "@/lib/env";
import { WHATSAPP_API_VERSION, WHATSAPP_GRAPH_BASE_URL } from "./constants";

export async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const url = `${WHATSAPP_GRAPH_BASE_URL}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Failed to send WhatsApp message:", errorBody);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response.json();
}