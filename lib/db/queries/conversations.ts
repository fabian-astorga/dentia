import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface PanelConversation {
  id: string;
  phone: string;
  status: "active" | "escalated" | "closed";
  lastMessageAt: string;
}

// Lee conversaciones para el panel usando el cliente autenticado de
// Supabase — RLS filtra automáticamente por la clínica del usuario
// logueado (política select_own_clinic_conversations). A diferencia
// de lib/db/queries/conversations.ts (Drizzle, usado por el backend/
// webhook), esta función nunca recibe ni necesita un clinicId — sería
// redundante y, peor, un lugar donde alguien podría pasar el clinicId
// equivocado por error humano. RLS es la única fuente de verdad acá.
export async function listConversationsForCurrentUser(): Promise<PanelConversation[]> {
  const supabase = await createSupabaseServerClient();

  // TEMPORAL — diagnóstico del bug de "permission denied for table
  // conversations". Borrar apenas confirmemos la causa real (ver
  // CLAUDE.md, sesión del 20 de agosto).
  const { data: sessionData } = await supabase.auth.getSession();
  console.log("[DIAGNÓSTICO] sesión vista por el Server Component:", {
    hayUsuario: !!sessionData.session?.user,
    userId: sessionData.session?.user?.id ?? null,
    role: sessionData.session?.user?.role ?? null,
    accessTokenPreview: sessionData.session?.access_token?.slice(0, 20) ?? null,
  });

  const { data, error } = await supabase
    .from("conversations")
    .select("id, phone, status, last_message_at")
    .order("last_message_at", { ascending: false });

  if (error) {
    console.error("Failed to load conversations for panel:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,  
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    phone: row.phone,
    status: row.status,
    lastMessageAt: row.last_message_at,
  }));
}