import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Recibe el ?code= que Supabase pone en el magic link, lo intercambia
// por una sesión real, y redirige al panel (o a login con error si algo falla).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/panel`);
    }
  }

  return NextResponse.redirect(`${origin}/panel/login?error=auth`);
}