import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

const CLINIC_ID = "5810d14e-6a13-4371-8a64-dc7a65f68337";

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

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const incomingMessage = change?.value?.messages?.[0];

  // Status updates (delivered/read receipts) also come through here —
  // we only care about actual messages for now.
  if (!incomingMessage) {
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }

  const fromPhone = incomingMessage.from;
  const messageText = incomingMessage.text?.body ?? "";

  // Find an existing conversation for this (clinic, phone), or start one.
  let [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.clinicId, CLINIC_ID), eq(conversations.phone, fromPhone))
    )
    .limit(1);

  if (!conversation) {
    [conversation] = await db
      .insert(conversations)
      .values({
        clinicId: CLINIC_ID,
        phone: fromPhone,
        status: "active",
      })
      .returning();
  }

  // Save the inbound message.
  await db.insert(messages).values({
    conversationId: conversation.id,
    direction: "inbound",
    content: messageText,
  });

  // Keep lastMessageAt fresh for sorting/reminders later.
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversations.id, conversation.id));

  // Fixed reply for now — no AI yet, just proving the send path works.
  await sendWhatsAppMessage(fromPhone, "Recibí tu mensaje 🦷 (todavía estoy en pruebas)");

  // Save our own reply too, so the conversation history is complete.
  await db.insert(messages).values({
    conversationId: conversation.id,
    direction: "outbound",
    content: "Recibí tu mensaje 🦷 (todavía estoy en pruebas)",
  });

  console.log(`Saved message from ${fromPhone}: "${messageText}"`);

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}