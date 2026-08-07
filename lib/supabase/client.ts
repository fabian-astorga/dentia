import { createBrowserClient } from "@supabase/ssr";

// Cliente de Supabase para usar del lado del navegador (Client
// Components). Contraparte de lib/supabase/server.ts — misma idea,
// pero para el contexto donde no hay acceso a cookies() de Next.js.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}