const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

export async function sendWhatsAppMessage(to: string, text: string) {
  const response = await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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