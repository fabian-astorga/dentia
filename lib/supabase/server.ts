import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

// Cliente de Supabase que respeta la sesión del usuario logueado —
// a diferencia de lib/db (Drizzle con conexión directa), este SÍ
// pasa por RLS. Se usa solo en rutas/páginas que requieren que el
// usuario autenticado vea únicamente los datos de su propia clínica.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ocurre cuando se llama desde un Server Component sin
            // poder escribir cookies — inofensivo si hay middleware
            // refrescando la sesión (lo agregamos en el Paso 4).
          }
        },
      },
    }
  );
}