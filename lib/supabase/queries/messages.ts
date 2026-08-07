import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PanelMessage {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  detectedIntent: string | null;
  createdAt: string;
}

// Mismo criterio que conversations.ts — RLS filtra vía la política
// select_own_clinic_messages, que llega a la clínica correcta a
// través de conversations.clinic_id (messages no tiene clinic_id
// propio, a propósito, según el schema).
export async function listMessagesForConversationAsCurrentUser(
  conversationId: string
): Promise<PanelMessage[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, content, detected_intent, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load messages for panel:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    direction: row.direction,
    content: row.content,
    detectedIntent: row.detected_intent,
    createdAt: row.created_at,
  }));
}